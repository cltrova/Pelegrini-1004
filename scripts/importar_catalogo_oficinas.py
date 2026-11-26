"""Gera o recorte de Uberlândia–MG a partir dos Parquets dos dados abertos do CNPJ."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

import duckdb


FONTE = "https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj"
DESTINO = Path(__file__).resolve().parents[1] / "services" / "visitas" / "catalogo_oficinas.json"


def arquivos(dataset, grupo, quantidade):
    url = f"https://huggingface.co/api/datasets/{dataset}/tree/main/{grupo}"
    with urlopen(url, timeout=30) as response:
        itens = sorted(
            (item for item in json.load(response) if item["type"] == "file" and item["path"].endswith(".parquet")),
            key=lambda item: item["size"],
        )
    if len(itens) != quantidade or len({item['path'] for item in itens}) != quantidade:
        raise ValueError(f"O grupo {grupo} deve conter {quantidade} arquivos distintos.")

    for item in itens:
        caminho = quote(item["path"], safe="/")
        entrada = f"https://huggingface.co/datasets/{dataset}/resolve/main/{caminho}?download=true"
        with urlopen(Request(entrada, method="HEAD"), timeout=30) as response:
            yield response.geturl()


def limpar(value):
    return " ".join((value or "").split())


def extrair(con, dataset):
    codigo = con.execute(
        "SELECT codigo FROM read_parquet(?) WHERE descricao = 'UBERLANDIA'",
        [next(arquivos(dataset, "municipios", 1))],
    ).fetchall()
    if codigo != [("5403",)]:
        raise ValueError("O código de Uberlândia na publicação do CNPJ é inesperado.")

    con.execute("""
        CREATE TEMP TABLE oficinas (cnpj_basico VARCHAR, cnpj VARCHAR, nome_fantasia VARCHAR,
                                     bairro VARCHAR, atividade_principal BOOLEAN)
    """)
    for numero, url in enumerate(arquivos(dataset, "estabelecimentos", 10), 1):
        con.execute("""
            INSERT INTO oficinas
            SELECT cnpj_basico, cnpj_basico || cnpj_ordem || cnpj_dv, nome_fantasia, bairro,
                   coalesce(cnae_fiscal_principal = '4520001', false)
            FROM read_parquet(?)
            WHERE uf = 'MG' AND municipio = '5403' AND situacao_cadastral = '02'
              AND (cnae_fiscal_principal = '4520001'
                   OR regexp_matches(coalesce(cnae_fiscal_secundaria, ''), '(^|,)\\s*4520001\\s*(,|$)'))
        """, [url])
        print(f"Arquivos de estabelecimentos consultados {numero}/10.", flush=True)
    total, = con.execute("SELECT COUNT(*) FROM oficinas").fetchall()[0]
    if total == 0:
        raise ValueError("A extração não encontrou oficinas no recorte esperado.")
    print(f"{total} estabelecimentos ativos no recorte. Buscando os nomes empresariais.", flush=True)

    con.execute("CREATE TEMP TABLE nomes (cnpj_basico VARCHAR, razao_social VARCHAR)")
    for numero, url in enumerate(arquivos(dataset, "empresas", 10), 1):
        con.execute("""
            INSERT INTO nomes SELECT cnpj_basico, razao_social FROM read_parquet(?)
            WHERE cnpj_basico IN (SELECT cnpj_basico FROM oficinas)
        """, [url])
        print(f"Arquivos de nomes empresariais consultados {numero}/10.", flush=True)
    registros = con.execute("""
        SELECT o.cnpj, o.nome_fantasia, e.razao_social, o.bairro, o.atividade_principal
        FROM nomes e JOIN oficinas o USING (cnpj_basico) ORDER BY o.cnpj
    """).fetchall()
    if (len(registros) != total or len({row[0] for row in registros}) != total
            or any(not re.fullmatch(r"[A-Z0-9]{12}[0-9]{2}", cnpj) or not limpar(razao)
                   for cnpj, _, razao, _, _ in registros)):
        raise ValueError("A contagem, os CNPJs ou os nomes da extração não conferem.")
    return registros


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("competencia", help="Mês da publicação em AAAA-MM")
    parser.add_argument("dataset", help="Identificador do espelho fiel em Parquet no Hugging Face")
    parser.add_argument("--saida", type=Path, default=DESTINO)
    parser.add_argument("--httpfs", type=Path, help="Caminho de uma extensão oficial httpfs já instalada")
    parser.add_argument("--certificados", type=Path, help="Bundle PEM de certificados confiáveis")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9]{4}-(0[1-9]|1[0-2])", args.competencia):
        parser.error("Informe a competência em AAAA-MM.")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.dataset):
        parser.error("Informe o identificador público do dataset.")

    with duckdb.connect() as con:
        con.execute("SET threads = 4")
        con.execute("SET memory_limit = '768MB'")
        if args.httpfs:
            con.load_extension(str(args.httpfs.resolve()))
        else:
            con.install_extension("httpfs")
            con.load_extension("httpfs")
        if args.certificados:
            con.execute("SET ca_cert_file = ?", [str(args.certificados.resolve())])
        # Os endereços de download podem conter '*' literal na assinatura do CDN.
        con.execute("SET allow_asterisks_in_http_paths = true")
        try:
            registros = extrair(con, args.dataset)
        except duckdb.Error as exc:
            status = re.search(r"HTTP [0-9]{3}", str(exc))
            contexto = f" ({status[0]})" if status else ""
            raise SystemExit(f"Falha ao ler um arquivo Parquet do espelho{contexto}.") from None

    catalogo = {
        "competencia": args.competencia, "uf": "MG", "cidade": "Uberlândia",
        "fonte": FONTE, "espelho": f"https://huggingface.co/datasets/{args.dataset}",
    }
    items = [
        {"cnpj": cnpj, "nome_fantasia": limpar(fantasia), "razao_social": limpar(razao), "bairro": limpar(bairro)}
        for cnpj, fantasia, razao, bairro, _ in registros
    ]
    temporario = args.saida.with_suffix(".tmp")
    temporario.write_text(json.dumps({**catalogo, "oficinas": items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporario.replace(args.saida)
    principal = sum(1 for _, _, _, _, match in registros if match)
    print(f"{len(items)} oficinas gravadas, {principal} por atividade principal e {len(items) - principal} por secundária.")


if __name__ == "__main__":
    main()
