import type { DuplicataRecord } from '@/hooks/useDuplicatasData';

export type DevedorStatus = 'EM_DIA' | 'VENCE_HOJE' | 'VENCIDA' | 'SEM_VENCTO';

export interface DevedorTitulo {
  id: string;
  codCliente: string;
  cliente: string;
  documento: string;
  parcela: string;
  vendedor: string;
  dataEmissao: string | null;
  dataVencimento: string | null;
  valorOriginal: number;
  valorRecebido: number;
  valorAReceber: number;
  status: DevedorStatus;
  raw: DuplicataRecord;
}

export interface ClienteDevedor {
  codCliente: string;
  cliente: string;
  valorLiquidoAReceber: number;
  valorVencido: number;
  valorAVencer: number;
  valorVenceHoje: number;
  titulos: number;
  primeiraData: string | null;
  ultimaData: string | null;
  vendedores: string[];
  titulosDetalhe: DevedorTitulo[];
}

export interface DevedoresFilters {
  search?: string;
  status?: 'todos' | DevedorStatus;
  dataIni?: string;
  dataFim?: string;
  vendedor?: string;
  minValor?: number;
}

export interface ResumoDevedores {
  totalClientes: number;
  totalTitulos: number;
  totalAReceber: number;
  totalVencido: number;
  totalAVencer: number;
  totalVenceHoje: number;
}

const LIQUIDADO_PATTERN = /PAG|QUIT|BAIX|CANCEL|LIQUID|RECEBID/i;

function readField(record: DuplicataRecord, aliases: string[]) {
  for (const key of aliases) {
    const value = (record as Record<string, unknown>)[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

export function toNumberDevedor(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveOrZero(value: unknown): number {
  const parsed = toNumberDevedor(value);
  return parsed > 0 ? parsed : 0;
}

export function getValorRecebidoTitulo(record: DuplicataRecord): number {
  return positiveOrZero(readField(record, [
    'ValorRecebimento',
    'ValorRecebido',
    'ValorPago',
    'ValorBaixado',
    'VlrRecebido',
  ]));
}

export function getValorOriginalTitulo(record: DuplicataRecord): number {
  return positiveOrZero(readField(record, [
    'ValorDuplicata',
    'Valor',
    'valor',
    'ValorTitulo',
    'ValorOriginal',
    'ValorParcela',
    'VlrDuplicata',
  ]));
}

export function getValorAReceberTitulo(record: DuplicataRecord): number {
  const saldo = positiveOrZero(readField(record, [
    'SaldoAberto',
    'ValorSaldo',
    'Saldo',
    'SaldoTitulo',
    'ValorEmAberto',
    'VlrSaldo',
    'SaldoReceber',
  ]));
  if (saldo > 0) return saldo;

  const original = getValorOriginalTitulo(record);
  const recebido = getValorRecebidoTitulo(record);
  const diferenca = original - recebido;
  if (diferenca > 0) return diferenca;

  return original;
}

function normalizarTexto(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function toDateKey(raw?: string | null): string | null {
  if (!raw) return null;
  const text = String(raw).trim();
  const iso = text.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function todayKey(today: Date): string {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getStatusDevedor(record: DuplicataRecord, today = new Date()): DevedorStatus {
  const vencimento = toDateKey(record.DataVencimento);
  if (!vencimento) return 'SEM_VENCTO';
  const hoje = todayKey(today);
  if (vencimento === hoje) return 'VENCE_HOJE';
  return vencimento < hoje ? 'VENCIDA' : 'EM_DIA';
}

export function isTituloReceberAberto(record: DuplicataRecord): boolean {
  const tipo = normalizarTexto(record.Tipo);
  const origem = normalizarTexto(record.Origem);
  if (tipo.includes('PAGAR') || origem.includes('PAGAR')) return false;
  if (tipo && !tipo.includes('RECEBER') && origem && !origem.includes('RECEBER')) return false;

  if (record.DataPagamento || record.DataBaixa || record.DataQuitacao || record.DataCancelamento) return false;

  const status = `${record.Status ?? ''} ${record.Situacao ?? ''} ${record.Origem ?? ''}`;
  if (LIQUIDADO_PATTERN.test(normalizarTexto(status))) return false;

  return getValorAReceberTitulo(record) > 0;
}

function montarTitulo(record: DuplicataRecord, today: Date): DevedorTitulo {
  const documento = String(record.CodDuplicata || readField(record, ['Documento', 'NumeroDocumento', 'Titulo']) || '-');
  const parcela = formatParcelaDevedor(readField(record, ['Parcela', 'NumeroParcela', 'SeqParcela']));
  const cliente = String(record.Cliente || record.CodClienteRazao || 'Cliente sem nome');
  const codCliente = String(record.CodCliente || readField(record, ['CodigoCliente', 'ClienteCodigo']) || cliente);
  const vendedor = String(record.Vendedor || readField(record, ['NomeVendedor', 'VendInterno']) || 'Sem vendedor');

  return {
    id: `${codCliente}-${documento}-${parcela}-${record.DataVencimento ?? ''}`,
    codCliente,
    cliente,
    documento,
    parcela,
    vendedor,
    dataEmissao: toDateKey(record.DataEmissao),
    dataVencimento: toDateKey(record.DataVencimento),
    valorOriginal: getValorOriginalTitulo(record),
    valorRecebido: getValorRecebidoTitulo(record),
    valorAReceber: getValorAReceberTitulo(record),
    status: getStatusDevedor(record, today),
    raw: record,
  };
}

export function formatParcelaDevedor(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  const normalized = text.replace(/\s/g, '');
  if (/^0+$/.test(normalized)) return '-';
  if (/^0+\/0+$/.test(normalized)) return '-';
  return text;
}

function tituloPassaFiltros(titulo: DevedorTitulo, filters: DevedoresFilters): boolean {
  const search = normalizarTexto(filters.search);
  if (search) {
    const haystack = normalizarTexto(`${titulo.codCliente} ${titulo.cliente} ${titulo.documento} ${titulo.vendedor}`);
    if (!haystack.includes(search)) return false;
  }

  if (filters.status && filters.status !== 'todos' && titulo.status !== filters.status) return false;

  if (filters.vendedor && filters.vendedor !== 'todos') {
    if (normalizarTexto(titulo.vendedor) !== normalizarTexto(filters.vendedor)) return false;
  }

  if (filters.dataIni && (!titulo.dataVencimento || titulo.dataVencimento < filters.dataIni)) return false;
  if (filters.dataFim && (!titulo.dataVencimento || titulo.dataVencimento > filters.dataFim)) return false;

  return true;
}

export function agruparClientesDevedores(
  records: DuplicataRecord[],
  filters: DevedoresFilters = {},
  today = new Date(),
): ClienteDevedor[] {
  const grouped = new Map<string, ClienteDevedor>();

  for (const record of records) {
    if (!isTituloReceberAberto(record)) continue;
    const titulo = montarTitulo(record, today);
    if (!tituloPassaFiltros(titulo, filters)) continue;

    const key = titulo.codCliente || titulo.cliente;
    const current = grouped.get(key) ?? {
      codCliente: titulo.codCliente,
      cliente: titulo.cliente,
      valorLiquidoAReceber: 0,
      valorVencido: 0,
      valorAVencer: 0,
      valorVenceHoje: 0,
      titulos: 0,
      primeiraData: null,
      ultimaData: null,
      vendedores: [],
      titulosDetalhe: [],
    };

    current.valorLiquidoAReceber += titulo.valorAReceber;
    current.titulos += 1;
    current.titulosDetalhe.push(titulo);
    if (titulo.status === 'VENCIDA') current.valorVencido += titulo.valorAReceber;
    else if (titulo.status === 'VENCE_HOJE') current.valorVenceHoje += titulo.valorAReceber;
    else current.valorAVencer += titulo.valorAReceber;

    if (titulo.dataVencimento) {
      if (!current.primeiraData || titulo.dataVencimento < current.primeiraData) current.primeiraData = titulo.dataVencimento;
      if (!current.ultimaData || titulo.dataVencimento > current.ultimaData) current.ultimaData = titulo.dataVencimento;
    }

    if (!current.vendedores.some((v) => normalizarTexto(v) === normalizarTexto(titulo.vendedor))) {
      current.vendedores.push(titulo.vendedor);
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .filter((cliente) => !filters.minValor || cliente.valorLiquidoAReceber >= filters.minValor)
    .map((cliente) => ({
      ...cliente,
      vendedores: cliente.vendedores.sort((a, b) => a.localeCompare(b, 'pt-BR')),
      titulosDetalhe: cliente.titulosDetalhe.sort((a, b) => (a.dataVencimento ?? '9999-99-99').localeCompare(b.dataVencimento ?? '9999-99-99')),
    }))
    .sort((a, b) => b.valorLiquidoAReceber - a.valorLiquidoAReceber);
}

export function calcularResumoDevedores(clientes: ClienteDevedor[]): ResumoDevedores {
  return clientes.reduce<ResumoDevedores>((acc, cliente) => {
    acc.totalClientes += 1;
    acc.totalTitulos += cliente.titulos;
    acc.totalAReceber += cliente.valorLiquidoAReceber;
    acc.totalVencido += cliente.valorVencido;
    acc.totalAVencer += cliente.valorAVencer;
    acc.totalVenceHoje += cliente.valorVenceHoje;
    return acc;
  }, {
    totalClientes: 0,
    totalTitulos: 0,
    totalAReceber: 0,
    totalVencido: 0,
    totalAVencer: 0,
    totalVenceHoje: 0,
  });
}

export function listarVendedoresDevedores(records: DuplicataRecord[]): string[] {
  const vendedores = new Set<string>();
  for (const record of records) {
    if (!isTituloReceberAberto(record)) continue;
    const vendedor = String(record.Vendedor || readField(record, ['NomeVendedor', 'VendInterno']) || '').trim();
    if (vendedor) vendedores.add(vendedor);
  }
  return Array.from(vendedores).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
