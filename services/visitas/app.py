"""API de relatórios de visitas com contas internas no SQL Server."""
import json
import logging
from contextlib import closing
from datetime import date
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from auth import Empresa, Filial, Identity, chave_filial, identity, router
from database import DatabaseError, connect

app = FastAPI(title="Pelegrini — Relatórios de visitas")
app.include_router(router)
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


@app.exception_handler(RequestValidationError)
async def invalid_request(_request, error):
    return JSONResponse(
        status_code=422,
        content={"detail": [{"loc": item["loc"], "msg": item["msg"]} for item in error.errors()]},
    )


@app.middleware("http")
async def prevent_cache(request, call_next):
    if (request.method in ("POST", "DELETE")
            and request.headers.get("sec-fetch-site") in ("same-site", "cross-site")):
        response = JSONResponse(status_code=403, content={"detail": "Origem da requisição não autorizada."})
    else:
        response = await call_next(request)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Cookie, Authorization"
    return response


CurrentUser = Annotated[Identity, Depends(identity)]


def check_branch(user, company, branch):
    key = chave_filial(company, branch)
    if not key or branch not in user.branches or chave_filial(user.company, branch) != key:
        raise HTTPException(403, "Acesso à empresa ou filial não autorizado.")



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
    except DatabaseError:
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
        if "gerencial" not in user.roles or not user.commercial:
            raise HTTPException(403, "Perfil gerencial obrigatório.")
        if not cod_empresa_bi or not filial_id:
            raise HTTPException(422, "Informe cod_empresa_bi e filial_id.")
        check_branch(user, cod_empresa_bi, filial_id)
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
    except DatabaseError:
        logging.getLogger(__name__).error("Falha ao consultar relatórios de visitas no SQL Server.")
        raise HTTPException(503, "Não foi possível consultar os relatórios.") from None
    reports = []
    for row in rows:
        report = dict(zip(columns, row))
        report.update(id=str(report["id"]), data_visita=report["data_visita"].isoformat(),
                      avaliacoes=json.loads(report["avaliacoes"]))
        reports.append(report)
    return {"relatorios": reports, "total": total}
