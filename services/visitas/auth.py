"""Validação da sessão Pelegrini e compatibilidade com contas legadas de Visitas."""
import hashlib
import hmac
import http.client
import json
import os
import re
import secrets
from contextlib import closing
from dataclasses import dataclass
from threading import BoundedSemaphore
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field

from database import DatabaseError, connect

router = APIRouter(prefix="/operacional/visitas")
COOKIE = "pelegrini_visitas"
COOKIE_PATH = "/operacional/visitas"
TOKEN_SECONDS = 8 * 60 * 60
cookie = APIKeyCookie(name=COOKIE, auto_error=False)
SessionCookie = Annotated[str | None, Depends(cookie)]
password_workers = BoundedSemaphore(2)


@dataclass(frozen=True)
class Identity:
    id: str
    name: str
    roles: set[str]
    company: str
    branches: set[str]
    commercial: bool = False

    @property
    def manages_reports(self):
        return "master" in self.roles or ("gerencial" in self.roles and self.commercial)


def chave_filial(company, branch):
    if branch == "chevrolet" and company in ("1004", "10041"):
        return "10041"
    if branch == "transmissao" and company == "1004":
        return "1004"
    return None


def senha_hash(password, salt=None):
    salt = salt if salt is not None else secrets.token_bytes(16)
    value = hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=3, maxmem=64*1024*1024, dklen=32)
    return salt.hex() + "$" + value.hex()


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def carregar_filiais(cursor, row):
    cursor.execute("SELECT filial_id FROM dbo.VisitasFiliais WHERE usuario_id=%s ORDER BY filial_id", (row["id"],))
    branches = {r["filial_id"] for r in cursor.fetchall() if chave_filial(row["cod_empresa_bi"], r["filial_id"])}
    return Identity(row["id"], row["nome"], {row["perfil"]}, row["cod_empresa_bi"], branches,
                    row["perfil"] == "gerencial")


def portal_request(path, token, *, method="GET"):
    host = os.environ.get("VISITAS_PORTAL_AUTH_HOST", "")
    key = os.environ.get("VISITAS_PORTAL_ANON_KEY", "")
    if not re.fullmatch(r"[a-z0-9]+\.supabase\.co", host) or not key:
        raise HTTPException(503, "Identificação do portal indisponível.")
    headers = {"Authorization": f"Bearer {token}", "apikey": key, "Accept": "application/json"}
    body = None
    if method == "POST":
        body = b"{}"
        headers["Content-Type"] = "application/json"
    try:
        with closing(http.client.HTTPSConnection(host, timeout=5)) as conn:
            conn.request(method, path, body=body, headers=headers)
            response = conn.getresponse()
            if response.status in (400, 401) or (response.status == 403 and path == "/auth/v1/user"):
                raise HTTPException(401, "Sessão do portal inválida ou expirada.")
            if response.status == 403:
                raise HTTPException(403, "Acesso aos relatórios de visitas não autorizado.")
            if response.status != 200:
                raise HTTPException(503, "Identificação do portal indisponível.")
            return json.loads(response.read(64 * 1024))
    except (OSError, http.client.HTTPException, ValueError):
        raise HTTPException(503, "Identificação do portal indisponível.") from None


def identity_from_portal(authorization: str) -> Identity:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or len(token) > 8192 or not re.fullmatch(r"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", token):
        raise HTTPException(401, "Sessão do portal inválida ou expirada.")

    account = portal_request("/auth/v1/user", token)
    try:
        user_id = str(UUID(account["id"]))
        email = account["email"].strip().lower()
    except (KeyError, TypeError, ValueError, AttributeError):
        raise HTTPException(401, "Sessão do portal inválida ou expirada.") from None
    if not email or len(email) > 254 or not account.get("email_confirmed_at"):
        raise HTTPException(403, "Use a conta confirmada do portal.")

    profile = portal_request("/rest/v1/rpc/visitas_identidade", token, method="POST")
    if not isinstance(profile, dict) or profile.get("id") != user_id or not isinstance(profile.get("roles"), list):
        raise HTTPException(503, "Não foi possível verificar o perfil do portal.")
    roles = {role for role in profile["roles"] if isinstance(role, str)}
    name = profile.get("nome")
    if profile.get("must_change_password"):
        raise HTTPException(403, "Troque sua senha no Pelegrini para continuar.")
    if "master" in roles:
        company, assigned = "1004", ["chevrolet", "transmissao"]
    else:
        company, assigned = profile.get("empresa") or "", profile.get("filiais")
        if not isinstance(assigned, list):
            assigned = [profile.get("filial_padrao")]
    branches = {branch for branch in assigned if isinstance(branch, str) and chave_filial(company, branch)}
    user = Identity(user_id, name if isinstance(name, str) and name.strip() else email, roles, company, branches,
                    profile.get("comercial") is True)
    if not branches or not ("visitador" in roles or user.manages_reports):
        raise HTTPException(403, "Acesso aos relatórios de visitas não autorizado.")
    return user


def identity(token: SessionCookie, authorization: Annotated[str | None, Header()] = None) -> Identity:
    if authorization is not None:
        return identity_from_portal(authorization)
    if not token or len(token) != 43:
        raise HTTPException(401, "Autenticação obrigatória.")
    try:
        with closing(connect()) as db, db.cursor(as_dict=True) as c:
            c.execute("""
                SELECT u.id,u.nome,u.perfil,u.cod_empresa_bi
                FROM dbo.VisitasUsuarios u JOIN dbo.VisitasSessoes s ON s.usuario_id=u.id
                WHERE s.token_hash=%s AND s.expira_em>SYSUTCDATETIME() AND u.ativo=1
            """, (token_hash(token),))
            row = c.fetchone()
            if not row:
                raise HTTPException(401, "Sessão inválida ou expirada.")
            return carregar_filiais(c,row)
    except DatabaseError:
        raise HTTPException(503, "Não foi possível validar a sessão.") from None


class Login(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    senha: str = Field(min_length=1, max_length=256)


class FilialSessao(BaseModel):
    cod_empresa_bi: str
    filial_id: str


class Sessao(BaseModel):
    id: str
    nome: str
    perfil: Literal["visitador", "gerencial"]
    filiais: list[FilialSessao]


def dados_sessao(user):
    return {
        "id": user.id, "nome": user.name, "perfil": "gerencial" if user.manages_reports else "visitador",
        "filiais": [{"cod_empresa_bi": chave_filial(user.company, branch), "filial_id": branch}
                   for branch in sorted(user.branches)],
    }


@router.post("/sessao", response_model=Sessao)
def entrar(login: Login, response: Response, token: SessionCookie):
    if not password_workers.acquire(blocking=False):
        raise HTTPException(429, "Aguarde um momento e tente novamente.")
    try:
        with closing(connect()) as db, db.cursor(as_dict=True) as c:
            c.execute("""
                SELECT id,nome,perfil,cod_empresa_bi,senha_hash,falhas,
                  CASE WHEN bloqueado_ate>SYSUTCDATETIME() THEN 1 ELSE 0 END bloqueado,
                  CASE WHEN bloqueado_ate IS NOT NULL THEN 1 ELSE 0 END ja_bloqueou
                FROM dbo.VisitasUsuarios WITH (UPDLOCK, ROWLOCK) WHERE email=%s AND ativo=1
            """, (login.email.strip().lower(),))
            row = c.fetchone()
            if row and row["bloqueado"]:
                raise HTTPException(401, "E-mail ou senha inválidos.")
            if not row:
                senha_hash(login.senha, bytes(16))
                raise HTTPException(401, "E-mail ou senha inválidos.")
            valid = hmac.compare_digest(row["senha_hash"], senha_hash(login.senha,bytes.fromhex(row["senha_hash"].split("$")[0])))
            if not valid:
                attempts = 1 if row["ja_bloqueou"] else row["falhas"] + 1
                c.execute("""UPDATE dbo.VisitasUsuarios SET falhas=%s, bloqueado_ate=
                           CASE WHEN %s>=5 THEN DATEADD(minute,15,SYSUTCDATETIME()) ELSE NULL END WHERE id=%s""",
                          (attempts, attempts, row["id"]))
                db.commit()
                raise HTTPException(401, "E-mail ou senha inválidos.")
            c.execute("UPDATE dbo.VisitasUsuarios SET falhas=0,bloqueado_ate=NULL WHERE id=%s", (row["id"],))
            c.execute("DELETE FROM dbo.VisitasSessoes WHERE expira_em<=SYSUTCDATETIME()")
            if token and len(token)==43:
                c.execute("DELETE FROM dbo.VisitasSessoes WHERE token_hash=%s", (token_hash(token),))
            access = secrets.token_urlsafe(32)
            c.execute("INSERT INTO dbo.VisitasSessoes (token_hash,usuario_id,expira_em) VALUES (%s,%s,DATEADD(second,%s,SYSUTCDATETIME()))",
                      (token_hash(access), row["id"], TOKEN_SECONDS))
            user = carregar_filiais(c,row)
            db.commit()
    except DatabaseError:
        raise HTTPException(503, "Não foi possível abrir a sessão.") from None
    finally:
        password_workers.release()
    response.set_cookie(COOKIE, access, httponly=True, secure=os.getenv("VISITAS_HTTP_LOCAL") != "1",
                        samesite="strict", path=COOKIE_PATH, max_age=TOKEN_SECONDS)
    return dados_sessao(user)


@router.get("/sessao", response_model=Sessao)
def consultar(user: Annotated[Identity, Depends(identity)]):
    return dados_sessao(user)


@router.delete("/sessao", status_code=204)
def sair(token: SessionCookie):
    if token and len(token)==43:
        try:
            with closing(connect()) as db, db.cursor() as c:
                c.execute("DELETE FROM dbo.VisitasSessoes WHERE token_hash=%s", (token_hash(token),))
                db.commit()
        except DatabaseError:
            raise HTTPException(503, "Não foi possível encerrar a sessão.") from None
    response = Response(status_code=204)
    response.delete_cookie(COOKIE, path=COOKIE_PATH, httponly=True,
                           secure=os.getenv("VISITAS_HTTP_LOCAL") != "1",samesite="strict")
    return response
