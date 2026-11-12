import type { ProdutividadeLinha } from './ProdutividadeDashboard';

export type ProdutividadePeriodo = { inicio: string; fim: string; filial: string };

export async function exportarAtividadesExcel(rows: ProdutividadeLinha[], periodo: ProdutividadePeriodo) {
  if (!rows.length) return;
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      'Data', 'Filial', 'Responsável', 'Identificação', 'Pedidos separados', 'Unidades separadas',
      'Pedidos conferidos', 'Unidades dos pedidos conferidos', 'Unidades por leitura',
      'Notas lançadas', 'Unidades guardadas',
    ],
    ...rows.map(row => [
      new Date(row.data_atividade + 'T00:00:00'),
      Number(row.cod_empresa),
      row.nome_responsavel,
      row.identificacao_responsavel,
      row.pedidos_separados,
      row.unidades_separadas,
      row.pedidos_conferidos,
      row.unidades_pedidos_marcados_conferidos,
      row.unidades_conferidas_registradas,
      row.notas_lancadas,
      row.unidades_guardadas,
    ]),
  ], { cellDates: true, dateNF: 'dd/mm/yyyy' });
  worksheet['!cols'] = [12, 8, 30, 22, 19, 20, 19, 34, 20, 17, 20].map(wch => ({ wch }));
  worksheet['!autofilter'] = { ref: worksheet['!ref']! };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Atividades');
  const filial = periodo.filial ? '-filial-' + periodo.filial : '';
  XLSX.writeFile(workbook, 'produtividade-atividades-' + periodo.inicio + '-' + periodo.fim + filial + '.xlsx');
}
