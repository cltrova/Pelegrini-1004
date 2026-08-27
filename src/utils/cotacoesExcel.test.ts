import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizarCotacao } from './cotacoesComerciais';
import type { MotivoPerdaRegistro } from '@/hooks/useMotivosPerda';
import { buildCotacoesExcelRows, exportCotacoesExcel } from './cotacoesExcel';

const xlsxMock = vi.hoisted(() => ({
  utils: {
    json_to_sheet: vi.fn((rows: unknown[], options?: { cellDates?: boolean; dateNF?: string }) => {
      const first = rows[0] as Record<string, unknown> | undefined;
      const date = first?.Data ?? first?.Emissao;
      const validity = first?.Validade;
      const valueColumn = 'Emissao' in (first ?? {}) ? 'F2' : 'E2';
      return {
        B2: date === ''
          ? { t: 's', v: '' }
          : options?.cellDates
            ? { t: 'd', v: date, z: options.dateNF }
            : { t: 'n', v: 46_235, z: 'm/d/yy' },
        ...('Emissao' in (first ?? {}) ? {
          C2: validity === '' ? { t: 's', v: '' } : { t: 'd', v: validity, z: options?.dateNF },
          G2: { t: 'n', v: first?.['Dias em aberto'] },
        } : {}),
        [valueColumn]: { t: 'n', v: first?.Valor },
      };
    }),
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

vi.mock('xlsx', () => xlsxMock);

const row = normalizarCotacao({
  CodCotacao: '9012',
  DataCotacao: '2026-08-01',
  CodCliente: '88',
  NomeCliente: 'OFICINA CENTRAL',
  CodVendedor: '59',
  NomeVendedor: 'ERLAN C.CH',
  ValorTotal: '12.345,67',
  Status: 'CANCELADA',
}, 'perdidas', new Date('2026-08-20'));

const motivo = {
  motivo: 'preco',
  observacao: 'Cliente escolheu a proposta concorrente.',
} as MotivoPerdaRegistro;

describe('buildCotacoesExcelRows', () => {
  it('maps a lost canonical quotation and its persisted loss reason', () => {
    const result = buildCotacoesExcelRows('perdidas', [row], new Map([
      ['9012', motivo],
    ]));

    expect(result).toEqual([{
      Cotacao: '9012',
      Data: expect.any(Date),
      Cliente: 'OFICINA CENTRAL',
      Vendedor: 'ERLAN C.CH',
      Valor: 12_345.67,
      Status: 'Cancelada',
      'Motivo da perda': 'Preço',
      Observacao: 'Cliente escolheu a proposta concorrente.',
    }]);

    const exportDate = result[0].Data;
    expect(exportDate).toBeInstanceOf(Date);
    if (!(exportDate instanceof Date)) {
      throw new TypeError('Expected the exported quotation date to be a Date');
    }
    expect(Number.isFinite(exportDate.getTime())).toBe(true);
    expect([
      exportDate.getFullYear(),
      exportDate.getMonth() + 1,
      exportDate.getDate(),
    ]).toEqual([2026, 8, 1]);
  });

  it('exports open quotations without loss reason fields', () => {
    const aberta = { ...row, dataValidade: '2026-08-15', status: 'aberta' as const };

    expect(buildCotacoesExcelRows('abertas', [aberta])).toEqual([{
      Cotacao: '9012',
      Emissao: expect.any(Date),
      Validade: expect.any(Date),
      Cliente: 'OFICINA CENTRAL',
      Vendedor: 'ERLAN C.CH',
      Valor: 12_345.67,
      'Dias em aberto': 18,
      Status: 'Aberta',
    }]);
  });

  it('uses the ERP reason when the lost quotation has no persisted reason', () => {
    expect(buildCotacoesExcelRows('perdidas', [{ ...row, motivoErp: 'Prazo de entrega' }])).toEqual([{
      Cotacao: '9012',
      Data: expect.any(Date),
      Cliente: 'OFICINA CENTRAL',
      Vendedor: 'ERLAN C.CH',
      Valor: 12_345.67,
      Status: 'Cancelada',
      'Motivo da perda': 'Prazo de entrega',
      Observacao: '',
    }]);
  });
});

describe('exportCotacoesExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a formatted worksheet and writes the lost-sales filename', () => {
    exportCotacoesExcel({
      mode: 'perdidas',
      rows: [row],
      motivos: new Map([['9012', motivo]]),
      dataIni: '2026-08-01',
      dataFim: '2026-08-31',
    });

    const worksheet = xlsxMock.utils.json_to_sheet.mock.results[0]?.value as Record<string, unknown>;
    const [sheetRows, sheetOptions] = xlsxMock.utils.json_to_sheet.mock.calls[0] ?? [];
    expect(sheetRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ Cotacao: '9012', Valor: 12_345.67 }),
    ]));
    expect(sheetOptions).toEqual({ cellDates: true, dateNF: 'dd/mm/yyyy' });
    expect(worksheet['!cols']).toEqual(expect.any(Array));
    expect(worksheet.B2).toMatchObject({ t: 'd', v: expect.any(Date), z: 'dd/mm/yyyy' });
    expect(worksheet.E2).toMatchObject({ z: 'R$ #,##0.00' });
    expect(xlsxMock.utils.book_append_sheet).toHaveBeenCalledWith(
      expect.anything(),
      worksheet,
      'Cotações',
    );
    expect(xlsxMock.writeFile).toHaveBeenCalledWith(
      expect.anything(),
      '10041-vendas-perdidas-2026-08-01-2026-08-31.xlsx',
    );
  });

  it('writes the open-quotes filename', () => {
    exportCotacoesExcel({
      mode: 'abertas',
      rows: [{ ...row, dataValidade: '2026-08-15', status: 'aberta' }],
      dataIni: '2026-08-01',
      dataFim: '2026-08-31',
    });

    const worksheet = xlsxMock.utils.json_to_sheet.mock.results[0]?.value as Record<string, unknown>;
    expect(worksheet.B2).toMatchObject({ t: 'd', z: 'dd/mm/yyyy' });
    expect(worksheet.C2).toMatchObject({ t: 'd', z: 'dd/mm/yyyy' });
    expect(worksheet.F2).toMatchObject({ t: 'n', z: 'R$ #,##0.00' });
    expect(worksheet.G2).toMatchObject({ t: 'n', z: '0' });
    expect(xlsxMock.writeFile).toHaveBeenCalledWith(
      expect.anything(),
      '10041-cotacoes-abertas-2026-08-01-2026-08-31.xlsx',
    );
  });

  it('leaves an absent quotation date blank in the worksheet', () => {
    exportCotacoesExcel({
      mode: 'abertas',
      rows: [{ ...row, dataCotacao: '', dataValidade: null, status: 'aberta' }],
      dataIni: '2026-08-01',
      dataFim: '2026-08-31',
    });

    const worksheet = xlsxMock.utils.json_to_sheet.mock.results[0]?.value as Record<string, unknown>;
    expect(worksheet.B2).toEqual({ t: 's', v: '' });
  });
});
