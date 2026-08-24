/**
 * Configuração de filiais por empresa BI.
 *
 * Quando uma empresa tem várias filiais que compartilham o mesmo cod_empresa_bi
 * mas precisam ser visualizadas separadamente (ex.: Pelegrini 1004 → Casa da
 * Transmissão e Casa da Chevrolet), registramos aqui o mapeamento usado pelo
 * `FilialSelectorDialog` e pelos hooks de filtragem.
 *
 * `matchFilial` lista os valores aceitos no campo "Filial" do JSON do ERP
 * (compara case-insensitive e ignorando acentos). Acrescente variações novas
 * quando aparecerem no JSON.
 */
export interface FilialConfig {
  id: string;
  nome: string;
  /** Valores válidos para o campo Filial no JSON (case/acento-insensitive). */
  matchFilial: string[];
  /**
   * Equipe padrão de vendedores desta filial. Quando definida, os módulos
   * Comercial filtram automaticamente os dados para mostrar apenas os
   * vendedores cujo nome (vendedor_nome / nome_interno / nome_externo) bate
   * com algum dos fragmentos abaixo (case/acento-insensitive). O usuário
   * ainda pode escolher outro vendedor manualmente no filtro.
   */
  equipePadrao?: string[];
}

export const EQUIPE_CHEVROLET_PELEGRINI = [
  'DARI',
  'DAYVID',
  'EDER',
  'ELIANE',
  'ELIELTON',
  'EVALDO',
  'FERNANDO CCH',
  'FERNANDO M',
  'MAGALHAES',
  'MARCIO',
  'RAFAEL',
  'XEXEU',
];

export const FILIAIS_POR_EMPRESA: Record<string, FilialConfig[]> = {
  '1004': [
    {
      id: 'transmissao',
      nome: 'Casa da Transmissão',
      matchFilial: ['CT', 'CASA DA TRANSMISSAO', 'CASA DA TRANSMISSÃO', 'TRANSMISSAO', 'TRANSMISSÃO'],
      // Sem equipe padrão: "Todos" = todos os vendedores retornados pela API da CT.
    },
    {
      id: 'chevrolet',
      nome: 'Casa da Chevrolet',
      matchFilial: ['CH', 'CASA DA CHEVROLET', 'CHEVROLET'],
      equipePadrao: EQUIPE_CHEVROLET_PELEGRINI,
    },
  ],
  '10041': [
    {
      id: 'chevrolet',
      nome: 'Casa da Chevrolet',
      matchFilial: ['CH', 'CCH', 'CASA DA CHEVROLET', 'CHEVROLET'],
      equipePadrao: EQUIPE_CHEVROLET_PELEGRINI,
    },
  ],
};

export function getFiliaisDaEmpresa(codEmpresa: string | null | undefined): FilialConfig[] {
  if (!codEmpresa) return [];
  return FILIAIS_POR_EMPRESA[codEmpresa] ?? [];
}

export function empresaPossuiFiliais(codEmpresa: string | null | undefined): boolean {
  return getFiliaisDaEmpresa(codEmpresa).length > 0;
}

export function getFilialPorId(codEmpresa: string | null | undefined, filialId: string | null | undefined): FilialConfig | undefined {
  const filiais = getFiliaisDaEmpresa(codEmpresa);
  if (!filialId) return filiais.length === 1 ? filiais[0] : undefined;
  return filiais.find(f => f.id === filialId);
}
