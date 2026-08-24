import { useQuery } from '@tanstack/react-query';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';
import { DreRecord, DreFilters, DreHierarchyNode, DreGroupSummary, DreIndicator, DreVariation } from '@/types/dre';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { Empresa } from '@/hooks/useEmpresaConfig';
import { supabase } from '@/integrations/supabase/client';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import dreDataLocal from '@/data/dreData.json';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';
import { defaultDreConfig, shouldInvertSign } from '@/config/dreConfig';

/**
 * Retorna apenas os registros "folha" (nível mais detalhado por grupo).
 * Esta é a ÚNICA fonte de verdade para agregações da DRE — usada por
 * Dashboard, Detalhe, Indicadores, Hierarquia e Mobile, garantindo que
 * todas as telas mostrem o mesmo valor para a mesma conta.
 *
 * Regra: para cada grupo contábil, identifica o maior `nivel` presente
 * e retorna somente os registros nesse nível. Isso elimina:
 *  - dupla contagem (registros pais totalizadores)
 *  - perda de contas (quando outro grupo tem profundidade maior)
 */
export function getLeafRecords(data: DreRecord[]): DreRecord[] {
  const nivelMaxPorGrupo: Record<string, number> = {};
  for (const r of data) {
    const grupo = r.grupo || '';
    if (nivelMaxPorGrupo[grupo] === undefined || r.nivel > nivelMaxPorGrupo[grupo]) {
      nivelMaxPorGrupo[grupo] = r.nivel;
    }
  }
  return data.filter((r) => r.nivel === nivelMaxPorGrupo[r.grupo || '']);
}

/**
 * Aplica a regra de inversão de sinal (definida em dreConfig) ao valor
 * de um registro. Usado de forma consistente por todas as telas.
 */
export function getTransformedValue(record: DreRecord): number {
  return shouldInvertSign(defaultDreConfig, record.codigo, record.grupo)
    ? -record.valor
    : record.valor;
}

// Mapeamento de nomes de JSON para imports locais (fallback)
const JSON_IMPORTS: Record<string, () => Promise<{ default: DreRecord[] }>> = {
  'dreData': () => Promise.resolve({ default: dreDataLocal as DreRecord[] }),
  '/data/dreData.json': () => Promise.resolve({ default: dreDataLocal as DreRecord[] }),
};

// Normalizar campos do JSON para o formato esperado
function normalizeRecord(record: any): DreRecord {
  const vi = record.Vendedor_Interno ?? record.vendedor_interno ?? null;
  const ve = record.Vendedor_Externo ?? record.vendedor_externo ?? null;
  const evi = record.Empresa_Vendedor_Interno ?? record.empresa_vendedor_interno ?? null;
  const eve = record.Empresa_Vendedor_Externo ?? record.empresa_vendedor_externo ?? null;
  return {
    ...record,
    // Normalizar cod_empresa_bi de várias formas possíveis
    cod_empresa_bi: String(record.cod_empresa_bi || record.CodEmpresa_bi || record.codEmpresa_bi || ''),
    // Garantir que outros campos críticos existam
    empresa: record.empresa || '',
    ano_mes: record.ano_mes || '',
    nivel: record.nivel ?? 0,
    codigo: record.codigo || '',
    descricao: record.descricao || '',
    grupo: record.grupo || '',
    valor: record.valor ?? 0,
    ordem: record.ordem ?? 0,
    Vendedor_Interno: typeof vi === 'string' && vi.trim() === '' ? null : vi,
    Vendedor_Externo: typeof ve === 'string' && ve.trim() === '' ? null : ve,
    Empresa_Vendedor_Interno: typeof evi === 'string' && evi.trim() === '' ? null : evi,
    Empresa_Vendedor_Externo: typeof eve === 'string' && eve.trim() === '' ? null : eve,
  };
}

/**
 * Reclassificação de lançamentos sem grupo (empresa 1001 / Caspper).
 *
 * O endpoint devolve, para o mesmo código contábil, lotes com `grupo`
 * preenchido e lotes com `grupo` vazio. Os vazios caíam na categoria
 * "Outros" (rótulo de 'Sem Descrição'), fazendo a mesma conta aparecer
 * em dois grupos distintos na DRE.
 *
 * Regra: monta um de-para código -> grupo a partir dos registros que TÊM
 * grupo (usando o grupo mais frequente por código) e aplica esse grupo
 * aos registros do mesmo código que vieram sem classificação.
 *
 * Deve rodar ANTES de getLeafRecords, pois o nível-folha é calculado
 * por grupo.
 */
function reclassificarGruposSemDescricao(data: DreRecord[]): DreRecord[] {
  const ocorrencias = new Map<string, Map<string, number>>();

  const normalizarCodigo = (codigo: unknown) => String(codigo ?? '').trim();
  const normalizarGrupo = (grupo: unknown) => String(grupo ?? '').trim();
  const grupoSemClassificacao = (grupo: string) =>
    !grupo || grupo.toLocaleLowerCase('pt-BR') === 'sem descrição';

  for (const r of data) {
    const grupo = normalizarGrupo(r.grupo);
    if (grupoSemClassificacao(grupo)) continue;
    const codigo = normalizarCodigo(r.codigo);
    if (!codigo) continue;
    let porGrupo = ocorrencias.get(codigo);
    if (!porGrupo) {
      porGrupo = new Map<string, number>();
      ocorrencias.set(codigo, porGrupo);
    }
    porGrupo.set(grupo, (porGrupo.get(grupo) || 0) + 1);
  }

  const grupoPorCodigo = new Map<string, string>();
  ocorrencias.forEach((porGrupo, codigo) => {
    let melhorGrupo = '';
    let melhorContagem = -1;
    porGrupo.forEach((contagem, grupo) => {
      if (contagem > melhorContagem) {
        melhorContagem = contagem;
        melhorGrupo = grupo;
      }
    });
    if (melhorGrupo) grupoPorCodigo.set(codigo, melhorGrupo);
  });

  let reclassificados = 0;
  const semGrupoRestante = new Set<string>();

  const resultado = data.map((r) => {
    const codigo = normalizarCodigo(r.codigo);
    const grupoAtual = normalizarGrupo(r.grupo);
    const grupoInferido = grupoPorCodigo.get(codigo);
    if (grupoInferido) {
      if (grupoAtual !== grupoInferido) reclassificados++;
      return { ...r, codigo, grupo: grupoInferido };
    }

    if (codigo && grupoSemClassificacao(grupoAtual)) semGrupoRestante.add(codigo);
    return { ...r, codigo, grupo: grupoSemClassificacao(grupoAtual) ? '' : grupoAtual };
  });

  if (reclassificados > 0 || semGrupoRestante.size > 0) {
    console.log(
      `[DRE] Reclassificação por código: ${reclassificados} registro(s) sem grupo realocados; ` +
        `${semGrupoRestante.size} código(s) permanecem sem grupo em nenhum lançamento` +
        (semGrupoRestante.size > 0 ? `: ${Array.from(semGrupoRestante).join(', ')}` : '')
    );
  }

  return resultado;
}

// Filtrar dados por código da empresa (prioriza cod_empresa_bi, fallback para empresa)
function filterByEmpresa(data: DreRecord[], codEmpresa: string): DreRecord[] {
  // Tentar filtrar por cod_empresa_bi primeiro
  if (data.length > 0 && data[0].cod_empresa_bi) {
    const filtered = data.filter(r => String(r.cod_empresa_bi) === codEmpresa);
    if (filtered.length > 0) {
      console.log(`[DRE] Filtrados ${filtered.length} registros por cod_empresa_bi=${codEmpresa}`);
      return filtered;
    }
  }
  
  // Fallback: filtrar por campo empresa (legado)
  if (data.length > 0 && data[0].empresa) {
    const filtered = data.filter(r => r.empresa === codEmpresa);
    if (filtered.length > 0) {
      console.log(`[DRE] Filtrados ${filtered.length} registros por empresa=${codEmpresa}`);
      return filtered;
    }
  }
  
  console.log(`[DRE] Nenhum filtro aplicado, retornando ${data.length} registros`);
  return data;
}

// Buscar dados do Storage do Supabase
async function fetchFromStorage(storagePath: string, codEmpresa?: string): Promise<DreRecord[]> {
  console.log(`[DRE] Buscando do storage: ${storagePath}`);
  
  const { data, error } = await supabase.storage
    .from('dados-json')
    .download(storagePath);
  
  if (error) {
    console.error('[DRE] Erro ao baixar do storage:', error);
    throw error;
  }
  
  const text = await data.text();
  const jsonData = JSON.parse(text);
  
  // Normalizar todos os registros
  const normalizedData = (Array.isArray(jsonData) ? jsonData : []).map(normalizeRecord);
  console.log(`[DRE] Carregados e normalizados ${normalizedData.length} registros do storage`);
  
  // Filtrar por empresa se especificado
  if (codEmpresa) {
    return filterByEmpresa(normalizedData, codEmpresa);
  }
  
  return normalizedData;
}

// Buscar dados JSON locais baseado no path configurado (fallback)
async function fetchLocalJson(jsonPath: string, codEmpresa?: string): Promise<DreRecord[]> {
  console.log(`[DRE] Buscando JSON local: ${jsonPath}`);
  
  const normalizedPath = jsonPath.replace(/^\//, '').replace(/\.json$/, '');
  const importKey = normalizedPath.includes('/') ? `/${normalizedPath}.json` : normalizedPath;
  
  const importer = JSON_IMPORTS[importKey] || JSON_IMPORTS[jsonPath];
  
  if (importer) {
    const module = await importer();
    const data = module.default;
    console.log(`[DRE] Carregados ${data.length} registros do JSON local`);
    
    if (codEmpresa && data.length > 0 && data[0].empresa) {
      const filtered = data.filter(r => r.empresa === codEmpresa);
      console.log(`[DRE] Filtrados ${filtered.length} registros para empresa ${codEmpresa}`);
      return filtered;
    }
    
    return data;
  }
  
  console.warn(`[DRE] JSON não encontrado: ${jsonPath}, usando fallback`);
  return dreDataLocal as DreRecord[];
}

// Verificar se URL é acessível (não é IP local/privado)
function isEndpointAccessible(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    
    // IPs privados/locais não são acessíveis de edge functions
    const privatePatterns = [
      /^10\./,           // 10.x.x.x
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16-31.x.x
      /^192\.168\./,     // 192.168.x.x
      /^127\./,          // localhost
      /^localhost$/i,
    ];
    
    return !privatePatterns.some(pattern => pattern.test(host));
  } catch {
    return false;
  }
}

// Buscar dados da DRE via storage, proxy ou fallback
// SEGURANÇA: codEmpresa é OBRIGATÓRIO para filtrar dados de não-masters
async function fetchDreData(empresa?: Empresa | null, codEmpresa?: string, isMaster?: boolean): Promise<DreRecord[]> {
  // Se módulo DRE não está habilitado, retornar vazio
  if (empresa && !empresa.modulo_dre) {
    console.log('[DRE] Módulo não habilitado para esta empresa');
    return [];
  }

  // SEGURANÇA: Se não é master E não tem código da empresa, retornar vazio
  if (!isMaster && !codEmpresa) {
    console.log('[DRE] Usuário sem empresa vinculada - retornando vazio');
    return [];
  }

  let rawData: DreRecord[] = [];
  let dataSource: 'storage' | 'local' | 'endpoint' | 'fallback' = 'fallback';
  let sourceError: unknown = null;

  // Prioridade 1: JSON no storage (upload do usuário)
  if (empresa?.json_path_dre?.startsWith('storage:')) {
    const storagePath = empresa.json_path_dre.replace('storage:', '');
    try {
      rawData = await fetchFromStorage(storagePath, codEmpresa);
      dataSource = 'storage';
      console.log(`[DRE] Carregados ${rawData.length} registros do storage`);
    } catch (error) {
      console.error('[DRE] Erro ao buscar do storage:', error);
      sourceError = error;
    }
  }
  
  // Prioridade 2: JSON local configurado (legado)
  if (rawData.length === 0 && empresa?.json_path_dre && !empresa.json_path_dre.startsWith('storage:')) {
    rawData = await fetchLocalJson(empresa.json_path_dre, codEmpresa);
    dataSource = 'local';
  }
  
  // Prioridade 3: Endpoint configurado (apenas se for acessível)
  if (rawData.length === 0 && (empresa?.usar_vps_intermediaria || (empresa?.endpoint_url && isEndpointAccessible(empresa.endpoint_url)))) {
    try {
      const endpointPath = empresa.endpoint_path_dre || '/financeiro/dre';
      console.log(`[DRE] Buscando dados via proxy para: ${empresa.endpoint_url}${endpointPath}`);
      
      const proxyUrl = buildApiProxyUrl(empresa, endpointPath);
      
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao buscar DRE: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log(`[DRE] Recebidos ${responseData.length} registros do endpoint`);
      rawData = (Array.isArray(responseData) ? responseData : []).map(normalizeRecord);
      dataSource = 'endpoint';
    } catch (error) {
      console.error('[DRE] Erro ao buscar do endpoint:', error);
      sourceError = error;
    }
  } else if (empresa?.endpoint_url) {
    console.warn('[DRE] Endpoint é IP privado/local, não acessível de edge functions');
  }
  
  // SEGURANÇA CRÍTICA: NÃO usar fallback para usuários não-master
  // O fallback só existe para desenvolvimento com masters
  if (rawData.length === 0) {
    if (sourceError) {
      throw new Error(`Falha ao carregar DRE da empresa fonte ${codEmpresa || empresa?.cod_empresa_bi || 'não definida'}: ${sourceError instanceof Error ? sourceError.message : String(sourceError)}`);
    }
    if (isMaster) {
      console.log('[DRE] Master sem dados configurados - usando dados de demonstração');
      rawData = dreDataLocal as DreRecord[];
      dataSource = 'fallback';
    } else {
      // Não-master sem dados configurados = empresa sem dados
      console.log('[DRE] SEGURANÇA: Usuário não-master sem fonte de dados configurada - retornando vazio');
      return [];
    }
  }

  // Reclassificação aplicada apenas à empresa 1001 (Caspper)
  const aplicarReclassificacao = (dados: DreRecord[]) =>
    codEmpresa === '1001' ? reclassificarGruposSemDescricao(dados) : dados;

  // SEGURANÇA CRÍTICA: SEMPRE filtrar por empresa para usuários não-master
  if (!isMaster && codEmpresa) {
    const filtered = filterByEmpresa(rawData, codEmpresa);
    console.log(`[DRE] SEGURANÇA: Filtrado para empresa ${codEmpresa}: ${filtered.length} de ${rawData.length} registros (fonte: ${dataSource})`);
    
    // Se não encontrou nenhum dado após filtrar, retornar vazio
    // NUNCA mostrar dados de outras empresas
    if (filtered.length === 0) {
      console.warn(`[DRE] SEGURANÇA: Nenhum dado encontrado para empresa ${codEmpresa}`);
    }
    
    return aplicarReclassificacao(filtered);
  }

  // Master com empresa selecionada: filtra
  if (isMaster && codEmpresa) {
    return aplicarReclassificacao(filterByEmpresa(rawData, codEmpresa));
  }

  // Master sem empresa selecionada: retorna todos (apenas masters podem ver todos)
  return rawData;
}

// Hook principal para dados da DRE - usa empresa ativa
export function useDreData() {
  const { empresa, codEmpresaAtiva, isLoading: isLoadingEmpresa, isMaster } = useEmpresaAtiva();
  const { hasSearched } = useFinanceiroSearch();

  return useQuery({
    queryKey: ['dre', codEmpresaAtiva, empresa?.endpoint_url, empresa?.json_path_dre, isMaster],
    queryFn: async () => fetchDreData(empresa, codEmpresaAtiva || undefined, isMaster),
    staleTime: 1000 * 60 * 5,
    // Carrega a base para popular as opções dos filtros; a exibição dos dados
    // continua bloqueada pelo botão Buscar (hasSearched) nas páginas.
    enabled: !isLoadingEmpresa,
  });
}



// Filtrar dados - suporta arrays de anos, meses e períodos
export function filterDreData(data: DreRecord[], filters: DreFilters): DreRecord[] {
  const { dataInicio, dataFim } = filters;

  return data.filter((record) => {
    if (filters.empresa && record.empresa !== filters.empresa) return false;
    
    // Filtro de períodos (múltiplos)
    if (filters.anoMes && filters.anoMes.length > 0) {
      if (!filters.anoMes.includes(record.ano_mes)) return false;
    }
    
    // Filtro de anos (múltiplos)
    if (filters.anos && filters.anos.length > 0) {
      const ano = record.ano_mes.substring(0, 4);
      if (!filters.anos.includes(ano)) return false;
    }
    
    // Filtro de meses (múltiplos)
    if (filters.meses && filters.meses.length > 0) {
      const mes = record.ano_mes.substring(5, 7);
      if (!filters.meses.includes(mes)) return false;
    }

    if (dataInicio || dataFim) {
      const inicioMes = `${record.ano_mes}-01`;
      const [ano, mes] = record.ano_mes.split('-').map(Number);
      const fimMes = `${record.ano_mes}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`;
      if (dataInicio && fimMes < dataInicio) return false;
      if (dataFim && inicioMes > dataFim) return false;
    }
    
    // Filtro de códigos/números de conta (múltiplos)
    if (filters.codigos && filters.codigos.length > 0) {
      if (!filters.codigos.includes(record.codigo)) return false;
    }
    
    // Filtro de grupos (múltiplos)
    if (filters.grupos && filters.grupos.length > 0) {
      if (!filters.grupos.includes(record.grupo)) return false;
    }

    // Filtros de vendedor/empresa-vendedor (1001) aplicam-se APENAS aos grupos
    // ligados à receita bruta e CMV. Demais grupos (despesas, tributos, financeiro,
    // resultado etc.) não possuem rastreio por vendedor no JSON de origem e devem
    // permanecer com seus valores originais, sem serem filtrados.
    const grupoNormalizado = (record.grupo || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    const gruposComVendedor = new Set([
      'receitas',
      '(-) deducoes de receita',
      'custo de vendas de mercadorias',
    ]);
    const aplicaFiltrosVendedor = gruposComVendedor.has(grupoNormalizado);

    if (aplicaFiltrosVendedor) {
      // Filtro de Vendedor Interno (múltiplo, 1001)
      if (filters.vendedoresInternos && filters.vendedoresInternos.length > 0) {
        const v = record.Vendedor_Interno;
        const key = v == null || (typeof v === 'string' && v.trim() === '') ? '__SEM__' : String(v);
        if (!filters.vendedoresInternos.includes(key)) return false;
      }

      // Filtro de Vendedor Externo (múltiplo, 1001)
      if (filters.vendedoresExternos && filters.vendedoresExternos.length > 0) {
        const v = record.Vendedor_Externo;
        const key = v == null || (typeof v === 'string' && v.trim() === '') ? '__SEM__' : String(v);
        if (!filters.vendedoresExternos.includes(key)) return false;
      }

      // Filtro de Empresa do Vendedor Interno (múltiplo, 1001)
      if (filters.empresasVendedorInterno && filters.empresasVendedorInterno.length > 0) {
        const v = record.Empresa_Vendedor_Interno;
        const key = v == null || (typeof v === 'string' && v.trim() === '') ? '__SEM__' : String(v);
        if (!filters.empresasVendedorInterno.includes(key)) return false;
      }

      // Filtro de Empresa do Vendedor Externo (múltiplo, 1001)
      if (filters.empresasVendedorExterno && filters.empresasVendedorExterno.length > 0) {
        const v = record.Empresa_Vendedor_Externo;
        const key = v == null || (typeof v === 'string' && v.trim() === '') ? '__SEM__' : String(v);
        if (!filters.empresasVendedorExterno.includes(key)) return false;
      }
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      const matchDescricao = record.descricao.toLowerCase().includes(term);
      const matchCodigo = record.codigo.toLowerCase().includes(term);
      if (!matchDescricao && !matchCodigo) return false;
    }
    return true;
  });
}

// Extrair valores únicos para filtros
export function extractFilterOptions(data: DreRecord[]) {
  const empresas = [...new Set(data.map((r) => r.empresa))].sort();
  const periodos = [...new Set(data.map((r) => r.ano_mes))].sort().reverse();
  const anos = [...new Set(data.map((r) => r.ano_mes.substring(0, 4)))].sort().reverse();
  const grupos = [...new Set(data.map((r) => r.grupo))].sort();
  const codigos = [...new Set(data.map((r) => r.codigo))].sort();

  // Mapa de código para descrição (pegar a primeira descrição encontrada para cada código)
  const codigoDescricaoMap = new Map<string, string>();
  for (const record of data) {
    if (!codigoDescricaoMap.has(record.codigo)) {
      codigoDescricaoMap.set(record.codigo, record.descricao);
    }
  }

  // Vendedores (empresa 1001) — valores únicos, com sentinela para nulos/vazios
  const collectVendedores = (getter: (r: DreRecord) => unknown): string[] => {
    const set = new Set<string>();
    let hasEmpty = false;
    for (const r of data) {
      const v = getter(r);
      if (v == null || (typeof v === 'string' && v.trim() === '')) {
        hasEmpty = true;
      } else {
        set.add(String(v));
      }
    }
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return hasEmpty ? ['__SEM__', ...sorted] : sorted;
  };
  const vendedoresInternos = collectVendedores((r) => r.Vendedor_Interno);
  const vendedoresExternos = collectVendedores((r) => r.Vendedor_Externo);
  const empresasVendedorInterno = collectVendedores((r) => r.Empresa_Vendedor_Interno);
  const empresasVendedorExterno = collectVendedores((r) => r.Empresa_Vendedor_Externo);

  return { empresas, periodos, anos, grupos, codigos, codigoDescricaoMap, vendedoresInternos, vendedoresExternos, empresasVendedorInterno, empresasVendedorExterno };
}

// Construir hierarquia a partir dos dados - ORDENAR POR ORDEM, RESPEITAR NIVEL
export function buildDreHierarchy(data: DreRecord[]): DreHierarchyNode[] {
  // IMPORTANTE: Ordenar SEMPRE por 'ordem', nunca por valor
  const sorted = [...data].sort((a, b) => a.ordem - b.ordem);
  
  const hierarchy: DreHierarchyNode[] = [];
  const stack: DreHierarchyNode[] = [];
  
  for (const record of sorted) {
    const node: DreHierarchyNode = {
      record,
      children: [],
      isExpanded: record.nivel <= 1,
      depth: record.nivel,
    };
    
    // Encontrar o pai apropriado baseado no nível
    while (stack.length > 0 && stack[stack.length - 1].record.nivel >= record.nivel) {
      stack.pop();
    }
    
    if (stack.length === 0) {
      hierarchy.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    
    stack.push(node);
  }
  
  return hierarchy;
}

// Flatten da hierarquia para exibição em tabela - mantém ordem original
export function flattenHierarchy(
  nodes: DreHierarchyNode[],
  expandedKeys: Set<string>
): DreHierarchyNode[] {
  const result: DreHierarchyNode[] = [];
  
  function traverse(nodes: DreHierarchyNode[]) {
    for (const node of nodes) {
      result.push(node);
      const key = `${node.record.codigo}-${node.record.ordem}`;
      if (expandedKeys.has(key) && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  
  traverse(nodes);
  return result;
}

// Calcular sumário por grupo - usa folhas + transformação de sinal compartilhada
export function calculateGroupSummary(data: DreRecord[]): DreGroupSummary[] {
  const grupos = new Map<string, { total: number; itens: number }>();
  const recordsParaAgregar = getLeafRecords(data);

  for (const record of recordsParaAgregar) {
    const valor = getTransformedValue(record);
    const existing = grupos.get(record.grupo) || { total: 0, itens: 0 };
    grupos.set(record.grupo, {
      total: existing.total + valor,
      itens: existing.itens + 1,
    });
  }

  const totalGeral = Array.from(grupos.values()).reduce((sum, g) => sum + Math.abs(g.total), 0);

  return Array.from(grupos.entries())
    .map(([grupo, { total, itens }]) => ({
      grupo,
      total,
      percentualDoTotal: totalGeral > 0 ? (Math.abs(total) / totalGeral) * 100 : 0,
      itens,
    }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

// Calcular indicadores principais baseado na estrutura contábil da DRE
export function calculateIndicators(data: DreRecord[]): DreIndicator[] {
  const recordsDetalhados = getLeafRecords(data);

  let totalReceitas = 0;
  let totalCustos = 0;
  let totalDespesas = 0;

  for (const record of recordsDetalhados) {
    const valor = getTransformedValue(record);
    const grupoLower = record.grupo.toLowerCase();

    if (grupoLower.includes('receita') && !grupoLower.includes('financeiro')) {
      totalReceitas += valor;
    } else if (grupoLower.includes('custo')) {
      totalCustos += valor;
    } else if (grupoLower.includes('despesa') && !grupoLower.includes('financeiro')) {
      totalDespesas += valor;
    }
  }

  const resultado = recordsDetalhados.reduce((sum, r) => sum + getTransformedValue(r), 0);

  return [
    {
      label: 'Receita Bruta',
      value: totalReceitas,
      color: totalReceitas >= 0 ? 'positive' : 'negative',
      trend: 'stable',
    },
    {
      label: 'Custos',
      value: totalCustos,
      color: 'negative',
      trend: 'stable',
    },
    {
      label: 'Despesas',
      value: totalDespesas,
      color: 'negative',
      trend: 'stable',
    },
    {
      label: 'Resultado',
      value: resultado,
      color: resultado >= 0 ? 'positive' : 'negative',
      trend: resultado >= 0 ? 'up' : 'down',
    },
  ];
}

// Calcular variações entre períodos
export function calculateVariations(
  dataAtual: DreRecord[],
  dataAnterior: DreRecord[]
): DreVariation[] {
  const variations: DreVariation[] = [];

  const anteriorMap = new Map<string, number>();
  for (const record of dataAnterior) {
    anteriorMap.set(record.codigo, record.valor);
  }

  for (const record of dataAtual) {
    const valorAnterior = anteriorMap.get(record.codigo) || 0;
    const variacaoAbsoluta = record.valor - valorAnterior;
    const variacaoPercentual = valorAnterior !== 0
      ? ((record.valor - valorAnterior) / Math.abs(valorAnterior)) * 100
      : null;

    variations.push({
      record,
      valorAtual: record.valor,
      valorAnterior,
      variacaoAbsoluta,
      variacaoPercentual,
    });
  }

  return variations;
}

// Agregar dados por período
export function aggregateByPeriod(data: DreRecord[], periodo: 'mensal' | 'anual'): DreRecord[] {
  if (periodo === 'mensal') return data;
  
  const aggregated = new Map<string, DreRecord>();
  
  for (const record of data) {
    const ano = record.ano_mes.substring(0, 4);
    const key = `${record.codigo}-${ano}`;
    
    const existing = aggregated.get(key);
    if (existing) {
      aggregated.set(key, {
        ...existing,
        valor: existing.valor + record.valor,
      });
    } else {
      aggregated.set(key, {
        ...record,
        ano_mes: ano,
      });
    }
  }
  
  return Array.from(aggregated.values());
}
