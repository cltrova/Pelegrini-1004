import { useQuery } from '@tanstack/react-query';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';
import { useMemo } from 'react';
import { VariacaoRecord, DFCLinha, DFCData, FluxoCaixaGrupo, FluxoCaixaTotais, DFCContaDetalhe } from '@/types/variacao';
import { DreRecord } from '@/types/dre';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { Empresa } from '@/hooks/useEmpresaConfig';
import { supabase } from '@/integrations/supabase/client';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import variacaoDataLocal from '@/data/variacaoData.json';
import dreDataLocal from '@/data/dreData.json';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';

// Mapeamento de nomes de JSON para imports locais - Variação
const VARIACAO_JSON_IMPORTS: Record<string, () => Promise<{ default: VariacaoRecord[] }>> = {
  'variacaoData': () => Promise.resolve({ default: variacaoDataLocal as VariacaoRecord[] }),
  '/data/variacaoData.json': () => Promise.resolve({ default: variacaoDataLocal as VariacaoRecord[] }),
};

// Mapeamento de nomes de JSON para imports locais - DRE (para DFC)
const DRE_JSON_IMPORTS: Record<string, () => Promise<{ default: DreRecord[] }>> = {
  'dreData': () => Promise.resolve({ default: dreDataLocal as DreRecord[] }),
  '/data/dreData.json': () => Promise.resolve({ default: dreDataLocal as DreRecord[] }),
};

const isValidAnoMes = (anoMes: unknown): anoMes is string => {
  const value = String(anoMes ?? '');
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const year = Number(value.substring(0, 4));
  const month = Number(value.substring(5, 7));
  const maxAllowedYear = new Date().getFullYear() + 1;
  return year >= 2000 && year <= maxAllowedYear && month >= 1 && month <= 12;
};

// Buscar dados do Storage - Variação
async function fetchVariacaoFromStorage(storagePath: string, codEmpresa?: string): Promise<VariacaoRecord[]> {
  console.log(`[Variação] Buscando do storage: ${storagePath}`);
  
  const { data, error } = await supabase.storage
    .from('dados-json')
    .download(storagePath);
  
  if (error) {
    console.error('[Variação] Erro ao baixar do storage:', error);
    throw error;
  }
  
  const text = await data.text();
  const jsonData = JSON.parse(text) as VariacaoRecord[];
  console.log(`[Variação] Carregados ${jsonData.length} registros do storage`);
  
  if (codEmpresa && jsonData.length > 0) {
    const filtered = jsonData.filter(r => 
      String(r.CodEmpresa_bi) === codEmpresa || 
      String(r.CodEmpresa) === codEmpresa ||
      r.Empresa === codEmpresa
    );
    console.log(`[Variação] Filtrados ${filtered.length} registros para empresa ${codEmpresa}`);
    return filtered;
  }
  
  return jsonData;
}

// Normalizar campos do JSON de DRE para o formato esperado
function normalizeDreRecord(record: any): DreRecord {
  return {
    ...record,
    cod_empresa_bi: String(record.cod_empresa_bi ?? record.CodEmpresa_bi ?? record.codEmpresa_bi ?? ''),
    empresa: String(record.empresa ?? record.Empresa ?? ''),
    ano_mes: String(record.ano_mes ?? record.AnoMes ?? record.periodo ?? record.Periodo ?? ''),
    nivel: Number(record.nivel ?? record.Nivel ?? 0),
    codigo: String(record.codigo ?? record.NumConta ?? record.numConta ?? ''),
    descricao: String(record.descricao ?? record.Descricao ?? ''),
    grupo: String(record.grupo ?? record.Grupo ?? ''),
    valor: Number(record.valor ?? record.Valor ?? 0),
    ordem: Number(record.ordem ?? record.Ordem ?? 0),
  };
}

// Filtrar dados DRE por código da empresa
function filterDreByEmpresa(data: DreRecord[], codEmpresa: string): DreRecord[] {
  const normalizedCode = String(codEmpresa).trim();
  const filteredByBiCode = data.filter(r => String(r.cod_empresa_bi ?? '').trim() === normalizedCode);
  if (filteredByBiCode.length > 0) {
    console.log(`[DRE-DFC] Filtrados ${filteredByBiCode.length} registros por cod_empresa_bi=${codEmpresa}`);
    return filteredByBiCode;
  }
  
  const filteredByEmpresa = data.filter(r => String(r.empresa ?? '').trim() === normalizedCode);
  if (filteredByEmpresa.length > 0) {
    console.log(`[DRE-DFC] Filtrados ${filteredByEmpresa.length} registros por empresa=${codEmpresa}`);
    return filteredByEmpresa;
  }
  
  console.warn(`[DRE-DFC] Nenhum registro casou com empresa ${codEmpresa}. Retornando base sem filtro (${data.length}) para evitar zerar indevidamente.`);
  return data;
}

// Buscar dados do Storage - DRE (para DFC)
async function fetchDreFromStorage(storagePath: string, codEmpresa?: string): Promise<DreRecord[]> {
  console.log(`[DRE-DFC] Buscando do storage: ${storagePath}`);
  
  const { data, error } = await supabase.storage
    .from('dados-json')
    .download(storagePath);
  
  if (error) {
    console.error('[DRE-DFC] Erro ao baixar do storage:', error);
    throw error;
  }
  
  const text = await data.text();
  const jsonData = JSON.parse(text);
  
  const normalizedData = (Array.isArray(jsonData) ? jsonData : []).map(normalizeDreRecord);
  console.log(`[DRE-DFC] Carregados e normalizados ${normalizedData.length} registros do storage`);
  
  if (codEmpresa) {
    return filterDreByEmpresa(normalizedData, codEmpresa);
  }
  
  return normalizedData;
}

// Buscar dados JSON locais para Variação (fallback)
async function fetchLocalVariacaoJson(jsonPath: string, codEmpresa?: string): Promise<VariacaoRecord[]> {
  console.log(`[Variação] Buscando JSON local: ${jsonPath}`);
  
  const normalizedPath = jsonPath.replace(/^\//, '').replace(/\.json$/, '');
  const importKey = normalizedPath.includes('/') ? `/${normalizedPath}.json` : normalizedPath;
  
  const importer = VARIACAO_JSON_IMPORTS[importKey] || VARIACAO_JSON_IMPORTS[jsonPath];
  
  if (importer) {
    const module = await importer();
    const data = module.default;
    console.log(`[Variação] Carregados ${data.length} registros do JSON local`);
    
    if (codEmpresa && data.length > 0) {
      const filtered = data.filter(r => 
        String(r.CodEmpresa_bi) === codEmpresa || 
        String(r.CodEmpresa) === codEmpresa ||
        r.Empresa === codEmpresa
      );
      console.log(`[Variação] Filtrados ${filtered.length} registros para empresa ${codEmpresa}`);
      return filtered;
    }
    
    return data;
  }
  
  console.warn(`[Variação] JSON não encontrado: ${jsonPath}, usando fallback`);
  return variacaoDataLocal as VariacaoRecord[];
}

// Buscar dados JSON locais para DRE (usado no DFC - fallback)
async function fetchLocalDreJson(jsonPath: string, codEmpresa?: string): Promise<DreRecord[]> {
  console.log(`[DRE-DFC] Buscando JSON local: ${jsonPath}`);
  
  const normalizedPath = jsonPath.replace(/^\//, '').replace(/\.json$/, '');
  const importKey = normalizedPath.includes('/') ? `/${normalizedPath}.json` : normalizedPath;
  
  const importer = DRE_JSON_IMPORTS[importKey] || DRE_JSON_IMPORTS[jsonPath];
  
  if (importer) {
    const module = await importer();
    const data = module.default.map(normalizeDreRecord);
    console.log(`[DRE-DFC] Carregados ${data.length} registros do JSON local`);
    
    if (codEmpresa) {
      return filterDreByEmpresa(data, codEmpresa);
    }
    
    return data;
  }
  
  console.warn(`[DRE-DFC] JSON não encontrado: ${jsonPath}, usando fallback`);
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

// Buscar dados de Variação via storage, proxy ou fallback
// SEGURANÇA: codEmpresa é OBRIGATÓRIO para filtrar dados de não-masters
async function fetchVariacaoData(empresa?: Empresa | null, codEmpresa?: string, isMaster?: boolean, ignoreModuleDisabled = false): Promise<VariacaoRecord[]> {
  // Se módulo variação não está habilitado, retornar vazio
  if (empresa && !empresa.modulo_variacao && !ignoreModuleDisabled) {
    console.log('[Variação] Módulo não habilitado para esta empresa');
    return [];
  }

  // SEGURANÇA: Se não é master E não tem código da empresa, retornar vazio
  if (!isMaster && !codEmpresa) {
    console.log('[Variação] Usuário sem empresa vinculada - retornando vazio');
    return [];
  }

  let rawData: VariacaoRecord[] = [];
  let dataSource: 'storage' | 'local' | 'endpoint' | 'fallback' = 'fallback';
  let sourceError: unknown = null;

  // Prioridade 1: JSON no storage (upload do usuário)
  if (empresa?.json_path_variacao?.startsWith('storage:')) {
    const storagePath = empresa.json_path_variacao.replace('storage:', '');
    try {
      rawData = await fetchVariacaoFromStorage(storagePath, codEmpresa);
      dataSource = 'storage';
      console.log(`[Variação] Carregados ${rawData.length} registros do storage`);
    } catch (error) {
      console.error('[Variação] Erro ao buscar do storage:', error);
      sourceError = error;
    }
  }
  
  // Prioridade 2: JSON local configurado (legado)
  if (rawData.length === 0 && empresa?.json_path_variacao && !empresa.json_path_variacao.startsWith('storage:')) {
    rawData = await fetchLocalVariacaoJson(empresa.json_path_variacao, codEmpresa);
    dataSource = 'local';
  }
  
  // Prioridade 3: Endpoint configurado (apenas se for acessível)
  if (rawData.length === 0 && (empresa?.usar_vps_intermediaria || (empresa?.endpoint_url && isEndpointAccessible(empresa.endpoint_url)))) {
    try {
      const endpointPath = empresa.endpoint_path_variacao || '/financeiro/variacao';
      console.log(`[Variação] Buscando dados via proxy para: ${empresa.endpoint_url}${endpointPath}`);
      
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
        throw new Error(errorData.error || `Erro ao buscar Variação: ${response.status}`);
      }
      
      rawData = await response.json();
      dataSource = 'endpoint';
      console.log(`[Variação] Recebidos ${rawData.length} registros do endpoint`);
    } catch (error) {
      console.error('[Variação] Erro ao buscar do endpoint:', error);
      sourceError = error;
    }
  } else if (empresa?.endpoint_url) {
    console.warn('[Variação] Endpoint é IP privado/local, não acessível de edge functions');
  }
  
  // SEGURANÇA CRÍTICA: NÃO usar fallback para usuários não-master
  // O fallback só existe para desenvolvimento com masters
  if (rawData.length === 0) {
    if (sourceError) {
      throw new Error(`Falha ao carregar Variação da empresa fonte ${codEmpresa || empresa?.cod_empresa_bi || 'não definida'}: ${sourceError instanceof Error ? sourceError.message : String(sourceError)}`);
    }
    if (isMaster) {
      console.log('[Variação] Master sem dados configurados - usando dados de demonstração');
      rawData = variacaoDataLocal as VariacaoRecord[];
      dataSource = 'fallback';
    } else {
      // Não-master sem dados configurados = empresa sem dados
      console.log('[Variação] SEGURANÇA: Usuário não-master sem fonte de dados configurada - retornando vazio');
      return [];
    }
  }

  // SEGURANÇA CRÍTICA: SEMPRE filtrar por empresa para usuários não-master
  if (!isMaster && codEmpresa) {
    const filtered = rawData.filter(r => 
      r.Empresa === codEmpresa || 
      String(r.CodEmpresa_bi) === codEmpresa ||
      String(r.CodEmpresa) === codEmpresa
    );
    console.log(`[Variação] SEGURANÇA: Filtrado para empresa ${codEmpresa}: ${filtered.length} de ${rawData.length} registros (fonte: ${dataSource})`);
    
    // Se não encontrou nenhum dado após filtrar, retornar vazio
    if (filtered.length === 0) {
      console.warn(`[Variação] SEGURANÇA: Nenhum dado encontrado para empresa ${codEmpresa}`);
    }
    
    return filtered;
  }

  // Master com empresa selecionada: filtra
  if (isMaster && codEmpresa) {
    return rawData.filter(r => 
      r.Empresa === codEmpresa || 
      String(r.CodEmpresa_bi) === codEmpresa ||
      String(r.CodEmpresa) === codEmpresa
    );
  }

  // Master sem empresa selecionada: retorna todos (apenas masters podem ver todos)
  return rawData;
}

// Buscar dados da DRE via storage, proxy ou fallback (para DFC)
async function fetchDreDataForDFC(empresa?: Empresa | null, codEmpresa?: string): Promise<DreRecord[]> {
  let sourceError: unknown = null;

  // Prioridade 1: JSON no storage (upload do usuário)
  if (empresa?.json_path_dre?.startsWith('storage:')) {
    const storagePath = empresa.json_path_dre.replace('storage:', '');
    try {
      return await fetchDreFromStorage(storagePath, codEmpresa);
    } catch (error) {
      console.error('[DRE-DFC] Erro ao buscar do storage:', error);
      sourceError = error;
    }
  }
  
  // Prioridade 2: JSON local configurado (legado)
  if (empresa?.json_path_dre && !empresa.json_path_dre.startsWith('storage:')) {
    return fetchLocalDreJson(empresa.json_path_dre, codEmpresa);
  }
  
  // Prioridade 3: Endpoint configurado
  if (empresa?.endpoint_url) {
    try {
      const endpointPath = empresa.endpoint_path_dre || '/financeiro/dre';
      console.log(`[DRE-DFC] Buscando dados via proxy para: ${empresa.endpoint_url}${endpointPath}`);
      
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
      const data = (Array.isArray(responseData) ? responseData : []).map(normalizeDreRecord);
      console.log(`[DRE-DFC] Recebidos e normalizados ${data.length} registros do endpoint`);
      
      if (codEmpresa) {
        return filterDreByEmpresa(data, codEmpresa);
      }
      
      return data;
    } catch (error) {
      console.error('[DRE-DFC] Erro ao buscar do endpoint:', error);
      sourceError = error;
    }
  }

  if (sourceError) {
    throw new Error(`Falha ao carregar DRE/DFC da empresa fonte ${codEmpresa || empresa?.cod_empresa_bi || 'não definida'}: ${sourceError instanceof Error ? sourceError.message : String(sourceError)}`);
  }

  throw new Error(`Nenhuma fonte de dados configurada para DRE/DFC na empresa fonte ${codEmpresa || empresa?.cod_empresa_bi || 'não definida'}`);
}

// Hook principal para dados de Variação - usa empresa ativa
export function useVariacaoData() {
  const { empresa, codEmpresaAtiva, isLoading: isLoadingEmpresa, isMaster } = useEmpresaAtiva();
  const { hasSearched } = useFinanceiroSearch();

  return useQuery({
    queryKey: ['variacao', codEmpresaAtiva, empresa?.endpoint_url, empresa?.json_path_variacao, isMaster],
    queryFn: async () => fetchVariacaoData(empresa, codEmpresaAtiva || undefined, isMaster),
    staleTime: 1000 * 60 * 5,
    enabled: !isLoadingEmpresa,
  });
}

// Hook para dados da DRE usados no DFC - usa empresa ativa
export function useDreDataForDFC() {
  const { empresa, codEmpresaAtiva, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const { hasSearched } = useFinanceiroSearch();

  return useQuery({
    queryKey: ['dre-dfc', codEmpresaAtiva, empresa?.endpoint_url, empresa?.endpoint_path_dre, empresa?.json_path_dre],
    queryFn: async () => fetchDreDataForDFC(empresa, codEmpresaAtiva || undefined),
    staleTime: 1000 * 60 * 5,
    enabled: !isLoadingEmpresa,
  });
}

// Contas excluídas do cálculo da DRE para a página de Variação
const CONTAS_EXCLUIDAS_DRE = [
  '2.3.3.01.01.00003',
  '1.1.2.07.01.00001',
  '1.1.2.07.01.00002'
];

/**
 * Calcula o Resultado da DRE acumulado de janeiro até o mês especificado
 * Filtra por empresa se especificada
 * Exclui contas específicas definidas em CONTAS_EXCLUIDAS_DRE
 */
const normalizeEmpresaKey = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export function calcularResultadoDRE(
  dreData: DreRecord[],
  ano: string,
  mesAte: string,
  empresa?: string
): number {
  // Filtrar por empresa se especificada (casamento tolerante entre fontes DRE x Variação)
  let filteredData = dreData;
  if (empresa) {
    const alvo = normalizeEmpresaKey(empresa);
    const match = dreData.filter(r =>
      normalizeEmpresaKey(r.empresa) === alvo ||
      normalizeEmpresaKey(r.cod_empresa_bi) === alvo ||
      normalizeEmpresaKey((r as Record<string, unknown>).codEmpresa) === alvo ||
      normalizeEmpresaKey((r as Record<string, unknown>).CodEmpresa) === alvo
    );

    if (match.length > 0) {
      filteredData = match;
    } else {
      // A base da DRE já vem filtrada pela empresa ativa; não zerar o Resultado Líquido.
      console.warn(
        `[DFC/Resultado Líquido] Filtro de empresa "${empresa}" não casou com nenhum registro da DRE. ` +
        `Valores distintos na DRE: ${[...new Set(dreData.map(r => r.empresa))].slice(0, 10).join(' | ')}. ` +
        `Usando a base já filtrada pela empresa ativa (${dreData.length} registros).`
      );
    }
  }

  // Excluir contas específicas
  filteredData = filteredData.filter(r => !CONTAS_EXCLUIDAS_DRE.includes(r.codigo));

  // Filtrar pelo ano e meses até o mês especificado
  const recordsNoPeriodo = filteredData.filter(r => {
    if (!r.ano_mes?.startsWith(ano)) return false;
    const mesRecord = r.ano_mes.substring(5, 7);
    return mesRecord <= mesAte;
  });

  // Encontrar o nível mais detalhado para somar
  const niveis = [...new Set(recordsNoPeriodo.map(r => r.nivel))].sort((a, b) => b - a);
  const nivelMaisDetalhado = niveis[0] || 0;
  const recordsDetalhados = recordsNoPeriodo.filter(r => r.nivel === nivelMaisDetalhado);

  // Calcular resultado (soma de todos os valores do nível mais detalhado)
  const resultado = recordsDetalhados.reduce((sum, r) => sum + r.valor, 0);

  console.log(
    `[DFC/Resultado Líquido] empresaFiltro=${empresa || '(todas)'} | período=${ano}-01..${ano}-${mesAte} | ` +
    `registros: base=${dreData.length} pósEmpresa=${filteredData.length} noPeríodo=${recordsNoPeriodo.length} ` +
    `nívelDetalhe=${nivelMaisDetalhado} (${recordsDetalhados.length}) | resultado=${resultado}`
  );

  return resultado;
}

// Extrair opções de filtros
export function extractVariacaoFilterOptions(data: VariacaoRecord[]) {
  const empresas = [...new Set(data.map((r) => r.Empresa))].sort();
  const anos = [...new Set(data
    .filter((r) => isValidAnoMes(r.ano_mes))
    .map((r) => r.ano_mes.substring(0, 4)))].sort().reverse();
  const grupos = [...new Set(data.map((r) => r.Grupo))].filter(g => g && g !== 'Sem Descrição').sort();
  
  return { empresas, anos, grupos };
}

// Filtrar dados por empresa
export function filterVariacaoByEmpresa(data: VariacaoRecord[], empresa?: string): VariacaoRecord[] {
  if (!empresa) return data;
  return data.filter(r => 
    String(r.CodEmpresa_bi) === empresa || 
    String(r.CodEmpresa) === empresa ||
    r.Empresa === empresa
  );
}

/**
 * Calcula soma de valores até um determinado mês (jan até o mês especificado)
 * Similar à lógica DAX do Power BI
 */
function calcularAcumuladoAteMes(data: VariacaoRecord[], ano: string, mesAte: string, grupo: string): number {
  const inicio = `${ano}-01`;
  const limite = `${ano}-${mesAte}`;
  return data
    .filter(r => r.Grupo === grupo && r.ano_mes >= inicio && r.ano_mes <= limite)
    .reduce((sum, r) => sum + r.Valor, 0);
}

/**
 * Calcula o Saldo Anterior: soma de TODOS os lançamentos de um grupo
 * com ano_mes ANTERIOR ao início do período selecionado (tudo antes de {ano}-01).
 * Implementa o conceito contábil correto de saldo acumulado histórico.
 */
function calcularSaldoAnterior(data: VariacaoRecord[], ano: string, grupo: string): number {
  const anoMesInicio = `${ano}-01`;
  return data
    .filter(r => r.Grupo === grupo && r.ano_mes < anoMesInicio)
    .reduce((sum, r) => sum + r.Valor, 0);
}

/**
 * Obtém detalhes das contas para o Saldo Anterior (tudo antes do ano selecionado).
 * Agrupa por NumConta e soma todos os valores históricos anteriores ao período.
 */
function obterContasDetalhesSaldoAnterior(
  data: VariacaoRecord[],
  anoPeriodo1: string,
  anoPeriodo2: string,
  grupo: string
): DFCContaDetalhe[] {
  const limiteP1 = `${anoPeriodo1}-01`;
  const limiteP2 = `${anoPeriodo2}-01`;
  
  const registros = data.filter(r => r.Grupo === grupo);
  const contasMap = new Map<string, { numConta: string; descricao: string; valorP1: number; valorP2: number }>();
  
  registros.forEach(r => {
    const existing = contasMap.get(r.NumConta) || {
      numConta: r.NumConta,
      descricao: r.Descricao,
      valorP1: 0,
      valorP2: 0,
    };
    if (r.ano_mes < limiteP1) existing.valorP1 += r.Valor;
    if (r.ano_mes < limiteP2) existing.valorP2 += r.Valor;
    contasMap.set(r.NumConta, existing);
  });
  
  return Array.from(contasMap.values())
    .filter(c => c.valorP1 !== 0 || c.valorP2 !== 0)
    .map(c => ({
      numConta: c.numConta,
      descricao: c.descricao,
      valorPeriodo1: c.valorP1,
      valorPeriodo2: c.valorP2,
      valorVariacao: c.valorP2 - c.valorP1,
      variacao: c.valorP1 !== 0 ? ((c.valorP2 - c.valorP1) / Math.abs(c.valorP1)) * 100 : null,
    }))
    .sort((a, b) => a.numConta.localeCompare(b.numConta));
}

/**
 * Obtém detalhes das contas para Caixa no Final do Exercício.
 * Para cada conta, acumula TODOS os registros até o limite do período filtrado.
 * Replica exatamente o cálculo da View: soma de tudo até aquela data.
 */
function obterContasDetalhesCaixaFinal(
  data: VariacaoRecord[],
  anoPeriodo1: string,
  mesPeriodo1: string,
  anoPeriodo2: string,
  mesPeriodo2: string,
  grupo: string
): DFCContaDetalhe[] {
  const limiteP1 = `${anoPeriodo1}-${mesPeriodo1}`;
  const limiteP2 = `${anoPeriodo2}-${mesPeriodo2}`;
  
  const contasMap = new Map<string, {
    numConta: string;
    descricao: string;
    acumuladoP1: number;
    acumuladoP2: number;
  }>();
  
  const registrosGrupo = data.filter(r => r.Grupo === grupo);
  
  registrosGrupo.forEach(r => {
    const existing = contasMap.get(r.NumConta) || {
      numConta: r.NumConta,
      descricao: r.Descricao,
      acumuladoP1: 0,
      acumuladoP2: 0,
    };
    
    // Acumula tudo até o limite de cada período (histórico + ano corrente)
    if (r.ano_mes <= limiteP1) {
      existing.acumuladoP1 += r.Valor;
    }
    if (r.ano_mes <= limiteP2) {
      existing.acumuladoP2 += r.Valor;
    }
    
    contasMap.set(r.NumConta, existing);
  });
  
  return Array.from(contasMap.values())
    .map(c => ({
      numConta: c.numConta,
      descricao: c.descricao,
      valorPeriodo1: c.acumuladoP1,
      valorPeriodo2: c.acumuladoP2,
      valorVariacao: c.acumuladoP2 - c.acumuladoP1,
      variacao: c.acumuladoP1 !== 0 ? ((c.acumuladoP2 - c.acumuladoP1) / Math.abs(c.acumuladoP1)) * 100 : null,
    }))
    .filter(c => c.valorPeriodo1 !== 0 || c.valorPeriodo2 !== 0)
    .sort((a, b) => a.numConta.localeCompare(b.numConta));
}

/**
 * Obtém detalhes das contas por grupo, agrupando por NumConta
 */
function obterContasDetalhes(
  data: VariacaoRecord[], 
  anoPeriodo1: string, 
  mesPeriodo1: string, 
  anoPeriodo2: string,
  mesPeriodo2: string, 
  grupo: string
): DFCContaDetalhe[] {
  // Filtrar registros do grupo de ambos os anos
  const registrosGrupo = data.filter(r => r.Grupo === grupo);
  
  // Agrupar por NumConta
  const contasMap = new Map<string, { 
    numConta: string; 
    descricao: string; 
    valorP1: number; 
    valorP2: number;
  }>();
  
  const inicioP1 = `${anoPeriodo1}-01`;
  const limiteP1 = `${anoPeriodo1}-${mesPeriodo1}`;
  const inicioP2 = `${anoPeriodo2}-01`;
  const limiteP2 = `${anoPeriodo2}-${mesPeriodo2}`;

  registrosGrupo.forEach(r => {
    const existing = contasMap.get(r.NumConta) || { 
      numConta: r.NumConta, 
      descricao: r.Descricao,
      valorP1: 0, 
      valorP2: 0 
    };
    
    if (r.ano_mes >= inicioP1 && r.ano_mes <= limiteP1) {
      existing.valorP1 += r.Valor;
    }
    if (r.ano_mes >= inicioP2 && r.ano_mes <= limiteP2) {
      existing.valorP2 += r.Valor;
    }
    
    contasMap.set(r.NumConta, existing);
  });
  
  // Converter para array e calcular variação
  return Array.from(contasMap.values())
    .filter(c => c.valorP1 !== 0 || c.valorP2 !== 0)
    .map(c => ({
      numConta: c.numConta,
      descricao: c.descricao,
      valorPeriodo1: c.valorP1,
      valorPeriodo2: c.valorP2,
      valorVariacao: c.valorP2 - c.valorP1,
      variacao: c.valorP1 !== 0 ? ((c.valorP2 - c.valorP1) / Math.abs(c.valorP1)) * 100 : null,
    }))
    .sort((a, b) => a.numConta.localeCompare(b.numConta));
}

/**
 * Calcula a variação percentual entre dois valores
 */
function calcularVariacaoPercentual(valorAtual: number, valorAnterior: number): number | null {
  if (valorAnterior === 0) {
    if (valorAtual === 0) return 0;
    return null; // Divisão por zero
  }
  return ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100;
}

// Exportar defaults para uso externo (assistente, etc.)
export const DEFAULT_GRUPOS_INVERTER_SINAL = new Set([
  'Depreciação e Amortização',
  'Reversão de Provisões',
  'Ajuste credor de exercícios anteriores',
  'Variação em Fornecedores',
  'Variação em Obrigações Tributarias',
  'Variação em Dividendos a Pagar',
  'Variação em Adiantamentos Clientes',
  'Variação em Obrigações Trabalhistas e Previdenciarias',
]);

export const DEFAULT_GRUPOS_ATIVOS_OPERACIONAIS = new Set([
  'Variação em Contas a Receber',
  'Variação em Creditos Tributarios',
  'Variação em Despesas Antecipadas',
  'Variação em Adiantamentos Concedidos',
  'Variação Entre Outro Creditos',
  'Variação em Creditos Transitorios',
  'Variação em Estoques',
]);

export type DfcLinhaConfigRuntime = {
  modo: 'grupo' | 'grupo_mais_contas' | 'contas';
  grupo: string | null;
  contas: string[];
  invert_sinal?: boolean;
};

export interface DFCConfig {
  gruposInverterSinal: Set<string>;
  gruposAtivosOperacionais: Set<string>;
  /** Mapa linha_id -> configuração customizada (modo + contas extras) */
  lineConfigByLinhaId?: Map<string, DfcLinhaConfigRuntime>;
}

/**
 * Soma os valores de um conjunto de NumConta no período (ano-01 .. ano-mesAte).
 */
function calcularAcumuladoContasAteMes(
  data: VariacaoRecord[],
  ano: string,
  mesAte: string,
  contas: Set<string>
): number {
  if (contas.size === 0) return 0;
  const inicio = `${ano}-01`;
  const limite = `${ano}-${mesAte}`;
  return data
    .filter(r => contas.has(r.NumConta) && r.ano_mes >= inicio && r.ano_mes <= limite)
    .reduce((sum, r) => sum + r.Valor, 0);
}

/**
 * Detalhes de contas para um conjunto específico de NumConta (modo "contas" ou "grupo_mais_contas").
 */
function obterContasDetalhesPorNumConta(
  data: VariacaoRecord[],
  anoPeriodo1: string,
  mesPeriodo1: string,
  anoPeriodo2: string,
  mesPeriodo2: string,
  contas: Set<string>
): DFCContaDetalhe[] {
  if (contas.size === 0) return [];
  const inicioP1 = `${anoPeriodo1}-01`;
  const limiteP1 = `${anoPeriodo1}-${mesPeriodo1}`;
  const inicioP2 = `${anoPeriodo2}-01`;
  const limiteP2 = `${anoPeriodo2}-${mesPeriodo2}`;

  const contasMap = new Map<string, { numConta: string; descricao: string; valorP1: number; valorP2: number }>();
  data.forEach(r => {
    if (!contas.has(r.NumConta)) return;
    const existing = contasMap.get(r.NumConta) || {
      numConta: r.NumConta,
      descricao: r.Descricao,
      valorP1: 0,
      valorP2: 0,
    };
    if (r.ano_mes >= inicioP1 && r.ano_mes <= limiteP1) existing.valorP1 += r.Valor;
    if (r.ano_mes >= inicioP2 && r.ano_mes <= limiteP2) existing.valorP2 += r.Valor;
    contasMap.set(r.NumConta, existing);
  });
  return Array.from(contasMap.values())
    .filter(c => c.valorP1 !== 0 || c.valorP2 !== 0)
    .map(c => ({
      numConta: c.numConta,
      descricao: c.descricao,
      valorPeriodo1: c.valorP1,
      valorPeriodo2: c.valorP2,
      valorVariacao: c.valorP2 - c.valorP1,
      variacao: c.valorP1 !== 0 ? ((c.valorP2 - c.valorP1) / Math.abs(c.valorP1)) * 100 : null,
    }))
    .sort((a, b) => a.numConta.localeCompare(b.numConta));
}

// Mapeamento de grupos para a estrutura da DFC (ordem conforme o modelo)
export const ESTRUTURA_DFC = [
  // Seção 1: Fluxos de Caixa das Atividades Operacionais
  { tipo: 'titulo' as const, id: 'titulo_operacional', descricao: 'Fluxos de Caixa das Atividades Operacionais', ordem: 1 },
  { tipo: 'item' as const, id: 'resultado_liquido', descricao: 'Resultado Líquido do Exercício', ordem: 2, fonte: 'dre' },
  { tipo: 'espaco' as const, id: 'espaco_1', descricao: '', ordem: 3 },
  { tipo: 'subtitulo' as const, id: 'ajustes_titulo', descricao: 'Ajustes para conciliar o resultado às disponibilidades geradas pelas atividades operacionais', ordem: 4 },
  { tipo: 'item' as const, id: 'depreciacao', descricao: 'Depreciação e Amortização', ordem: 5, grupo: 'Depreciação e Amortização' },
  { tipo: 'item' as const, id: 'juros', descricao: 'Juros Transcorridos e Não Pagos', ordem: 6, grupo: 'Juros Transcorridos e Não Pagos' },
  { tipo: 'item' as const, id: 'reversao_provisoes', descricao: 'Reversão de Provisões', ordem: 7, grupo: 'Reversão de Provisões' },
  { tipo: 'item' as const, id: 'provisao_creditos', descricao: 'Provisão p/ Créditos de Liquidação Duvidosa', ordem: 8, grupo: 'Provisão p/ Créditos de Liquidação Duvidosa' },
  { tipo: 'item' as const, id: 'ajuste_credor', descricao: 'Ajuste credor de exercícios anteriores', ordem: 9, grupo: 'Ajuste credor de exercícios anteriores' },
  { tipo: 'item' as const, id: 'equivalencia', descricao: 'Resultado de Equivalência Patrimonial', ordem: 10, grupo: 'Resultado de Equivalência Patrimonial' },
  { tipo: 'totalizador' as const, id: 'resultado_ajustado', descricao: 'Resultado Líquido Ajustado', ordem: 11 },
  { tipo: 'espaco' as const, id: 'espaco_2', descricao: '', ordem: 12 },
  
  // Subseção: (Aumento/Redução) NOS ATIVOS E PASSIVOS
  { tipo: 'subtitulo' as const, id: 'ativos_passivos_titulo', descricao: '(Aumento/Redução) NOS ATIVOS E PASSIVOS', ordem: 13 },
  { tipo: 'item' as const, id: 'contas_receber', descricao: 'Aumento/Redução em contas a receber', ordem: 14, grupo: 'Variação em Contas a Receber', baseDescricao: 'contas a receber' },
  { tipo: 'item' as const, id: 'creditos_tributarios', descricao: 'Aumento/Redução em créditos tributários', ordem: 15, grupo: 'Variação em Creditos Tributarios', baseDescricao: 'créditos tributários' },
  { tipo: 'item' as const, id: 'despesas_antecipadas', descricao: 'Aumento/Redução em despesas antecipadas', ordem: 16, grupo: 'Variação em Despesas Antecipadas', baseDescricao: 'despesas antecipadas' },
  { tipo: 'item' as const, id: 'adiantamentos_concedidos', descricao: 'Aumento/Redução em adiantamentos concedidos', ordem: 17, grupo: 'Variação em Adiantamentos Concedidos', baseDescricao: 'adiantamentos concedidos' },
  { tipo: 'item' as const, id: 'outros_creditos', descricao: 'Aumento/Redução em outros créditos', ordem: 18, grupo: 'Variação Entre Outro Creditos', baseDescricao: 'outros créditos' },
  { tipo: 'item' as const, id: 'creditos_transitorios', descricao: 'Aumento/Redução em créditos transitórios', ordem: 19, grupo: 'Variação em Creditos Transitorios', baseDescricao: 'créditos transitórios' },
  { tipo: 'item' as const, id: 'estoques', descricao: 'Aumento/Redução em estoques', ordem: 20, grupo: 'Variação em Estoques', baseDescricao: 'estoques' },
  { tipo: 'espaco' as const, id: 'espaco_3', descricao: '', ordem: 21 },
  { tipo: 'item' as const, id: 'fornecedores', descricao: 'Aumento/Redução em fornecedores', ordem: 22, grupo: 'Variação em Fornecedores', baseDescricao: 'fornecedores' },
  { tipo: 'item' as const, id: 'adiantamentos_clientes', descricao: 'Aumento/Redução em adiantamentos de clientes', ordem: 23, grupo: 'Variação em Adiantamentos Clientes', baseDescricao: 'adiantamentos de clientes' },
  { tipo: 'item' as const, id: 'obrigacoes_trabalhistas', descricao: 'Aumento/Redução em obrigações trabalhistas', ordem: 24, grupo: 'Variação em Obrigações Trabalhistas e Previdenciarias', baseDescricao: 'obrigações trabalhistas' },
  { tipo: 'item' as const, id: 'obrigacoes_tributarias', descricao: 'Aumento/Redução em obrigações tributárias', ordem: 25, grupo: 'Variação em Obrigações Tributarias', baseDescricao: 'obrigações tributárias' },
  { tipo: 'item' as const, id: 'dividendos_pagar', descricao: 'Aumento/Redução em dividendos a pagar', ordem: 26, grupo: 'Variação em Dividendos a Pagar', baseDescricao: 'dividendos a pagar' },
  { tipo: 'item' as const, id: 'outras_obrigacoes', descricao: 'Aumento/Redução em outras Obrigações', ordem: 27, grupo: 'Variação em Outras Obrigações', baseDescricao: 'outras Obrigações' },
  { tipo: 'totalizador' as const, id: 'disponibilidades_operacionais', descricao: 'Disponibilidades Líquidas geradas pelas Atividades Operacionais', ordem: 28, corDestaque: 'amarelo' },
  { tipo: 'espaco' as const, id: 'espaco_4', descricao: '', ordem: 29 },
  
  // Seção 2: Fluxos de Caixa das Atividades de Investimento
  { tipo: 'titulo' as const, id: 'titulo_investimento', descricao: 'Fluxos de Caixa das Atividades de Investimento', ordem: 30 },
  { tipo: 'item' as const, id: 'imobilizado', descricao: 'Pagamento pela Compra de Imobilizado e Intangível', ordem: 31, grupo: 'Pagamento pela Compra de Imobilizado e Intangível', invertCores: true },
  { tipo: 'item' as const, id: 'outros_ativos', descricao: 'Outros ativos não circulante', ordem: 32, grupo: 'Outros ativos não circulante' },
  { tipo: 'item' as const, id: 'venda_imobilizado', descricao: 'Recebimento da Venda do Imobilizado', ordem: 33, grupo: 'Recebimento da Venda do Imobilizado' },
  { tipo: 'totalizador' as const, id: 'caixa_investimentos', descricao: 'Caixa Líquido das Atividades de Investimentos', ordem: 34, corDestaque: 'vermelho' },
  { tipo: 'espaco' as const, id: 'espaco_5', descricao: '', ordem: 35 },
  
  // Seção 3: Fluxos de Caixa das Atividades de Financiamento
  { tipo: 'titulo' as const, id: 'titulo_financiamento', descricao: 'Fluxos de Caixa das Atividades de Financiamento', ordem: 36 },
  { tipo: 'item' as const, id: 'emprestimos', descricao: 'Empréstimos tomados', ordem: 37, grupo: 'Empréstimos tomados' },
  { tipo: 'item' as const, id: 'capital_socios', descricao: 'Aumento/Redução de Capital pelos Sócios', ordem: 38, grupo: 'Aumento/Redução de Capital pelos Sócios' },
  { tipo: 'item' as const, id: 'creditos_longo_prazo', descricao: 'Créditos a Receber de Longo Prazo', ordem: 39, grupo: 'Créditos a Receber de Longo Prazo' },
  { tipo: 'item' as const, id: 'distribuicao_lucros', descricao: 'Distribuição de Lucros', ordem: 40, grupo: 'Distribuição de Lucros' },
  { tipo: 'item' as const, id: 'outras_variacoes', descricao: 'Outras Variações', ordem: 41, grupo: 'Outras Variações' },
  { tipo: 'totalizador' as const, id: 'caixa_financiamento', descricao: 'Caixa Líquido das Atividades de Financiamento', ordem: 42, corDestaque: 'vermelho' },
  { tipo: 'espaco' as const, id: 'espaco_6', descricao: '', ordem: 43 },
  
  // Variação Líquida = soma dos 3 caixas (Operacional + Investimentos + Financiamento)
  { tipo: 'totalizador' as const, id: 'variacao_liquida_soma', descricao: 'Variação Líquida de Caixa e Equivalentes de Caixa', ordem: 44 },
  { tipo: 'espaco' as const, id: 'espaco_7', descricao: '', ordem: 45 },
  
  // Totais finais - Início, Final, depois Variação Líquida
  { tipo: 'item' as const, id: 'caixa_inicio', descricao: 'Caixa e Equivalentes de Caixa no Início do Exercício', ordem: 46, grupo: 'Caixa e Equivalentes de Caixa no Início do Exercício' },
  { tipo: 'item' as const, id: 'caixa_final', descricao: 'Caixa e Equivalentes de Caixa no Final do Exercício', ordem: 47, fonte: 'calculado' },
  { tipo: 'totalizador' as const, id: 'variacao_liquida', descricao: 'Variação Líquida de Caixa e Equivalentes de Caixa', ordem: 48 },
];

/**
 * Calcula a Demonstração do Fluxo de Caixa para dois períodos
 */
export function calcularDFC(
  data: VariacaoRecord[],
  anoPeriodo1: string,
  mesPeriodo1: string,
  anoPeriodo2: string,
  mesPeriodo2: string,
  resultadoDRE1: number = 0,
  resultadoDRE2: number = 0,
  config?: DFCConfig
): DFCData {
  // Calcular valores por grupo para cada período (cache base)
  const gruposUnicos = [...new Set(data.map(r => r.Grupo))].filter(g => g && g !== 'Sem Descrição');

  const valoresPorGrupo: Record<string, { periodo1: number; periodo2: number }> = {};
  gruposUnicos.forEach(grupo => {
    valoresPorGrupo[grupo] = {
      periodo1: calcularAcumuladoAteMes(data, anoPeriodo1, mesPeriodo1, grupo),
      periodo2: calcularAcumuladoAteMes(data, anoPeriodo2, mesPeriodo2, grupo),
    };
  });

  // NumContas que pertencem a cada grupo (para evitar dupla contagem em grupo_mais_contas)
  const numContasDoGrupo = new Map<string, Set<string>>();
  data.forEach(r => {
    if (!r.Grupo || !r.NumConta) return;
    if (!numContasDoGrupo.has(r.Grupo)) numContasDoGrupo.set(r.Grupo, new Set());
    numContasDoGrupo.get(r.Grupo)!.add(r.NumConta);
  });

  /**
   * Resolve o valor + detalhes de uma linha (item com grupo) considerando o modo configurado.
   * Aplica invert_sinal quando setado na config.
   */
  function resolveLinha(item: any): { valorP1: number; valorP2: number; contasDetalhes: DFCContaDetalhe[] } {
    const grupoPadrao: string | null = item.grupo ?? null;
    const cfg = config?.lineConfigByLinhaId?.get(item.id);
    const modo: 'grupo' | 'grupo_mais_contas' | 'contas' = cfg?.modo ?? 'grupo';
    const grupoEfetivo = cfg?.grupo ?? grupoPadrao;
    const contasExtras = new Set((cfg?.contas ?? []).filter(Boolean));

    let valorP1 = 0;
    let valorP2 = 0;
    let detalhes: DFCContaDetalhe[] = [];

    if (modo === 'grupo') {
      const v = grupoEfetivo ? valoresPorGrupo[grupoEfetivo] ?? { periodo1: 0, periodo2: 0 } : { periodo1: 0, periodo2: 0 };
      valorP1 = v.periodo1;
      valorP2 = v.periodo2;
      detalhes = grupoEfetivo
        ? obterContasDetalhes(data, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2, grupoEfetivo)
        : [];
    } else if (modo === 'grupo_mais_contas') {
      const v = grupoEfetivo ? valoresPorGrupo[grupoEfetivo] ?? { periodo1: 0, periodo2: 0 } : { periodo1: 0, periodo2: 0 };
      // Excluir contas que já pertencem ao grupo (já contabilizadas)
      const contasDoGrupo = grupoEfetivo ? numContasDoGrupo.get(grupoEfetivo) ?? new Set<string>() : new Set<string>();
      const extrasFiltradas = new Set([...contasExtras].filter(c => !contasDoGrupo.has(c)));
      const extraP1 = calcularAcumuladoContasAteMes(data, anoPeriodo1, mesPeriodo1, extrasFiltradas);
      const extraP2 = calcularAcumuladoContasAteMes(data, anoPeriodo2, mesPeriodo2, extrasFiltradas);
      valorP1 = v.periodo1 + extraP1;
      valorP2 = v.periodo2 + extraP2;
      const detalhesGrupo = grupoEfetivo
        ? obterContasDetalhes(data, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2, grupoEfetivo)
        : [];
      const detalhesExtras = obterContasDetalhesPorNumConta(data, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2, extrasFiltradas);
      // Mesclar (extras não estão no grupo, então não duplicam)
      detalhes = [...detalhesGrupo, ...detalhesExtras].sort((a, b) => a.numConta.localeCompare(b.numConta));
    } else {
      // modo === 'contas'
      valorP1 = calcularAcumuladoContasAteMes(data, anoPeriodo1, mesPeriodo1, contasExtras);
      valorP2 = calcularAcumuladoContasAteMes(data, anoPeriodo2, mesPeriodo2, contasExtras);
      detalhes = obterContasDetalhesPorNumConta(data, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2, contasExtras);
    }

    if (cfg?.invert_sinal) {
      valorP1 = valorP1 * -1;
      valorP2 = valorP2 * -1;
      detalhes = detalhes.map(c => ({
        ...c,
        valorPeriodo1: c.valorPeriodo1 * -1,
        valorPeriodo2: c.valorPeriodo2 * -1,
        valorVariacao: c.valorVariacao * -1,
      }));
    }

    return { valorP1, valorP2, contasDetalhes: detalhes };
  }

  // Pré-calcular valores por linha_id (apenas itens com grupo)
  const valoresPorLinhaId = new Map<string, { valorP1: number; valorP2: number; contasDetalhes: DFCContaDetalhe[] }>();
  ESTRUTURA_DFC.forEach(item => {
    if (item.tipo === 'item' && (item as any).grupo) {
      valoresPorLinhaId.set(item.id, resolveLinha(item));
    }
  });

  // IDs que compõem cada totalizador (alinhado com ESTRUTURA_DFC)
  const idsAjuste = ['depreciacao', 'juros', 'reversao_provisoes', 'provisao_creditos', 'ajuste_credor', 'equivalencia'];
  const idsAtivosPassivos = [
    'contas_receber', 'creditos_tributarios', 'despesas_antecipadas', 'adiantamentos_concedidos',
    'outros_creditos', 'creditos_transitorios', 'estoques',
    'fornecedores', 'adiantamentos_clientes', 'obrigacoes_trabalhistas', 'obrigacoes_tributarias',
    'dividendos_pagar', 'outras_obrigacoes',
  ];
  const idsInvestimento = ['imobilizado', 'outros_ativos', 'venda_imobilizado'];
  const idsFinanciamento = ['emprestimos', 'capital_socios', 'creditos_longo_prazo', 'distribuicao_lucros', 'outras_variacoes'];

  const sumByIds = (ids: string[], periodo: 'valorP1' | 'valorP2') =>
    ids.reduce((acc, id) => acc + (valoresPorLinhaId.get(id)?.[periodo] ?? 0), 0);

  // Totalizadores agregados a partir das linhas já resolvidas
  const ajustesP1 = sumByIds(idsAjuste, 'valorP1');
  const ajustesP2 = sumByIds(idsAjuste, 'valorP2');

  // Resultado Líquido vem da DRE. A configuração por contas/grupos fica apenas como fallback
  // quando a DRE não retornar valor para os períodos, evitando que uma configuração antiga
  // de DFC zere indevidamente esta linha crítica.
  const rlCfg = config?.lineConfigByLinhaId?.get('resultado_liquido');
  const rlHasOverride = !!rlCfg && (
    rlCfg.modo === 'contas' ||
    rlCfg.modo === 'grupo_mais_contas' ||
    (rlCfg.modo === 'grupo' && !!rlCfg.grupo)
  );
  const rlResolved = rlHasOverride
    ? resolveLinha({ id: 'resultado_liquido', grupo: null })
    : null;
  const hasResultadoDRE = resultadoDRE1 !== 0 || resultadoDRE2 !== 0;
  const resultadoLiquidoP1 = hasResultadoDRE ? resultadoDRE1 : (rlResolved?.valorP1 ?? 0);
  const resultadoLiquidoP2 = hasResultadoDRE ? resultadoDRE2 : (rlResolved?.valorP2 ?? 0);

  const resultadoAjustadoP1 = resultadoLiquidoP1 + ajustesP1;
  const resultadoAjustadoP2 = resultadoLiquidoP2 + ajustesP2;

  const ativosPassivosP1 = sumByIds(idsAtivosPassivos, 'valorP1');
  const ativosPassivosP2 = sumByIds(idsAtivosPassivos, 'valorP2');

  // Investimentos: aplicar invertCores da estrutura ANTES de somar para manter convenção visual atual
  const idsInvestimentoInvert = new Set(
    ESTRUTURA_DFC.filter(i => idsInvestimento.includes(i.id) && (i as any).invertCores === true).map(i => i.id)
  );
  const sumInvestimento = (periodo: 'valorP1' | 'valorP2') =>
    idsInvestimento.reduce((acc, id) => {
      const v = valoresPorLinhaId.get(id)?.[periodo] ?? 0;
      return acc + (idsInvestimentoInvert.has(id) ? v * -1 : v);
    }, 0);
  const investimentosP1 = sumInvestimento('valorP1');
  const investimentosP2 = sumInvestimento('valorP2');

  const financiamentoP1 = sumByIds(idsFinanciamento, 'valorP1');
  const financiamentoP2 = sumByIds(idsFinanciamento, 'valorP2');

  const disponibilidadesP1 = resultadoAjustadoP1 + ativosPassivosP1;
  const disponibilidadesP2 = resultadoAjustadoP2 + ativosPassivosP2;

  const variacaoLiquidaP1 = disponibilidadesP1 + investimentosP1 + financiamentoP1;
  const variacaoLiquidaP2 = disponibilidadesP2 + investimentosP2 + financiamentoP2;

  const linhas: DFCLinha[] = ESTRUTURA_DFC.map(item => {
    let valorP1: number | null = null;
    let valorP2: number | null = null;
    let variacao: number | null = null;
    let descricaoDinamica = item.descricao;
    let direcaoP1: 'aumento' | 'reducao' | undefined = undefined;
    let direcaoP2: 'aumento' | 'reducao' | undefined = undefined;

    if (item.tipo === 'espaco') {
      return {
        id: item.id, descricao: '', valorPeriodo1: null, valorPeriodo2: null,
        valorVariacao: null, variacao: null, tipo: 'espaco' as const, ordem: item.ordem,
      };
    }

    if (item.tipo === 'titulo' || item.tipo === 'subtitulo') {
      return {
        id: item.id, descricao: item.descricao, valorPeriodo1: null, valorPeriodo2: null,
        valorVariacao: null, variacao: null, tipo: item.tipo, ordem: item.ordem,
      };
    }

    let contasDetalhes: DFCContaDetalhe[] | undefined = undefined;

    if ((item as any).grupo) {
      const resolved = valoresPorLinhaId.get(item.id) ?? { valorP1: 0, valorP2: 0, contasDetalhes: [] };
      valorP1 = resolved.valorP1;
      valorP2 = resolved.valorP2;
      variacao = calcularVariacaoPercentual(valorP2, valorP1);

      if ((item as any).baseDescricao) {
        const base = (item as any).baseDescricao;
        if (valorP1 > 0) direcaoP1 = 'aumento';
        else if (valorP1 < 0) direcaoP1 = 'reducao';
        if (valorP2 > 0) direcaoP2 = 'aumento';
        else if (valorP2 < 0) direcaoP2 = 'reducao';
        const netChange = (valorP2 ?? 0) - (valorP1 ?? 0);
        if (netChange > 0) descricaoDinamica = `Aumento em ${base}`;
        else if (netChange < 0) descricaoDinamica = `Redução em ${base}`;
        else descricaoDinamica = `Aumento/Redução em ${base}`;
      }

      contasDetalhes = resolved.contasDetalhes;
    }

    if (item.id === 'resultado_liquido') {
      valorP1 = resultadoLiquidoP1; valorP2 = resultadoLiquidoP2;
      variacao = calcularVariacaoPercentual(valorP2, valorP1);
      if (rlResolved && rlResolved.contasDetalhes.length > 0) {
        contasDetalhes = rlResolved.contasDetalhes;
      }
    }
    if (item.id === 'resultado_ajustado') {
      valorP1 = resultadoAjustadoP1; valorP2 = resultadoAjustadoP2;
      variacao = calcularVariacaoPercentual(valorP2, valorP1);
    }
    if (item.id === 'disponibilidades_operacionais') {
      valorP1 = disponibilidadesP1; valorP2 = disponibilidadesP2;
      variacao = calcularVariacaoPercentual(valorP2, valorP1);
    }
    if (item.id === 'caixa_investimentos') {
      valorP1 = investimentosP1; valorP2 = investimentosP2;
      variacao = calcularVariacaoPercentual(valorP2, valorP1);
    }
    if (item.id === 'caixa_financiamento') {
      valorP1 = financiamentoP1; valorP2 = financiamentoP2;
      variacao = calcularVariacaoPercentual(valorP2, valorP1);
    }
    if (item.id === 'variacao_liquida_soma') {
      valorP1 = variacaoLiquidaP1;
      valorP2 = variacaoLiquidaP2;
      variacao = calcularVariacaoPercentual(valorP2, valorP1);
    }

    if (item.id === 'caixa_inicio') {
      contasDetalhes = obterContasDetalhesSaldoAnterior(data, anoPeriodo1, anoPeriodo2, 'Variação Líquida de Caixa e Equivalentes de Caixa');
      valorP1 = contasDetalhes.reduce((sum, c) => sum + c.valorPeriodo1, 0);
      valorP2 = contasDetalhes.reduce((sum, c) => sum + c.valorPeriodo2, 0);
      variacao = calcularVariacaoPercentual(valorP2, valorP1);
    }

    if (item.id === 'caixa_final') {
      contasDetalhes = obterContasDetalhesCaixaFinal(data, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2, 'Variação Líquida de Caixa e Equivalentes de Caixa');
      valorP1 = contasDetalhes.reduce((sum, c) => sum + c.valorPeriodo1, 0);
      valorP2 = contasDetalhes.reduce((sum, c) => sum + c.valorPeriodo2, 0);
      variacao = calcularVariacaoPercentual(valorP2, valorP1);
    }

    const valorVariacao = (valorP1 !== null && valorP2 !== null) ? valorP1 - valorP2 : null;

    // invertCores da estrutura (ex: imobilizado) - só aplicado aqui pois os totalizadores já consideram acima
    const invert = (item as any).invertCores === true;
    const finalP1 = invert && valorP1 !== null ? valorP1 * -1 : valorP1;
    const finalP2 = invert && valorP2 !== null ? valorP2 * -1 : valorP2;
    const finalVariacao = invert && valorVariacao !== null ? valorVariacao * -1 : valorVariacao;
    const finalDetalhes = invert && contasDetalhes && contasDetalhes.length > 0
      ? contasDetalhes.map(c => ({ ...c, valorPeriodo1: c.valorPeriodo1 * -1, valorPeriodo2: c.valorPeriodo2 * -1, valorVariacao: c.valorVariacao * -1 }))
      : contasDetalhes;

    return {
      id: item.id, descricao: descricaoDinamica, valorPeriodo1: finalP1, valorPeriodo2: finalP2,
      valorVariacao: finalVariacao, variacao, tipo: item.tipo, grupo: (item as any).grupo, ordem: item.ordem,
      contasDetalhes: finalDetalhes && finalDetalhes.length > 0 ? finalDetalhes : undefined,
      direcaoP1, direcaoP2,
    };
  });
  
  // Post-processing: Variação Líquida = Caixa Final - Caixa Início
  const linhaCaixaInicio = linhas.find(l => l.id === 'caixa_inicio');
  const linhaCaixaFinal = linhas.find(l => l.id === 'caixa_final');
  const linhaVariacaoLiquida = linhas.find(l => l.id === 'variacao_liquida');
  
  if (linhaCaixaInicio && linhaCaixaFinal && linhaVariacaoLiquida) {
    const vlP1 = (linhaCaixaFinal.valorPeriodo1 ?? 0) - (linhaCaixaInicio.valorPeriodo1 ?? 0);
    const vlP2 = (linhaCaixaFinal.valorPeriodo2 ?? 0) - (linhaCaixaInicio.valorPeriodo2 ?? 0);
    linhaVariacaoLiquida.valorPeriodo1 = vlP1;
    linhaVariacaoLiquida.valorPeriodo2 = vlP2;
    linhaVariacaoLiquida.valorVariacao = vlP1 - vlP2;
    linhaVariacaoLiquida.variacao = calcularVariacaoPercentual(vlP2, vlP1);
  }
  
  const finalVLP1 = linhaVariacaoLiquida?.valorPeriodo1 ?? variacaoLiquidaP1;
  const finalVLP2 = linhaVariacaoLiquida?.valorPeriodo2 ?? variacaoLiquidaP2;
  
  return {
    secoes: [],
    linhas,
    totais: {
      variacaoLiquidaCaixa: {
        periodo1: finalVLP1,
        periodo2: finalVLP2,
        variacao: calcularVariacaoPercentual(finalVLP2, finalVLP1) || 0,
      },
      caixaInicio: {
        periodo1: linhaCaixaInicio?.valorPeriodo1 ?? 0,
        periodo2: linhaCaixaInicio?.valorPeriodo2 ?? 0,
        variacao: 0,
      },
      caixaFinal: {
        periodo1: linhaCaixaFinal?.valorPeriodo1 ?? 0,
        periodo2: linhaCaixaFinal?.valorPeriodo2 ?? 0,
        variacao: calcularVariacaoPercentual(
          linhaCaixaFinal?.valorPeriodo2 ?? 0,
          linhaCaixaFinal?.valorPeriodo1 ?? 0
        ) || 0,
      },
    },
  };
}

/**
 * Calcula dados para Dashboard (mantém compatibilidade)
 */
export function calcularFluxoCaixaDashboard(
  data: VariacaoRecord[],
  ano: string,
  meses: string[]
): { grupos: FluxoCaixaGrupo[]; totais: FluxoCaixaTotais } {
  const gruposUnicos = [...new Set(data.map(r => r.Grupo))].filter(g => g && g !== 'Sem Descrição').sort();
  
  const grupos: FluxoCaixaGrupo[] = gruposUnicos.map(grupo => {
    const menorMes = meses.length > 0 ? meses.sort()[0] : '01';
    const inicioPeriodo = `${ano}-${menorMes}`;
    
    const saldoInicial = data
      .filter(r => r.Grupo === grupo && r.ano_mes < inicioPeriodo)
      .reduce((sum, r) => sum + r.Valor, 0);
    
    const valorTotalPeriodo = data
      .filter(r => {
        if (r.Grupo !== grupo) return false;
        if (!r.ano_mes.startsWith(ano)) return false;
        const mesRecord = r.ano_mes.substring(5, 7);
        return meses.includes(mesRecord);
      })
      .reduce((sum, r) => sum + r.Valor, 0);
    
    const saldoFinal = valorTotalPeriodo + saldoInicial;
    const valorVariacao = saldoInicial - saldoFinal; // Fórmula: Saldo Inicial - Saldo Final

    return {
      grupo,
      saldoInicial,
      saldoFinal,
      valorVariacao,
    };
  });

  const totais: FluxoCaixaTotais = {
    saldoInicial: grupos.reduce((sum, g) => sum + g.saldoInicial, 0),
    saldoFinal: grupos.reduce((sum, g) => sum + g.saldoFinal, 0),
    valorVariacao: grupos.reduce((sum, g) => sum + g.valorVariacao, 0),
  };

  grupos.sort((a, b) => Math.abs(b.saldoFinal) - Math.abs(a.saldoFinal));

  return { grupos, totais };
}

// Hook customizado para a DFC (Demonstração) - single year backward compat
export function useDFC(
  empresa: string | undefined,
  ano: string,
  mesAtePeriodo1: string,
  mesAtePeriodo2: string
) {
  const { data: variacaoData, isLoading: isLoadingVariacao, isError: isErrorVariacao, refetch: refetchVariacao } = useVariacaoData();
  const { data: dreDataResult, isLoading: isLoadingDre, isError: isErrorDre, refetch: refetchDre } = useDreDataForDFC();
  
  const isLoading = isLoadingVariacao || isLoadingDre;
  const isError = isErrorVariacao || isErrorDre;
  
  const refetch = () => { refetchVariacao(); refetchDre(); };
  
  const filterOptions = useMemo(() => {
    if (!variacaoData) return { empresas: [], anos: [], grupos: [] };
    return extractVariacaoFilterOptions(variacaoData);
  }, [variacaoData]);
  
  const filteredData = useMemo(() => {
    if (!variacaoData) return [];
    return filterVariacaoByEmpresa(variacaoData, empresa);
  }, [variacaoData, empresa]);
  
  const resultadoDRE1 = useMemo(() => {
    if (!dreDataResult || !ano || !mesAtePeriodo1) return 0;
    return calcularResultadoDRE(dreDataResult, ano, mesAtePeriodo1, empresa);
  }, [dreDataResult, ano, mesAtePeriodo1, empresa]);
  
  const resultadoDRE2 = useMemo(() => {
    if (!dreDataResult || !ano || !mesAtePeriodo2) return 0;
    return calcularResultadoDRE(dreDataResult, ano, mesAtePeriodo2, empresa);
  }, [dreDataResult, ano, mesAtePeriodo2, empresa]);
  
  const dfc = useMemo(() => {
    if (!filteredData.length || !ano || !mesAtePeriodo1 || !mesAtePeriodo2) {
      return { secoes: [], linhas: [], totais: { variacaoLiquidaCaixa: { periodo1: 0, periodo2: 0, variacao: 0 }, caixaInicio: { periodo1: 0, periodo2: 0, variacao: 0 }, caixaFinal: { periodo1: 0, periodo2: 0, variacao: 0 } } };
    }
    return calcularDFC(filteredData, ano, mesAtePeriodo1, ano, mesAtePeriodo2, resultadoDRE1, resultadoDRE2);
  }, [filteredData, ano, mesAtePeriodo1, mesAtePeriodo2, resultadoDRE1, resultadoDRE2]);
  
  return { data: variacaoData, filteredData, dfc, filterOptions, isLoading, isError, refetch, resultadoDRE1, resultadoDRE2 };
}

// Hook para DFC com comparação entre anos diferentes (cross-year)
export function useDFCCrossYear(
  empresa: string | undefined,
  anoPeriodo1: string,
  mesPeriodo1: string,
  anoPeriodo2: string,
  mesPeriodo2: string,
  config?: DFCConfig
) {
  const { data: variacaoData, isLoading: isLoadingVariacao, isError: isErrorVariacao, refetch: refetchVariacao } = useVariacaoData();
  const { data: dreDataResult, isLoading: isLoadingDre, isError: isErrorDre, refetch: refetchDre } = useDreDataForDFC();
  
  const isLoading = isLoadingVariacao || isLoadingDre;
  const isError = isErrorVariacao || isErrorDre;
  
  const refetch = () => { refetchVariacao(); refetchDre(); };
  
  const filterOptions = useMemo(() => {
    if (!variacaoData) return { empresas: [], anos: [], grupos: [] };
    return extractVariacaoFilterOptions(variacaoData);
  }, [variacaoData]);
  
  const filteredData = useMemo(() => {
    if (!variacaoData) return [];
    return filterVariacaoByEmpresa(variacaoData, empresa);
  }, [variacaoData, empresa]);
  
  const dfc = useMemo(() => {
    if (!filteredData.length || !anoPeriodo1 || !mesPeriodo1 || !anoPeriodo2 || !mesPeriodo2) {
      return { secoes: [], linhas: [], totais: { variacaoLiquidaCaixa: { periodo1: 0, periodo2: 0, variacao: 0 }, caixaInicio: { periodo1: 0, periodo2: 0, variacao: 0 }, caixaFinal: { periodo1: 0, periodo2: 0, variacao: 0 } } };
    }
    
    const resultadoDRE1 = dreDataResult ? calcularResultadoDRE(dreDataResult, anoPeriodo1, mesPeriodo1, empresa) : 0;
    const resultadoDRE2 = dreDataResult ? calcularResultadoDRE(dreDataResult, anoPeriodo2, mesPeriodo2, empresa) : 0;
    
    return calcularDFC(filteredData, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2, resultadoDRE1, resultadoDRE2, config);
  }, [filteredData, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2, dreDataResult, empresa, config]);
  
  return { data: variacaoData, filteredData, dfc, filterOptions, isLoading, isError, refetch };
}

// Hook para Dashboard
export function useFluxoCaixaDashboard(empresa: string | undefined, ano: string, meses: string[]) {
  const { data, isLoading, isError, refetch } = useVariacaoData();
  
  const filterOptions = useMemo(() => {
    if (!data) return { empresas: [], anos: [], grupos: [] };
    return extractVariacaoFilterOptions(data);
  }, [data]);
  
  const filteredData = useMemo(() => {
    if (!data) return [];
    return filterVariacaoByEmpresa(data, empresa);
  }, [data, empresa]);
  
  const fluxoCaixa = useMemo(() => {
    if (!filteredData.length || !ano || meses.length === 0) {
      return { grupos: [], totais: { saldoInicial: 0, saldoFinal: 0, valorVariacao: 0 } };
    }
    return calcularFluxoCaixaDashboard(filteredData, ano, meses);
  }, [filteredData, ano, meses]);
  
  return {
    data,
    filteredData,
    grupos: fluxoCaixa.grupos,
    totais: fluxoCaixa.totais,
    filterOptions,
    isLoading,
    isError,
    refetch,
  };
}

// Manter hook antigo para compatibilidade
export function useFluxoCaixa(empresa: string | undefined, ano: string, meses: string[]) {
  return useFluxoCaixaDashboard(empresa, ano, meses);
}
