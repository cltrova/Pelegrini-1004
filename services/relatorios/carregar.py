"""Importação de homologação de uma leitura completa já conferida na origem."""
import argparse
from datetime import date, datetime
from decimal import Decimal
import json
from pathlib import Path

from historico import FILIAIS, Historico, Registro


def registros(arquivo):
    for linha in arquivo:
        dado = json.loads(linha)
        yield Registro(
            int(dado['filial']), date.fromisoformat(dado['dia']), str(dado['pedido']),
            dado.get('vendedor'), Decimal(str(dado['valor'])), dado['original'],
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--diretorio', required=True, type=Path)
    parser.add_argument('--empresa', required=True, choices=FILIAIS.keys())
    parser.add_argument('--origem', required=True, type=datetime.fromisoformat)
    parser.add_argument('--arquivo', required=True, type=Path)
    options = parser.parse_args()
    historico = Historico(options.diretorio, options.empresa, FILIAIS[options.empresa])
    try:
        with options.arquivo.open(encoding='utf8') as arquivo:
            versao = historico.publicar(options.origem, registros(arquivo))
        print(json.dumps({'empresa': options.empresa, 'versao': versao}))
    finally:
        historico.close()


if __name__ == '__main__':
    main()
