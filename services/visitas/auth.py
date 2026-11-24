"""Contas e sessões internas de Visitas."""
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

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import APIKeyCookie, HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

from database import DatabaseError, connect

router = APIRouter(prefix="/operacional/visitas")
COOKIE = "pelegrini_visitas"
COOKIE_PATH = "/operacional/visitas"
TOKEN_SECONDS = 8 * 60 * 60
cookie = APIKeyCookie(name=COOKIE, auto_error=False)
SessionCookie = Annotated[str | None, Depends(cookie)]
PortalBearer = Annotated[HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))]
Empresa = Literal["1004", "10041"]
Filial = Literal["chevrolet", "transmissao"]
password_workers = BoundedSemaphore(2)


@dataclass(frozen=True)
class Identity:
    id: str
    name: str
    roles: set[str]
    company: str
    branches: set[str]
    commercial: bool = False


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


def portal_get(path, token):
    host = os.environ.get("VISITAS_PORTAL_AUTH_HOST", "")
    key = os.environ.get("VISITAS_PORTAL_ANON_KEY", "")
    if not re.fullmatch(r"[a-z0-9]+\.supabase\.co", host) or not key:
        raise HTTPException(503, "Identificação do portal indisponível.")
    try:
        with closing(http.client.HTTPSConnection(host, timeout=5)) as conn:
            conn.request("GET", path, headers={
                "Authorization": f"Bearer {token}", "apikey": key, "Accept": "application/json",
            })
            response = conn.getresponse()
            if response.status in (400, 401, 403):
                raise HTTPException(401, "Sessão do portal inválida ou expirada.")
            if response.status != 200:
                raise HTTPException(503, "Identificação do portal indisponível.")
            return json.loads(response.read(64 * 1024))
    except (OSError, http.client.HTTPException, ValueError):
        raise HTTPException(503, "Identificação do portal indisponível.") from None


def portal_account(token):
    if len(token) > 8192 or not re.fullmatch(r"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", token):
        raise HTTPException(401, "Sessão do portal inválida ou expirada.")
    account = portal_get("/auth/v1/user", token)
    try:
        user_id = str(UUID(account["id"]))
        email = account["email"].strip().lower()
    except (ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(401, "Sessão do portal inválida ou expirada.") from None
    if not email or len(email) > 254 or not account.get("email_confirmed_at"):
        raise HTTPException(403, "Use a conta confirmada do portal.")
    return user_id, email


def portal_roles(user_id, token):
    roles = portal_get(f"/rest/v1/user_roles?user_id=eq.{user_id}&select=role", token)
    if not isinstance(roles, list):
        raise HTTPException(503, "Não foi possível verificar o perfil do portal.")
    return [row.get("role") for row in roles if isinstance(row, dict)]


def portal_gerencia(user_id, token):
    permissions = portal_get(f"/rest/v1/user_module_permissions?user_id=eq.{user_id}&select=modulo_comercial,updated_at", token)
    if (not isinstance(permissions, list) or len(permissions) != 1
            or not isinstance(permissions[0], dict) or permissions[0].get("modulo_comercial") is not True):
        raise HTTPException(403, "Acesso ao Comercial obrigatório.")
    version = permissions[0].get("updated_at")
    if not isinstance(version, str) or not 1 <= len(version) <= 64:
        raise HTTPException(403, "Permissões do Comercial incompletas.")

    profiles = portal_get(f"/rest/v1/profiles?user_id=eq.{user_id}&select=cod_empresa_bi,filiais_permitidas,filial_id", token)
    if not isinstance(profiles, list) or len(profiles) != 1 or not isinstance(profiles[0], dict):
        raise HTTPException(403, "Sem filial autorizada no Comercial.")
    profile = profiles[0]
    company = str(profile.get("cod_empresa_bi", ""))
    allowed = profile.get("filiais_permitidas")
    if not isinstance(allowed, list):
        allowed = [profile.get("filial_id")]
    branches = {branch for branch in allowed if isinstance(branch, str) and chave_filial(company, branch)}
    return company, branches, version


def permissao_gerencia(user_id):
    try:
        with closing(connect()) as db, db.cursor(as_dict=True) as cursor:
            cursor.execute("""
                SELECT cod_empresa_bi, chevrolet, transmissao, versao_comercial
                FROM dbo.VisitasGerenciaPortal WHERE usuario_id=%s
            """, (user_id,))
            return cursor.fetchone()
    except DatabaseError:
        raise HTTPException(503, "Não foi possível verificar a liberação de Visitas.") from None


def salvar_permissao_gerencia(user_id, company, branches, version, master_id):
    params = (company, "chevrolet" in branches, "transmissao" in branches, version, master_id, user_id)
    try:
        with closing(connect()) as db, db.cursor() as cursor:
            cursor.execute("""
                SELECT usuario_id FROM dbo.VisitasGerenciaPortal WITH (UPDLOCK, HOLDLOCK) WHERE usuario_id=%s
            """, (user_id,))
            if cursor.fetchone():
                cursor.execute("""
                    UPDATE dbo.VisitasGerenciaPortal
                    SET cod_empresa_bi=%s, chevrolet=%s, transmissao=%s, versao_comercial=%s,
                        aprovado_por=%s, aprovado_em=SYSUTCDATETIME()
                    WHERE usuario_id=%s
                """, params)
            else:
                cursor.execute("""
                    INSERT INTO dbo.VisitasGerenciaPortal
                        (cod_empresa_bi, chevrolet, transmissao, versao_comercial, aprovado_por, usuario_id)
                    VALUES (%s,%s,%s,%s,%s,%s)
                """, params)
            db.commit()
    except DatabaseError:
        raise HTTPException(503, "Não foi possível confirmar a liberação de Visitas.") from None


def identity_from_portal(token):
    user_id, email = portal_account(token)
    role_names = portal_roles(user_id, token)
    if "master" in role_names:
        return Identity(user_id, email, {"gerencial"}, "1004", {"chevrolet", "transmissao"}, commercial=True)
    if "gerencial" not in role_names:
        raise HTTPException(403, "Perfil gerencial obrigatório.")

    company, branches, version = portal_gerencia(user_id, token)
    approved = permissao_gerencia(user_id)
    if not approved or approved["cod_empresa_bi"] != company or approved["versao_comercial"] != version:
        raise HTTPException(403, "A liberação de Visitas precisa ser confirmada no Comercial.")
    # O perfil do Comercial pode restringir a liberação aprovada pelo Master.
    branches = {branch for branch in branches if approved[branch]}
    if not branches:
        raise HTTPException(403, "Nenhuma filial autorizada para os relatórios de visitas.")
    return Identity(user_id, email, {"gerencial"}, company, branches, commercial=True)


def identity(token: SessionCookie, credentials: PortalBearer) -> Identity:
    if credentials:
        return identity_from_portal(credentials.credentials)
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


class PermissaoGerencia(BaseModel):
    model_config = ConfigDict(extra="forbid")
    usuario_id: UUID
    cod_empresa_bi: Empresa
    filiais: list[Filial] = Field(min_length=1, max_length=2)


@router.post("/gerencia/permissoes", status_code=204)
def aprovar_gerencia(payload: PermissaoGerencia, credentials: PortalBearer):
    if not credentials:
        raise HTTPException(401, "Sessão do Comercial obrigatória.")
    token = credentials.credentials
    master_id, _ = portal_account(token)
    if "master" not in portal_roles(master_id, token):
        raise HTTPException(403, "Perfil Master obrigatório.")

    user_id = str(payload.usuario_id)
    roles = portal_roles(user_id, token)
    if "gerencial" not in roles or "master" in roles:
        raise HTTPException(409, "A conta precisa ter o perfil Gerencial.")
    company, branches, version = portal_gerencia(user_id, token)
    if company != payload.cod_empresa_bi or branches != set(payload.filiais) or len(branches) != len(payload.filiais):
        raise HTTPException(409, "Confirme as filiais salvas no Comercial antes de liberar Visitas.")
    salvar_permissao_gerencia(user_id, company, branches, version, master_id)
    return Response(status_code=204)


def dados_sessao(user):
    return {
        "id": user.id, "nome": user.name, "perfil": next(iter(user.roles)),
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
