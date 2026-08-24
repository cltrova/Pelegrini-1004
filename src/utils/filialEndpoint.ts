/**
 * Pelegrini (1004) compartilha o mesmo CodEmpresa_bi entre duas casas:
 *  - Casa da Transmissão → endpoints/JSONs padrão
 *  - Casa da Chevrolet  → endpoints/JSONs específicos (campos *_ch da empresa)
 *
 * A diferenciação operacional da API é feita por `cod_empresa_bi` na querystring.
 * Os paths *_ch existem em configurações antigas, mas a API atual da Pelegrini
 * Para o projeto 10041, a origem Comercial deve ser exclusiva da Casa da
 * Chevrolet (cod_empresa_bi=10041). Dados da CT/Força P. não entram no recorte.
 */

export type ComercialResource = 'pedidos' | 'devolucoes' | 'produtos';

interface EmpresaPathsLike {
  cod_empresa_bi?: string | null;
  endpoint_path_comercial_pedidos?: string | null;
  endpoint_path_comercial_devolucoes?: string | null;
  endpoint_path_comercial_produtos?: string | null;
  endpoint_path_comercial_pedidos_ch?: string | null;
  endpoint_path_comercial_devolucoes_ch?: string | null;
  endpoint_path_comercial_produtos_ch?: string | null;
  json_path_comercial?: string | null;
  json_path_comercial_produtos?: string | null;
  json_path_comercial_devolucoes?: string | null;
  json_path_comercial_ch?: string | null;
  json_path_comercial_produtos_ch?: string | null;
  json_path_comercial_devolucoes_ch?: string | null;
}

const DEFAULT_ENDPOINT_PATHS: Record<ComercialResource, string> = {
  pedidos: '/comercial/pedidos',
  devolucoes: '/comercial/devolucoes',
  produtos: '/comercial/produtos',
};

function isPelegriniChevroletContext(
  empresa: EmpresaPathsLike | null | undefined,
  filialAtiva?: string | null,
): boolean {
  const codEmpresa = String(empresa?.cod_empresa_bi ?? '').trim();
  return codEmpresa === '10041' || (codEmpresa === '1004' && filialAtiva === 'chevrolet');
}

/**
 * Fallback legado: adiciona o sufixo `_ch` ao path quando a empresa é 1004
 * e a filial ativa é "chevrolet". Mantido exportado por compatibilidade,
 * mas a resolução principal de endpoint da Pelegrini usa o path central.
 */
export function applyFilialPathSuffix(
  path: string,
  codEmpresa?: string | null,
  filialAtiva?: string | null,
): string {
  if (!path) return path;
  if (codEmpresa !== '1004') return path;
  if (filialAtiva !== 'chevrolet') return path;

  const [pathOnly, query = ''] = path.split('?');
  if (/_ch$/.test(pathOnly)) return path;
  return query ? `${pathOnly}_ch?${query}` : `${pathOnly}_ch`;
}

/**
 * Resolve o endpoint Comercial considerando a filial ativa.
 * Para Pelegrini Chevrolet, a API atual usa a procedure central e diferencia
 * pela querystring `cod_empresa_bi=10041`; por isso mantemos o path padrão.
 */
export function resolveComercialEndpointPath(
  resource: ComercialResource,
  empresa: EmpresaPathsLike | null | undefined,
  filialAtiva?: string | null,
): string {
  if (!empresa) return DEFAULT_ENDPOINT_PATHS[resource];

  const baseField =
    resource === 'pedidos' ? empresa.endpoint_path_comercial_pedidos :
    resource === 'devolucoes' ? empresa.endpoint_path_comercial_devolucoes :
    empresa.endpoint_path_comercial_produtos;
  const basePath = baseField || DEFAULT_ENDPOINT_PATHS[resource];

  const isChevrolet = isPelegriniChevroletContext(empresa, filialAtiva);
  if (!isChevrolet) return basePath;

  return basePath.replace(/_ch(?=\?|$)/, '');
}

/**
 * Resolve o valor de `cod_empresa_bi` que deve ser enviado na querystring das
 * chamadas Comerciais. A procedure do ERP exige esse parâmetro; sem ele o
 * retorno vem vazio por regra de segurança.
 *
 * Regra especial Pelegrini (1004):
 *  - Casa da Transmissão (CT) → 1004
 *  - Casa da Chevrolet  (CH) → 10041 quando acessada dentro da 1004
 *  - Projeto isolado 10041 → 10041
 *
 * Demais empresas: usa `empresa.cod_empresa_bi` sem alteração.
 */
export function resolveCodEmpresaBiParam(
  empresa: EmpresaPathsLike | null | undefined,
  filialAtiva?: string | null,
): string | null {
  if (!empresa?.cod_empresa_bi) return null;
  if (isPelegriniChevroletContext(empresa, filialAtiva)) {
    return '10041';
  }
  return empresa.cod_empresa_bi;
}


/**
 * Resolve o caminho de JSON (Storage) considerando a filial ativa.
 * Quando a Chevrolet está ativa e existe `json_path_comercial_ch`, usa-o;
 * caso contrário, volta para o JSON padrão da empresa.
 */
export function resolveComercialJsonPath(
  resource: 'pedidos' | 'produtos' | 'devolucoes',
  empresa: EmpresaPathsLike | null | undefined,
  filialAtiva?: string | null,
): string | null {
  if (!empresa) return null;
  const base =
    resource === 'pedidos' ? empresa.json_path_comercial :
    resource === 'produtos' ? empresa.json_path_comercial_produtos :
    empresa.json_path_comercial_devolucoes;
  const chevrolet =
    resource === 'pedidos' ? empresa.json_path_comercial_ch :
    resource === 'produtos' ? empresa.json_path_comercial_produtos_ch :
    empresa.json_path_comercial_devolucoes_ch;
  if (isPelegriniChevroletContext(empresa, filialAtiva) && chevrolet?.trim()) {
    return chevrolet;
  }
  return base && base.trim() ? base : null;
}
