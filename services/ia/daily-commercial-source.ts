import { vendedorPodeAparecerNoComercial1004 } from '../../src/utils/vendedores1004.ts';
import type { DailyInsightSnapshot, InsightsBranch } from './daily-insight-types.ts';

const branchSources = {
  transmissao: { company: '1004', route: 'comissoes', name: 'Casa da Transmissão' },
  chevrolet: { company: '10041', route: 'comissoes_ch', name: 'Casa do Chevrolet' },
};

const pageSize = 5000;
const maximumPages = 20;
type Period = DailyInsightSnapshot['periodo'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function amount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const number = Number(value.includes(',') ? value.replaceAll('.', '').replace(',', '.') : value);
    if (Number.isFinite(number)) return number;
  }
  throw new Error('Valor inválido em comissões do RSYS');
}

export async function loadCommercialAnalysisInput(
  branch: InsightsBranch,
  periodo: Period,
  env: NodeJS.ProcessEnv,
  fetchRsys = globalThis.fetch,
) {
  const source = branchSources[branch];
  const base = env.PELEGRINI_RSYS_URL;
  if (!base) throw new Error('Endereço do RSYS indisponível');
  const url = new URL(`comercial/${source.route}`, `${base.replace(/\/+$/, '')}/`);
  const headers = new Headers({ Accept: 'application/json' });
  if (env.PELEGRINI_RSYS_HOST) headers.set('Host', env.PELEGRINI_RSYS_HOST);
  const signal = AbortSignal.timeout(60_000);
  const porVendedor = new Map<string, {
    nome: string;
    metaMensal: number;
    faturamentoMesAtual: number;
    valorPendente: number;
    percentualMetaFaturado: number | null;
    metaEsperada: number;
  }>();

  for (let page = 1; page <= maximumPages; page++) {
    url.search = new URLSearchParams({
      cod_empresa_bi: source.company,
      data_ini: periodo.inicio,
      data_fim: periodo.fim,
      page: String(page),
      page_size: String(pageSize),
    }).toString();
    const response = await fetchRsys(url, { headers, signal, redirect: 'error' });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Comissões do RSYS responderam HTTP ${response.status}`);
    }
    const data: unknown = await response.json();
    const rows: unknown = isRecord(data) ? data.dados ?? data.data ?? data.comissoes ?? data.registros : data;
    if (!Array.isArray(rows)) throw new Error('Resposta de comissões inválida');

    for (const row of rows) {
      if (!isRecord(row) || String(row.CodEmpresa_bi ?? row.cod_empresa_bi) !== source.company) {
        throw new Error('Filial divergente no relatório de comissões');
      }
      const codigo = String(row.Vendedor ?? '').trim();
      const nome = String(row.NomeVendedor ?? '').trim();
      if (!/^\d+$/.test(codigo) || !nome || !vendedorPodeAparecerNoComercial1004({ nome })) continue;
      if (porVendedor.has(codigo)) throw new Error('Vendedor duplicado no relatório de comissões');
      const metaMensal = amount(row.ObjetivoMensal ?? 0);
      const faturamentoMesAtual = amount(row.Acumulada ?? row.FaturadoAteHoje);
      porVendedor.set(codigo, {
        nome,
        metaMensal,
        faturamentoMesAtual,
        valorPendente: amount(row.AFaturar ?? 0),
        percentualMetaFaturado: metaMensal > 0 ? Math.round(faturamentoMesAtual / metaMensal * 1000) / 10 : null,
        metaEsperada: amount(row.ObjetivoAteHoje ?? 0),
      });
    }
    if (rows.length < pageSize) break;
    if (page === maximumPages) throw new Error('Relatório de comissões excedeu o limite de páginas');
  }

  const vendedores = [...porVendedor.values()]
    .filter(({ metaMensal, faturamentoMesAtual, valorPendente }) => metaMensal > 0 || faturamentoMesAtual !== 0 || valorPendente !== 0)
    .sort((a, b) => b.faturamentoMesAtual - a.faturamentoMesAtual);
  const kpis = {
    filial: source.name,
    fonte: 'Relatório de comissões do RSYS',
    periodo,
    totalMeta: Math.round(vendedores.reduce((sum, vendedor) => sum + vendedor.metaMensal, 0) * 100) / 100,
    totalFaturado: Math.round(vendedores.reduce((sum, vendedor) => sum + vendedor.faturamentoMesAtual, 0) * 100) / 100,
    totalVendedores: vendedores.length,
  };
  return { vendedores, kpis };
}
