"""Validação da sessão Pelegrini e compatibilidade com contas legadas de Visitas."""
import hashlib
import hmac
import json
import os
import secrets
from contextlib import closing
from dataclasses import dataclass
from threading import BoundedSemaphore
from typing import Annotated, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
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


class NoAuthRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


pelegrini_auth_opener = build_opener(NoAuthRedirect())


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


def pelegrini_identity(authorization: str) -> Identity:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token or any(char.isspace() for char in token):
        raise HTTPException(401, "Autenticação obrigatória.")

    base_url = os.getenv("VISITAS_PELEGRINI_AUTH_URL", "").rstrip("/")
    api_key = os.getenv("VISITAS_PELEGRINI_AUTH_PUBLISHABLE_KEY")
    url = urlsplit(base_url)
    if url.scheme != "https" or not url.hostname or (url.path or url.query or url.fragment or url.username) or not api_key:
        raise HTTPException(503, "A validação da sessão do Pelegrini está indisponível.")

    request = Request(f"{base_url}/rest/v1/rpc/visitas_identidade", data=b"{}", headers={
        "Authorization": f"Bearer {token}",
        "apikey": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    })
    try:
        with pelegrini_auth_opener.open(request, timeout=6) as response:
            profile = json.load(response)
    except HTTPError as error:
        error.close()
        if error.code == 401:
            raise HTTPException(401, "Sessão inválida ou expirada.") from None
        if error.code == 403:
            raise HTTPException(403, "Acesso aos relatórios de visitas não autorizado.") from None
        raise HTTPException(503, "Não foi possível validar a sessão do Pelegrini.") from None
    except (URLError, OSError, ValueError):
        raise HTTPException(503, "Não foi possível validar a sessão do Pelegrini.") from None

    if profile is None:
        raise HTTPException(401, "Sessão inválida ou expirada.")
    try:
        user_id = str(UUID(profile["id"]))
        name = profile["nome"]
        roles = set(profile["roles"])
    except (KeyError, TypeError, ValueError, AttributeError):
        raise HTTPException(503, "Não foi possível validar a sessão do Pelegrini.") from None

    if profile.get("must_change_password"):
        raise HTTPException(403, "Troque sua senha no Pelegrini para continuar.")
    company = profile.get("empresa") or ""
    assigned = profile.get("filiais")
    branches = ("chevrolet", "transmissao") if "master" in roles else (
        assigned if isinstance(assigned, list) else [profile.get("filial_padrao")]
    )
    if "master" in roles:
        company = "1004"
    branches = {branch for branch in branches if chave_filial(company, branch)}
    user = Identity(user_id, name, roles, company, branches, profile.get("comercial") is True)
    if not branches or not ("visitador" in roles or user.manages_reports):
        raise HTTPException(403, "Acesso aos relatórios de visitas não autorizado.")
    return user


def identity(token: SessionCookie, authorization: Annotated[str | None, Header()] = None) -> Identity:
    if authorization is not None:
        return pelegrini_identity(authorization)
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
