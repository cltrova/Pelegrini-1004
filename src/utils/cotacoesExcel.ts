import * as XLSX from 'xlsx';
import type { CotacaoComercial, CotacaoOrigem } from '@/types/cotacoesComerciais';
import {
  consolidarMotivoPerda,
  type MotivosPerdaMapa,
} from '@/utils/cotacoesComerciais';

export interface CotacaoAbertaExcelRow {
  Cotacao: string;
  Emissao: Date | '';
  Validade: Date | '';
  Cliente: string;
  Vendedor: string;
  Valor: number;
  'Dias em aberto': number;
  Status: string;
}

export interface VendaPerdidaExcelRow {
  Cotacao: string;
  Data: Date | '';
  Cliente: string;
  Vendedor: string;
  Valor: number;
  Status: string;
  'Motivo da perda': string;
  Observacao: string;
}

export type CotacaoExcelRow = CotacaoAbertaExcelRow | VendaPerdidaExcelRow;

export interface CotacoesWorkbookInput {
  mode: CotacaoOrigem;
  rows: readonly CotacaoComercial[];
  motivos?: MotivosPerdaMapa;
}

export interface ExportCotacoesExcelInput extends CotacoesWorkbookInput {
  dataIni: string;
  dataFim: string;
}

const DATE_FORMAT = 'dd/mm/yyyy';
const CURRENCY_FORMAT = 'R$ #,##0.00';

const STATUS_LABELS: Record<CotacaoComercial['status'], string> = {
  aberta: 'Aberta',
  cancelada: 'Cancelada',
  recusada: 'Recusada',
  vencida: 'Vencida',
};

function dateFromIso(value: string | null): Date | '' {
  if (!value) return '';

  const [year, month, day] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return '';

  const date = new Date(year, month - 1, day);
  if (
    !Number.isFinite(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return '';

  return date;
}

export function buildCotacoesExcelRows(
  mode: 'abertas',
  rows: readonly CotacaoComercial[],
  motivos?: MotivosPerdaMapa,
): CotacaoAbertaExcelRow[];
export function buildCotacoesExcelRows(
  mode: 'perdidas',
  rows: readonly CotacaoComercial[],
  motivos?: MotivosPerdaMapa,
): VendaPerdidaExcelRow[];
export function buildCotacoesExcelRows(
  mode: CotacaoOrigem,
  rows: readonly CotacaoComercial[],
  motivos?: MotivosPerdaMapa,
): CotacaoExcelRow[];
export function buildCotacoesExcelRows(
  mode: CotacaoOrigem,
  rows: readonly CotacaoComercial[],
  motivos?: MotivosPerdaMapa,
): CotacaoExcelRow[] {
  if (mode === 'abertas') {
    return rows.map((row) => ({
      Cotacao: row.numeroCotacao,
      Emissao: dateFromIso(row.dataCotacao),
      Validade: dateFromIso(row.dataValidade),
      Cliente: row.nomeCliente,
      Vendedor: row.nomeVendedor,
      Valor: row.valor,
      'Dias em aberto': row.diasEmAberto,
      Status: STATUS_LABELS[row.status],
    }));
  }

  return rows.map((row) => {
    const motivo = consolidarMotivoPerda(row, motivos);
    return {
      Cotacao: row.numeroCotacao,
      Data: dateFromIso(row.dataCotacao),
      Cliente: row.nomeCliente,
      Vendedor: row.nomeVendedor,
      Valor: row.valor,
      Status: STATUS_LABELS[row.status],
      'Motivo da perda': motivo.label,
      Observacao: motivo.observacao,
    };
  });
}

function applyCellFormats(worksheet: XLSX.WorkSheet, rowCount: number, mode: CotacaoOrigem): void {
  const dateColumns = mode === 'abertas' ? ['B', 'C'] : ['B'];
  const valueColumn = mode === 'abertas' ? 'F' : 'E';

  for (let rowIndex = 2; rowIndex <= rowCount + 1; rowIndex += 1) {
    dateColumns.forEach((column) => {
      const dateCell = worksheet[`${column}${rowIndex}`];
      if (dateCell?.v instanceof Date && Number.isFinite(dateCell.v.getTime())) {
        dateCell.z = DATE_FORMAT;
      }
    });

    const valueCell = worksheet[`${valueColumn}${rowIndex}`];
    if (valueCell) valueCell.z = CURRENCY_FORMAT;

    if (mode === 'abertas') {
      const agingCell = worksheet[`G${rowIndex}`];
      if (agingCell) agingCell.z = '0';
    }
  }
}

export function buildCotacoesWorkbook(input: CotacoesWorkbookInput): XLSX.WorkBook {
  const rows = buildCotacoesExcelRows(input.mode, input.rows, input.motivos);
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    cellDates: true,
    dateNF: DATE_FORMAT,
  });
  applyCellFormats(worksheet, rows.length, input.mode);
  worksheet['!cols'] = input.mode === 'abertas'
    ? [
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 28 },
      { wch: 20 }, { wch: 15 }, { wch: 16 }, { wch: 14 },
    ]
    : [
      { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 20 },
      { wch: 15 }, { wch: 14 }, { wch: 26 }, { wch: 40 },
    ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cotações');
  return workbook;
}

export function exportCotacoesExcel(input: ExportCotacoesExcelInput): void {
  const workbook = buildCotacoesWorkbook(input);
  const filePrefix = input.mode === 'abertas'
    ? '10041-cotacoes-abertas'
    : '10041-vendas-perdidas';
  XLSX.writeFile(workbook, `${filePrefix}-${input.dataIni}-${input.dataFim}.xlsx`);
}
