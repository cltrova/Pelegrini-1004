"""Catálogo de oficinas e classificação pelo histórico da filial."""
import re
import unicodedata
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


CNPJ = re.compile(r"[A-Z0-9]{12}[0-9]{2}")
Situacao = Literal["visitada", "sem_visita", "a_conferir"]
FiltroSituacao = Literal["todas", "visitada", "sem_visita", "a_conferir"]


class CoberturaCatalogo(BaseModel):
    uf: str = Field(pattern=r"^[A-Z]{2}$")
    cidade: str = Field(min_length=1)
    competencia: str = Field(pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$")
    fonte: str


class Estabelecimento(BaseModel):
    cnpj: str = Field(pattern=f"^{CNPJ.pattern}$")
    nome_fantasia: str
    razao_social: str = Field(min_length=1)
    bairro: str


class CatalogoReceita(CoberturaCatalogo):
    oficinas: list[Estabelecimento] = Field(min_length=1)


class Oficina(BaseModel):
    id: str
    cnpj: str | None
    nome: str
    razao_social: str | None = None
    bairro: str | None = None
    status: Situacao
    ultima_visita: date | None
    origem: Literal["receita", "historico"]


class PaginaOficinas(BaseModel):
    catalogo: CoberturaCatalogo
    oficinas: list[Oficina]
    total: int


@dataclass(frozen=True)
class VisitaRegistrada:
    id: int
    cnpj: str
    nome: str
    cidade: str
    data: date


@lru_cache(maxsize=1)
def carregar_catalogo():
    caminho = Path(__file__).with_name("catalogo_oficinas.json")
    catalogo = CatalogoReceita.model_validate_json(caminho.read_text(encoding="utf-8"))
    if len({row.cnpj for row in catalogo.oficinas}) != len(catalogo.oficinas):
        raise ValueError("Catálogo com CNPJs duplicados.")
    return catalogo.model_dump()


def normalizar_texto(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    plain = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(re.findall(r"[a-z0-9]+", plain))


def normalizar_documento(value: str) -> str:
    return re.sub(r"[./\s-]", "", value).upper()


def digito_verificador(base: str) -> str:
    # Os pesos se repetem de 2 a 9, da direita para a esquerda. Letras usam ASCII menos 48.
    resto = sum((ord(char) - 48) * (index % 8 + 2) for index, char in enumerate(reversed(base))) % 11
    return str(0 if resto < 2 else 11 - resto)


def cnpj_valido(documento: str) -> bool:
    if not CNPJ.fullmatch(documento) or len(set(documento)) == 1:
        return False
    base = documento[:12]
    primeiro = digito_verificador(base)
    return documento[12:] == primeiro + digito_verificador(base + primeiro)


def registrar_mais_recente(indice, chave, visita):
    atual = indice.get(chave)
    if atual is None or (visita.data, visita.id) > (atual.data, atual.id):
        indice[chave] = visita


def classificar_oficinas(catalogo, rows) -> list[Oficina]:
    municipio, uf = catalogo["cidade"], catalogo["uf"]
    nomes_municipio = {normalizar_texto(municipio), normalizar_texto(f"{municipio} {uf}")}
    visitas_exatas: dict[str, VisitaRegistrada] = {}
    visitas_locais: dict[str, VisitaRegistrada] = {}
    pendencias: dict[str, VisitaRegistrada] = {}
    for row in rows:
        visita = VisitaRegistrada(*row)
        documento = normalizar_documento(visita.cnpj)
        local = normalizar_texto(visita.cidade) in nomes_municipio
        if cnpj_valido(documento):
            registrar_mais_recente(visitas_exatas, documento, visita)
            if local:
                registrar_mais_recente(visitas_locais, documento, visita)
        elif local:
            registrar_mais_recente(pendencias, normalizar_texto(visita.nome), visita)

    oficinas = []
    documentos_receita = set()
    pendencias_sinalizadas = set()
    for empresa in catalogo["oficinas"]:
        cnpj = empresa["cnpj"]
        documentos_receita.add(cnpj)
        nome = empresa["nome_fantasia"] or empresa["razao_social"]
        aliases = {normalizar_texto(nome), normalizar_texto(empresa["razao_social"])}
        pendencias_possiveis = aliases.intersection(pendencias)
        visita = visitas_exatas.get(cnpj)
        if visita:
            status = "visitada"
        elif pendencias_possiveis:
            status = "a_conferir"
            pendencias_sinalizadas.update(pendencias_possiveis)
        else:
            status = "sem_visita"
        oficinas.append(Oficina(id=cnpj, cnpj=cnpj, nome=nome, razao_social=empresa["razao_social"],
                                bairro=empresa["bairro"] or None, status=status,
                                ultima_visita=visita.data if visita else None, origem="receita"))

    for cnpj, visita in visitas_locais.items():
        if cnpj not in documentos_receita:
            oficinas.append(Oficina(id=cnpj, cnpj=cnpj, nome=visita.nome, status="visitada",
                                    ultima_visita=visitas_exatas[cnpj].data, origem="historico"))
    for nome, visita in pendencias.items():
        if nome not in pendencias_sinalizadas:
            oficinas.append(Oficina(id=f"historico-{visita.id}", cnpj=None, nome=visita.nome,
                                    status="a_conferir", ultima_visita=None, origem="historico"))
    return oficinas


def filtrar_oficinas(oficinas: list[Oficina], busca: str, status: FiltroSituacao) -> list[Oficina]:
    nome = normalizar_texto(busca)
    documento = normalizar_documento(busca)
    resultados = []
    for oficina in oficinas:
        if status != "todas" and oficina.status != status:
            continue
        if busca and not (
            (documento and oficina.cnpj and documento in oficina.cnpj)
            or (nome and (nome in normalizar_texto(oficina.nome) or nome in normalizar_texto(oficina.razao_social or "")))
        ):
            continue
        resultados.append(oficina)
    return sorted(resultados, key=lambda row: (normalizar_texto(row.nome), row.id))


def catalogo_cobre(catalogo, uf: str | None, cidade: str | None) -> bool:
    return ((not uf or uf.upper() == catalogo["uf"])
            and (not cidade or normalizar_texto(cidade) == normalizar_texto(catalogo["cidade"])))


def pagina_oficinas(catalogo, rows, busca: str, status: FiltroSituacao, offset: int, limit: int):
    resultados = filtrar_oficinas(classificar_oficinas(catalogo, rows), busca.strip(), status)
    cobertura = {key: catalogo[key] for key in CoberturaCatalogo.model_fields}
    return {"catalogo": cobertura, "oficinas": resultados[offset:offset + limit], "total": len(resultados)}
