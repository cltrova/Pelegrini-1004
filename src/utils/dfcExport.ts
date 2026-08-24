import * as XLSX from 'xlsx';
import { DFCLinha } from '@/types/variacao';

const MESES: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

interface ExportParams {
  linhas: DFCLinha[];
  anoPeriodo1: string;
  mesPeriodo1: string;
  anoPeriodo2: string;
  mesPeriodo2: string;
  empresa?: string;
}

const METODOLOGIA_TEXT: string[][] = [
  ['DEMONSTRAÇÃO DOS FLUXOS DE CAIXA — MÉTODO INDIRETO'],
  [''],
  ['FONTE DE DADOS'],
  ['- Base primária: JSON de Variação (Storage "dados-json") — registros com colunas Grupo, NumConta, Descricao, ano_mes (YYYY-MM), Valor, CodEmpresa_bi.'],
  ['- Resultado Líquido do Exercício: calculado a partir do JSON da DRE, somando o nível mais detalhado (folhas) de Jan até o mês do período, excluindo contas específicas configuradas.'],
  ['- Filtro multi-tenant: registros são segregados por CodEmpresa_bi (ou CodEmpresa / Empresa) da empresa ativa.'],
  [''],
  ['CÁLCULO POR LINHA (ITEM DE GRUPO)'],
  ['1. Filtra registros do JSON pelo campo Grupo do item.'],
  ['2. Acumulado do Período P = Σ Valor onde ano_mes ∈ [ano-01, ano-mesAte].'],
  ['3. Valor Variação = Valor(P2) − Valor(P1).'],
  ['4. Variação % = (P2 − P1) / |P1| × 100 (null se P1 = 0 e P2 ≠ 0; 0% se ambos 0).'],
  ['5. Contas detalhadas: agrupamento por NumConta com mesmo cálculo acumulado.'],
  [''],
  ['MODOS DE CONFIGURAÇÃO POR LINHA (Aba Configuração)'],
  ['- grupo: soma apenas os registros do Grupo.'],
  ['- contas: soma apenas os registros dos NumConta listados.'],
  ['- grupo_mais_contas: soma o Grupo + contas extras que NÃO pertencem ao Grupo (evita dupla contagem).'],
  ['- invert_sinal: se ligado, multiplica o resultado por (−1).'],
  [''],
  ['TOTALIZADORES'],
  ['- Resultado Líquido Ajustado = Resultado Líquido + Depreciação + Juros + Reversão de Provisões + Provisão CLD + Ajuste Credor + Equivalência Patrimonial.'],
  ['- Disponibilidades Líquidas Operacionais = Resultado Líquido Ajustado + Σ variações em Ativos e Passivos operacionais.'],
  ['- Caixa Líquido de Investimentos = Imobilizado/Intangível + Outros Ativos Não Circulante + Venda de Imobilizado.'],
  ['- Caixa Líquido de Financiamento = Empréstimos + Capital dos Sócios + Créditos LP + Distribuição de Lucros + Outras Variações.'],
  ['- Variação Líquida (soma) = Operacional + Investimentos + Financiamento.'],
  ['- Variação Líquida (validação) = Caixa Final − Caixa Início.'],
  [''],
  ['CAIXA E EQUIVALENTES'],
  ['- Caixa Início do Exercício: soma histórica de TODOS os registros do grupo com ano_mes < {ano}-01.'],
  ['- Caixa Final do Exercício: soma histórica acumulada de TODOS os registros até {ano}-{mesAte} (calculado por NumConta e somado).'],
  [''],
  ['SINAIS'],
  ['- Valores são usados como vêm do JSON (a View/ERP já aplica a convenção de sinal contábil).'],
  ['- Grupos configurados em "invert_sinal" ou linhas com "invertCores" apenas ajustam a exibição/interpretação.'],
  [''],
  ['EXCLUSÕES DA DRE (para cálculo do Resultado Líquido)'],
  ['- Contas: 2.3.3.01.01.00003, 1.1.2.07.01.00001, 1.1.2.07.01.00002.'],
  [''],
  ['ARQUIVOS-FONTE DO CÓDIGO'],
  ['- src/hooks/useVariacaoData.ts (funções calcularDFC, calcularAcumuladoAteMes, calcularSaldoAnterior, obterContasDetalhes*, ESTRUTURA_DFC).'],
  ['- src/components/variacao/DFCTable.tsx (renderização).'],
  ['- src/components/variacao/DfcConfigTab.tsx (persistência da config por linha).'],
];

export function exportDFCToExcel({ linhas, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2, empresa }: ExportParams) {
  const headerP1 = `Até ${MESES[mesPeriodo1]}/${anoPeriodo1}`;
  const headerP2 = `Até ${MESES[mesPeriodo2]}/${anoPeriodo2}`;

  // --- Sheet 1: Demonstração (linhas principais) ---
  const rowsDem: any[][] = [];
  rowsDem.push(['Demonstração dos Fluxos de Caixa — Método Indireto']);
  if (empresa) rowsDem.push([`Empresa: ${empresa}`]);
  rowsDem.push([`P1: ${headerP1}`, `P2: ${headerP2}`]);
  rowsDem.push([]);
  rowsDem.push(['Tipo', 'ID', 'Descrição', headerP1, headerP2, 'Vlr. Variação', 'Variação %']);

  linhas.forEach((l) => {
    if (l.tipo === 'espaco') {
      rowsDem.push([]);
      return;
    }
    rowsDem.push([
      l.tipo,
      l.id,
      l.descricao,
      l.valorPeriodo1 ?? '',
      l.valorPeriodo2 ?? '',
      l.valorVariacao ?? '',
      l.variacao !== null && l.variacao !== undefined ? l.variacao / 100 : '',
    ]);
  });

  const wsDem = XLSX.utils.aoa_to_sheet(rowsDem);
  wsDem['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 60 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
  ];

  // Formata números e %
  const range = XLSX.utils.decode_range(wsDem['!ref']!);
  for (let R = 5; R <= range.e.r; R++) {
    ['D', 'E', 'F'].forEach((c) => {
      const cell = wsDem[`${c}${R + 1}`];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0.00;[Red](#,##0.00);"-"';
    });
    const pct = wsDem[`G${R + 1}`];
    if (pct && typeof pct.v === 'number') pct.z = '0.0%';
  }

  // --- Sheet 2: Detalhes por conta ---
  const rowsDet: any[][] = [];
  rowsDet.push(['Detalhes por NumConta']);
  rowsDet.push([]);
  rowsDet.push(['Linha', 'Grupo/Descrição da Linha', 'NumConta', 'Descrição Conta', headerP1, headerP2, 'Vlr. Variação', 'Variação %']);

  linhas.forEach((l) => {
    if (!l.contasDetalhes || l.contasDetalhes.length === 0) return;
    l.contasDetalhes.forEach((c) => {
      rowsDet.push([
        l.id,
        l.descricao,
        c.numConta,
        c.descricao,
        c.valorPeriodo1,
        c.valorPeriodo2,
        c.valorVariacao,
        c.variacao !== null && c.variacao !== undefined ? c.variacao / 100 : '',
      ]);
    });
  });

  const wsDet = XLSX.utils.aoa_to_sheet(rowsDet);
  wsDet['!cols'] = [
    { wch: 26 }, { wch: 45 }, { wch: 22 }, { wch: 45 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
  ];
  const rangeD = XLSX.utils.decode_range(wsDet['!ref']!);
  for (let R = 3; R <= rangeD.e.r; R++) {
    ['E', 'F', 'G'].forEach((c) => {
      const cell = wsDet[`${c}${R + 1}`];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0.00;[Red](#,##0.00);"-"';
    });
    const pct = wsDet[`H${R + 1}`];
    if (pct && typeof pct.v === 'number') pct.z = '0.0%';
  }

  // --- Sheet 3: Metodologia ---
  const wsMet = XLSX.utils.aoa_to_sheet(METODOLOGIA_TEXT);
  wsMet['!cols'] = [{ wch: 120 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDem, 'Demonstração');
  XLSX.utils.book_append_sheet(wb, wsDet, 'Detalhes');
  XLSX.utils.book_append_sheet(wb, wsMet, 'Metodologia');

  const suffix = `${anoPeriodo1}${mesPeriodo1}_vs_${anoPeriodo2}${mesPeriodo2}`;
  XLSX.writeFile(wb, `DFC_${empresa || 'empresa'}_${suffix}.xlsx`);
}
