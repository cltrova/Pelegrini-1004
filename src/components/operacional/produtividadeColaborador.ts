export type ProdutividadeColaborador = {
  id: string;
  name: string;
  branch: number;
  identity: string;
};

type Responsavel = {
  cod_empresa: number;
  identificacao_responsavel: string;
  nome_responsavel: string;
};

export function getProdutividadeColaborador(row: Responsavel): ProdutividadeColaborador {
  const name = row.nome_responsavel?.trim() || 'Sem nome';
  const identity = String(row.identificacao_responsavel ?? '').trim();
  const branch = Number(row.cod_empresa);
  return { id: JSON.stringify([branch, identity || name]), name, branch, identity };
}

export function matchesProdutividadeColaborador(row: Responsavel, selected: ProdutividadeColaborador) {
  return sameProdutividadeColaborador(getProdutividadeColaborador(row), selected);
}

export function sameProdutividadeColaborador(current: ProdutividadeColaborador, selected: ProdutividadeColaborador) {
  return current.id === selected.id || Boolean(
    selected.identity && current.identity === selected.identity &&
    current.name.localeCompare(selected.name, 'pt-BR', { sensitivity: 'base' }) === 0
  );
}
