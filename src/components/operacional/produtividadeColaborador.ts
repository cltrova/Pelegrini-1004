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
  const normalizedName = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  const kaioAlias = branch === 2 && normalizedName === 'kaio';
  const personKey = normalizedName === 'sem nome' ? identity || normalizedName : kaioAlias ? 'kaio eduardo' : normalizedName;
  return { id: JSON.stringify([branch, personKey]), name: kaioAlias ? 'KAIO EDUARDO' : name, branch, identity };
}

export function matchesProdutividadeColaborador(row: Responsavel, selected: ProdutividadeColaborador) {
  return sameProdutividadeColaborador(getProdutividadeColaborador(row), selected);
}

export function sameProdutividadeColaborador(current: ProdutividadeColaborador, selected: ProdutividadeColaborador) {
  return current.id === selected.id;
}
