import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { normalizarCotacao } from './cotacoesComerciais';
import { buildCotacoesWorkbook } from './cotacoesExcel';

function roundTrip(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', cellDates: true });
  const reopened = XLSX.read(bytes, { type: 'array', cellDates: true, cellNF: true });
  return reopened.Sheets[reopened.SheetNames[0]];
}

describe('buildCotacoesWorkbook SheetJS round trip', () => {
  it('preserves the exact open-quote columns, dates, numbers, and formats', () => {
    const row = normalizarCotacao({
      CodCotacao: '9012',
      DataCotacao: '2026-08-01',
      DataValidade: '2026-08-15',
      CodCliente: '88',
      NomeCliente: 'OFICINA CENTRAL',
      CodVendedor: '59',
      NomeVendedor: 'ERLAN C.CH',
      ValorTotal: '12.345,67',
      Status: 'ABERTA',
    }, 'abertas', new Date('2026-08-20T12:00:00-03:00'));

    const worksheet = roundTrip(buildCotacoesWorkbook({ mode: 'abertas', rows: [row] }));
    const [headers] = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, raw: true });

    expect(headers).toEqual([
      'Cotacao', 'Emissao', 'Validade', 'Cliente', 'Vendedor', 'Valor', 'Dias em aberto', 'Status',
    ]);
    expect(worksheet.B2).toMatchObject({ t: 'd', v: expect.any(Date), z: 'dd/mm/yyyy' });
    expect(worksheet.C2).toMatchObject({ t: 'd', v: expect.any(Date), z: 'dd/mm/yyyy' });
    expect(worksheet.F2).toMatchObject({ t: 'n', v: 12_345.67, z: 'R$ #,##0.00' });
    expect(worksheet.G2).toMatchObject({ t: 'n', v: 19, z: '0' });
    expect(headers).not.toContain('Motivo da perda');
    expect(headers).not.toContain('Observacao');
  });

  it('preserves the lost-sale columns and consolidated ERP reason', () => {
    const row = normalizarCotacao({
      CodCotacao: '9203',
      DataCotacao: '2026-08-15',
      CodCliente: '90',
      NomeCliente: 'AUTO PECAS SUL',
      CodVendedor: '61',
      NomeVendedor: 'CARLA LIMA',
      ValorTotal: '5.000,00',
      MotivoPerda: 'Prazo de entrega',
      Status: 'VENCIDA',
    }, 'perdidas', new Date('2026-08-25T12:00:00-03:00'));

    const worksheet = roundTrip(buildCotacoesWorkbook({ mode: 'perdidas', rows: [row] }));
    const [headers, values] = XLSX.utils.sheet_to_json<(string | number | Date)[]>(worksheet, { header: 1, raw: true });

    expect(headers).toEqual([
      'Cotacao', 'Data', 'Cliente', 'Vendedor', 'Valor', 'Status', 'Motivo da perda', 'Observacao',
    ]);
    expect(worksheet.B2).toMatchObject({ t: 'd', v: expect.any(Date), z: 'dd/mm/yyyy' });
    expect(worksheet.E2).toMatchObject({ t: 'n', v: 5_000, z: 'R$ #,##0.00' });
    expect(values.slice(6)).toEqual(['Prazo de entrega', '']);
  });
});
