"""Rota de Oficinas para instalações onde o RSYS fornece o histórico por HTTP."""
import logging
from contextlib import closing
from datetime import date
from http.client import HTTPConnection, HTTPException as HTTPClientError
from time import monotonic
from typing import Annotated, Literal
from urllib.parse import urlencode

from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field, StrictInt, ValidationError

from oficinas import FiltroSituacao, PaginaOficinas, carregar_catalogo, catalogo_cobre, pagina_oficinas


HISTORICO_LIMITE = 100
HISTORICO_TIMEOUT = 22
# Uma página pode conter os textos de avaliação de todos os relatórios.
HISTORICO_MAX_BYTES = 24 * 1024 * 1024
Empresa = Literal["1004", "10041"]
Filial = Literal["chevrolet", "transmissao"]
app = FastAPI(title="Pelegrini — Oficinas", docs_url=None, redoc_url=None, openapi_url=None)
logger = logging.getLogger(__name__)


class RelatorioHistorico(BaseModel):
    id: int = Field(gt=0)
    cnpj: str
    nome_cliente: str
    cidade: str
    data_visita: date
    cod_empresa_bi: Empresa
    filial_id: Filial


class PaginaHistorico(BaseModel):
    relatorios: list[RelatorioHistorico] = Field(max_length=HISTORICO_LIMITE)
    total: StrictInt = Field(ge=0)


class HistoricoInconsistente(Exception):
    pass


@app.middleware("http")
async def resposta_privada(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"
    return response


def consultar_pagina(empresa: Empresa, filial: Filial, authorization: str, offset: int, prazo: float) -> PaginaHistorico:
    restante = prazo - monotonic()
    if restante <= 0:
        raise TimeoutError
    consulta = urlencode({"escopo": "gerencia", "cod_empresa_bi": empresa, "filial_id": filial,
                         "offset": offset, "limit": HISTORICO_LIMITE})
    with closing(HTTPConnection("127.0.0.1", 15005, timeout=min(10, restante))) as conexao:
        conexao.request("GET", f"/operacional/visitas/relatorios?{consulta}",
                        headers={"Authorization": authorization, "Accept": "application/json"})
        resposta = conexao.getresponse()
        if resposta.status == 401:
            raise HTTPException(401, "Autenticação obrigatória.")
        if resposta.status == 403:
            raise HTTPException(403, "Acesso à filial ou aos relatórios de visitas não autorizado.")
        if resposta.status != 200:
            raise HTTPClientError(f"Histórico respondeu HTTP {resposta.status}.")
        corpo = resposta.read(HISTORICO_MAX_BYTES + 1)
    if len(corpo) > HISTORICO_MAX_BYTES or monotonic() > prazo:
        raise HistoricoInconsistente
    return PaginaHistorico.model_validate_json(corpo)


def carregar_historico(empresa: Empresa, filial: Filial, authorization: str, prazo: float):
    primeira = consultar_pagina(empresa, filial, authorization, 0, prazo)
    empresas = {"1004", "10041"} if filial == "chevrolet" else {empresa}
    rows = []
    ids = set()
    anterior = None
    for offset in range(0, max(primeira.total, 1), HISTORICO_LIMITE):
        pagina = consultar_pagina(empresa, filial, authorization, offset, prazo) if offset else primeira
        if pagina.total != primeira.total or len(pagina.relatorios) != min(HISTORICO_LIMITE, primeira.total - offset):
            raise HistoricoInconsistente
        for relatorio in pagina.relatorios:
            ordem = (relatorio.data_visita, relatorio.id)
            if (relatorio.filial_id != filial or relatorio.cod_empresa_bi not in empresas
                    or relatorio.id in ids or (anterior is not None and ordem >= anterior)):
                raise HistoricoInconsistente
            anterior = ordem
            ids.add(relatorio.id)
            rows.append((relatorio.id, relatorio.cnpj, relatorio.nome_cliente, relatorio.cidade, relatorio.data_visita))
    return rows


@app.get("/operacional/visitas/oficinas", response_model=PaginaOficinas)
def listar_oficinas(
    cod_empresa_bi: Empresa,
    filial_id: Filial,
    authorization: Annotated[str | None, Header()] = None,
    uf: Annotated[str | None, Query(max_length=2)] = None,
    cidade: Annotated[str | None, Query(max_length=200)] = None,
    busca: Annotated[str, Query(max_length=200)] = "",
    status: FiltroSituacao = "todas",
    offset: Annotated[int, Query(ge=0, le=2147483647)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    if not authorization:
        raise HTTPException(401, "Autenticação obrigatória.")

    try:
        prazo = monotonic() + HISTORICO_TIMEOUT
        try:
            rows = carregar_historico(cod_empresa_bi, filial_id, authorization, prazo)
        except HistoricoInconsistente:
            # O relatório pode ter recebido uma nova visita durante a leitura das páginas.
            rows = carregar_historico(cod_empresa_bi, filial_id, authorization, prazo)
    except (OSError, HTTPClientError, ValidationError, HistoricoInconsistente):
        logger.warning("Histórico de Visitas indisponível para a consulta de Oficinas.")
        raise HTTPException(503, "Não foi possível consultar o histórico das oficinas.") from None

    try:
        catalogo = carregar_catalogo()
    except (OSError, ValueError):
        logger.error("Catálogo de oficinas indisponível.")
        raise HTTPException(503, "Não foi possível carregar o catálogo de oficinas.") from None
    if not catalogo_cobre(catalogo, uf, cidade):
        raise HTTPException(422, f"O catálogo de oficinas cobre {catalogo['cidade']} - {catalogo['uf']}.")
    return pagina_oficinas(catalogo, rows, busca, status, offset, limit)
