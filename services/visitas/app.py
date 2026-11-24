"""API de relatórios de visitas com sessão Supabase e armazenamento SQL Server."""
import json
import logging
import os
from contextlib import closing
from dataclasses import dataclass
from datetime import date
from typing import Annotated, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pymssql
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

app = FastAPI(title="Pelegrini — Relatórios de visitas")
bearer = HTTPBearer(auto_error=False)
Empresa = Literal["1004", "10041"]
Filial = Literal["chevrolet", "transmissao"]
Texto = Annotated[str, StringConstraints(max_length=200)]
Avaliacao = tuple[Annotated[str, StringConstraints(max_length=3000)], ...]
ITENS = {"Atendimento", "Entrega", "Preço", "Prazo"}


class Visita(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    cod_empresa_bi: Empresa
    filial_id: Filial
    nome_cliente: Annotated[str, StringConstraints(min_length=1, max_length=200)]
    data_visita: date
    cnpj: str = Field(max_length=24)
    cidade: Texto
    segmento: Texto
    diesel: Texto
    responsaveis_compras: Texto
    funcao: Texto
    avaliacoes: dict[str, Avaliacao]

    @field_validator("data_visita", mode="before")
    @classmethod
    def data_calendario(cls, value):
        if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
            raise ValueError("Use AAAA-MM-DD.")
        return value

    @field_validator("avaliacoes")
    @classmethod
    def quatro_itens(cls, value):
        if value.keys() != ITENS or any(len(values) != 3 for values in value.values()):
            raise ValueError("Preencha os três textos de Atendimento, Entrega, Preço e Prazo.")
        return value


class Relatorio(Visita):
    id: str
    visitador_nome: str


class Pagina(BaseModel):
    relatorios: list[Relatorio]
    total: int


class Gravado(BaseModel):
    id: str


@dataclass(frozen=True)
class Identity:
    id: str
    name: str
    roles: set[str]
    company: str
    branches: set[str]
    commercial: bool = False


@app.middleware("http")
async def prevent_cache(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"
    return response


def auth_get(path: str, token: str):
    try:
        request = Request(os.environ["VISITAS_SUPABASE_URL"].rstrip("/") + path, headers={
            "Authorization": f"Bearer {token}",
            "apikey": os.environ["VISITAS_SUPABASE_KEY"],
            "Accept": "application/json",
        })
        with urlopen(request, timeout=8) as response:
            return json.load(response)
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise HTTPException(401, "Sessão inválida ou expirada.") from None
    except (KeyError, URLError, TimeoutError, ValueError):
        pass
    raise HTTPException(503, "Não foi possível validar a sessão.")


def identity(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> Identity:
    if not credentials or not credentials.credentials or len(credentials.credentials) > 8192:
        raise HTTPException(401, "Autenticação obrigatória.")
    token = credentials.credentials
    user = auth_get("/auth/v1/user", token)
    user_id = user.get("id") if isinstance(user, dict) else None
    if not isinstance(user_id, str) or not user_id or len(user_id) > 36:
        raise HTTPException(401, "Sessão inválida.")
    user_filter = {"user_id": f"eq.{user_id}"}
    roles = auth_get("/rest/v1/user_roles?" + urlencode({**user_filter, "select": "role"}), token)
    profiles = auth_get("/rest/v1/profiles?" + urlencode({
        **user_filter, "select": "nome,cod_empresa_bi,filiais_permitidas,filial_id,must_change_password",
    }), token)
    if not isinstance(roles, list) or not isinstance(profiles, list):
        raise HTTPException(503, "Não foi possível verificar as permissões.")
    if len(profiles) != 1 or not isinstance(profiles[0], dict) or profiles[0].get("must_change_password") is not False:
        raise HTTPException(403, "Perfil sem acesso ou com troca de senha pendente.")
    profile = profiles[0]
    branches = profile.get("filiais_permitidas")
    if not isinstance(branches, list):
        branches = [profile.get("filial_id")]
    name = (profile.get("nome") or "").strip() or "Visitador"
    role_names = {r.get("role") for r in roles if isinstance(r, dict)}
    commercial = "master" in role_names
    if "gerencial" in role_names and not commercial:
        permissions = auth_get("/rest/v1/user_module_permissions?" + urlencode({
            **user_filter, "select": "modulo_comercial",
        }), token)
        commercial = (isinstance(permissions, list) and len(permissions) == 1
                      and isinstance(permissions[0], dict) and permissions[0].get("modulo_comercial") is True)
    return Identity(
        user_id, name[:200], role_names, str(profile.get("cod_empresa_bi") or ""),
        {branch for branch in branches if isinstance(branch, str)}, commercial,
    )


CurrentUser = Annotated[Identity, Depends(identity)]


def chave_filial(company, branch):
    if branch == "chevrolet" and company in ("1004", "10041"):
        return "10041"
    if branch == "transmissao" and company == "1004":
        return "1004"
    return None


def check_branch(user, company, branch, *, is_master=False):
    key = chave_filial(company, branch)
    if not key or (not is_master and (branch not in user.branches or chave_filial(user.company, branch) != key)):
        raise HTTPException(403, "Acesso à empresa ou filial não autorizado.")


def connect():
    try:
        return pymssql.connect(
            server=os.environ["VISITAS_SQL_SERVER"], port=os.getenv("VISITAS_SQL_PORT", "1433"),
            database=os.environ["VISITAS_SQL_DATABASE"],
            user=os.environ["VISITAS_SQL_USER"], password=os.environ["VISITAS_SQL_PASSWORD"],
            login_timeout=5, timeout=15,
        )
    except KeyError as exc:
        raise HTTPException(503, "Banco de visitas indisponível.") from exc



COLUNAS = (
    "cod_empresa_bi", "filial_id", "nome_cliente", "data_visita", "cnpj", "cidade",
    "segmento", "diesel", "responsaveis_compras", "funcao", "avaliacoes",
)


@app.post("/operacional/visitas/relatorios", response_model=Gravado, status_code=201)
def criar(relatorio: Visita, user: CurrentUser):
    if "visitador" not in user.roles:
        raise HTTPException(403, "Perfil de visitador obrigatório.")
    check_branch(user, relatorio.cod_empresa_bi, relatorio.filial_id)
    dados = relatorio.model_dump(mode="json")
    dados["avaliacoes"] = json.dumps(dados["avaliacoes"], ensure_ascii=False)
    try:
        with closing(connect()) as db:
            cursor = db.cursor()
            cursor.execute(
                "INSERT INTO dbo.RelatoriosVisitas (visitador_id, visitador_nome, "
                + ", ".join(COLUNAS) + ") OUTPUT INSERTED.id VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (user.id, user.name, *(dados[key] for key in COLUNAS)),
            )
            id_, = cursor.fetchone()
            db.commit()
    except pymssql.Error:
        logging.getLogger(__name__).error("Falha na gravação do relatório de visita no SQL Server.")
        raise HTTPException(503, "Não foi possível confirmar a gravação do relatório.") from None
    return {"id": str(id_)}


@app.get("/operacional/visitas/relatorios", response_model=Pagina)
def listar(
    user: CurrentUser,
    escopo: Literal["meus", "gerencia"],
    cod_empresa_bi: Empresa | None = None,
    filial_id: Filial | None = None,
    cliente: Annotated[str | None, Query(max_length=200)] = None,
    visitador: Annotated[str | None, Query(max_length=200)] = None,
    inicio: date | None = None,
    fim: date | None = None,
    offset: Annotated[int, Query(ge=0, le=2147483647)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    if inicio and fim and inicio > fim:
        raise HTTPException(422, "A data inicial deve ser anterior ou igual à final.")
    if escopo == "meus":
        if "visitador" not in user.roles:
            raise HTTPException(403, "Perfil de visitador obrigatório.")
        conditions = ["visitador_id = %s"]
        params = [user.id]
    else:
        if "visitador" in user.roles or not user.commercial or not user.roles.intersection({"gerencial", "master"}):
            raise HTTPException(403, "Perfil gerencial obrigatório.")
        if not cod_empresa_bi or not filial_id:
            raise HTTPException(422, "Informe cod_empresa_bi e filial_id.")
        check_branch(user, cod_empresa_bi, filial_id, is_master="master" in user.roles)
        conditions = ["filial_id = %s"]
        params = [filial_id]
        if filial_id == "chevrolet":
            conditions.append("cod_empresa_bi IN ('1004', '10041')")
        else:
            conditions.append("cod_empresa_bi = %s")
            params.append(cod_empresa_bi)
    for col, term in (("nome_cliente", cliente), ("visitador_nome", visitador)):
        if term and term.strip():
            conditions.append(f"CHARINDEX(%s COLLATE Latin1_General_100_CI_AI, {col} COLLATE Latin1_General_100_CI_AI) > 0")
            params.append(term.strip())
    for op, day in ((">=", inicio), ("<=", fim)):
        if day:
            conditions.append(f"data_visita {op} %s")
            params.append(day)
    where = " WHERE " + " AND ".join(conditions)
    try:
        with closing(connect()) as db:
            cur = db.cursor()
            cur.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
            cur.execute("SELECT COUNT_BIG(*) FROM dbo.RelatoriosVisitas" + where, tuple(params))
            total, = cur.fetchone()
            columns = ("id", "visitador_nome", *COLUNAS)
            rows = []
            if total > offset:
                cur.execute(
                    "SELECT " + ", ".join(columns) + " FROM dbo.RelatoriosVisitas" + where
                    + " ORDER BY data_visita DESC, id DESC OFFSET %s ROWS FETCH NEXT %s ROWS ONLY",
                    (*params, offset, limit),
                )
                rows = cur.fetchall()
            db.commit()
    except pymssql.Error:
        logging.getLogger(__name__).error("Falha ao consultar relatórios de visitas no SQL Server.")
        raise HTTPException(503, "Não foi possível consultar os relatórios.") from None
    reports = []
    for row in rows:
        report = dict(zip(columns, row))
        report.update(id=str(report["id"]), data_visita=report["data_visita"].isoformat(),
                      avaliacoes=json.loads(report["avaliacoes"]))
        reports.append(report)
    return {"relatorios": reports, "total": total}
