import { useCallback, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Minus, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';
import { DreRecord } from '@/types/dre';
import { formatCurrency } from '@/utils/formatters';
import { getLeafRecords, getTransformedValue } from '@/hooks/useDreData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface DreGroupedTableProps {
  data: DreRecord[];
  className?: string;
}

type ViewMode = 'total' | 'ano' | 'mes' | 'mesAno';

// Mapeamento de grupo para ordem e displayName
// Estrutura contábil original (clientes não-RPA, ex.: Caspper 1001):
// cada grupo contábil possui sua própria linha, com subtotal de
// Margem de Contribuição após a ordem 8 e o Total geral ao final.
const nivelOrderMap: Record<string, { ordem: number; displayName: string }> = {
  'Receitas': { ordem: 1, displayName: 'Receitas' },
  'Impostos': { ordem: 2, displayName: '(-) Deduções de Receita' },
  'Devoluções': { ordem: 2, displayName: '(-) Deduções de Receita' },
  'Custos de Vendas de Mercadorias': { ordem: 3, displayName: 'Custos de Vendas de Mercadorias' },
  'Custos de Vendas de Serviços': { ordem: 4, displayName: 'Custos de Vendas de Serviços' },
  'Despesas com Pessoal de Vendas': { ordem: 5, displayName: 'Despesas Com Pessoal De Vendas' },
  'Outras Despesas com vendas': { ordem: 6, displayName: 'Outras Despesas com Vendas' },
  'Provisão para Credito Liquid. Duvidosas': { ordem: 7, displayName: 'Provisão para Crédito Liqui. Duvidosas' },
  'Despesas E-Commerce': { ordem: 8, displayName: 'Despesas E-Commerce' },
  'Despesas com Pessoal Administrativo': { ordem: 9, displayName: 'Despesas Administrativas' },
  'Outras Despesas Administrativas': { ordem: 10, displayName: 'Outras Despesas Administrativas' },
  'Despesas Não Dedutiveis': { ordem: 11, displayName: 'Despesas não Dedutíveis' },
  'Despesas Tributárias': { ordem: 12, displayName: 'Despesas Tributárias' },
  'Receitas Financeiros': { ordem: 13, displayName: 'Resultado Financeiro Líquido' },
  'Despesas Financeiros': { ordem: 13, displayName: 'Resultado Financeiro Líquido' },
  'Outras Receitas Operacionais': { ordem: 15, displayName: 'Outras Receitas Operacionais' },
  'Juros Sobre Capital Próprio': { ordem: 16, displayName: 'Juros Sobre Capital Próprio' },
  'Ajustes de Exercícios Anteriores': { ordem: 17, displayName: 'Ajustes de Exercícios Anteriores' },
  'Outras Despesas': { ordem: 18, displayName: 'Outras Despesas Não Operacionais' },
  'Outras Despesas Não Operacionais': { ordem: 18, displayName: 'Outras Despesas Não Operacionais' },
  'Outras Receitas': { ordem: 19, displayName: 'Outras Receitas' },
  'Provisão Para IRPJ e CSLL': { ordem: 21, displayName: 'Provisão Para IRPJ e CSLL' },
  'Sem Descrição': { ordem: 20, displayName: 'Outros' },
};


// Estrutura hierárquica com valores por período
interface Level4NumConta {
  numConta: string;
  valores: Record<string, number>; // key = período (ano ou ano-mes)
}

interface Level3Descricao {
  descricao: string;
  valores: Record<string, number>;
  numContas: Level4NumConta[];
}

interface Level2Grupo {
  grupo: string;
  valores: Record<string, number>;
  descricoes: Level3Descricao[];
}

interface Level1Categoria {
  categoria: string;
  displayName: string;
  ordem: number;
  valores: Record<string, number>;
  grupos: Level2Grupo[];
}

// Transformação de valor centralizada (ver useDreData.getTransformedValue)


// Formata nome do mês
function formatMes(anoMes: string): string {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [ano, mes] = anoMes.split('-');
  return `${meses[parseInt(mes) - 1]}/${ano.slice(2)}`;
}

// Formata apenas o nome do mês (sem ano)
function formatMesOnly(mes: string): string {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return meses[parseInt(mes) - 1] || mes;
}

export function DreGroupedTableLegacy({ data, className }: DreGroupedTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('total');
  const [showAV, setShowAV] = useState<boolean>(true); // Análise Vertical ativa por padrão
  const [showAH, setShowAH] = useState<boolean>(true); // Análise Horizontal ativa por padrão
  const [expandedLevel1, setExpandedLevel1] = useState<Set<string>>(new Set());
  const [expandedLevel2, setExpandedLevel2] = useState<Set<string>>(new Set());
  const [expandedLevel3, setExpandedLevel3] = useState<Set<string>>(new Set());

  // Extrai períodos únicos
  const { anos, meses, mesesDoAno } = useMemo(() => {
    const anosSet = new Set<string>();
    const mesesSet = new Set<string>();
    const mesesDoAnoSet = new Set<string>(); // apenas o número do mês (01-12)
    data.forEach((r) => {
      anosSet.add(r.ano_mes.substring(0, 4));
      mesesSet.add(r.ano_mes);
      mesesDoAnoSet.add(r.ano_mes.substring(5, 7));
    });
    return {
      anos: [...anosSet].sort(),
      meses: [...mesesSet].sort(),
      mesesDoAno: [...mesesDoAnoSet].sort(),
    };
  }, [data]);

  // Determina as colunas baseado no viewMode
  const colunas = useMemo(() => {
    switch (viewMode) {
      case 'ano':
        return anos;
      case 'mes':
        return meses;
      case 'mesAno':
        // Retorna meses únicos (01-12) para exibir como colunas
        return mesesDoAno;
      default:
        return ['total'];
    }
  }, [viewMode, anos, meses, mesesDoAno]);

  // Para o modo mesAno, calcula valores somando todos os anos para cada mês
  const getValorMesAno = useCallback((valores: Record<string, number>, mes: string): number => {
    let total = 0;
    anos.forEach((ano) => {
      const key = `${ano}-${mes}`;
      total += valores[key] || 0;
    });
    return total;
  }, [anos]);

  // Constrói hierarquia com valores por período
  const hierarchy = useMemo(() => {
    const categorias: Record<string, Level1Categoria> = {};

    // Usa a MESMA fonte de verdade que Dashboard/Indicadores: registros folha
    // (nível mais detalhado por grupo). Evita dupla contagem e divergências.
    const recordsParaAgregar = getLeafRecords(data);

    recordsParaAgregar.forEach((record) => {
      const grupoOriginal = record.grupo || 'Sem Descrição';
      const mapping = nivelOrderMap[grupoOriginal] || { ordem: 20, displayName: grupoOriginal };
      const categoriaKey = mapping.displayName;
      const valorTransformado = getTransformedValue(record);


      // Determina a chave do período
      const periodoAno = record.ano_mes.substring(0, 4);
      const periodoMes = record.ano_mes;

      // Nível 1: Categoria
      if (!categorias[categoriaKey]) {
        categorias[categoriaKey] = {
          categoria: categoriaKey,
          displayName: mapping.displayName,
          ordem: mapping.ordem,
          valores: {},
          grupos: [],
        };
      }
      const cat = categorias[categoriaKey];
      cat.valores['total'] = (cat.valores['total'] || 0) + valorTransformado;
      cat.valores[periodoAno] = (cat.valores[periodoAno] || 0) + valorTransformado;
      cat.valores[periodoMes] = (cat.valores[periodoMes] || 0) + valorTransformado;

      // Nível 2: Grupo
      let grupo = cat.grupos.find((g) => g.grupo === grupoOriginal);
      if (!grupo) {
        grupo = { grupo: grupoOriginal, valores: {}, descricoes: [] };
        cat.grupos.push(grupo);
      }
      grupo.valores['total'] = (grupo.valores['total'] || 0) + valorTransformado;
      grupo.valores[periodoAno] = (grupo.valores[periodoAno] || 0) + valorTransformado;
      grupo.valores[periodoMes] = (grupo.valores[periodoMes] || 0) + valorTransformado;

      // Nível 3: Descrição
      let descricaoItem = grupo.descricoes.find((d) => d.descricao === record.descricao);
      if (!descricaoItem) {
        descricaoItem = { descricao: record.descricao, valores: {}, numContas: [] };
        grupo.descricoes.push(descricaoItem);
      }
      descricaoItem.valores['total'] = (descricaoItem.valores['total'] || 0) + valorTransformado;
      descricaoItem.valores[periodoAno] = (descricaoItem.valores[periodoAno] || 0) + valorTransformado;
      descricaoItem.valores[periodoMes] = (descricaoItem.valores[periodoMes] || 0) + valorTransformado;

      // Nível 4: NumConta
      let numContaItem = descricaoItem.numContas.find((n) => n.numConta === record.codigo);
      if (!numContaItem) {
        numContaItem = { numConta: record.codigo, valores: {} };
        descricaoItem.numContas.push(numContaItem);
      }
      numContaItem.valores['total'] = (numContaItem.valores['total'] || 0) + valorTransformado;
      numContaItem.valores[periodoAno] = (numContaItem.valores[periodoAno] || 0) + valorTransformado;
      numContaItem.valores[periodoMes] = (numContaItem.valores[periodoMes] || 0) + valorTransformado;
    });

    return Object.values(categorias).sort((a, b) => a.ordem - b.ordem);
  }, [data]);

  // Totais por coluna
  const totaisPorColuna = useMemo(() => {
    const totais: Record<string, number> = {};
    colunas.forEach((col) => {
      if (viewMode === 'mesAno') {
        totais[col] = hierarchy.reduce((sum, cat) => sum + getValorMesAno(cat.valores, col), 0);
      } else {
        totais[col] = hierarchy.reduce((sum, cat) => sum + (cat.valores[col] || 0), 0);
      }
    });
    return totais;
  }, [hierarchy, colunas, viewMode, getValorMesAno]);

  // Receita total por coluna (base 100% da Análise Vertical)
  const receitaPorColuna = useMemo(() => {
    const receitas: Record<string, number> = {};
    const categoriaReceita = hierarchy.find((cat) => cat.displayName === 'Receitas');
    if (!categoriaReceita) return receitas;
    
    colunas.forEach((col) => {
      if (viewMode === 'mesAno') {
        receitas[col] = getValorMesAno(categoriaReceita.valores, col);
      } else {
        receitas[col] = categoriaReceita.valores[col] || 0;
      }
    });
    return receitas;
  }, [hierarchy, colunas, viewMode, getValorMesAno]);

  // Calcula % da Análise Vertical (valor / receita * 100)
  const calcularAV = (valor: number, coluna: string): number | null => {
    const receita = receitaPorColuna[coluna];
    if (!receita || receita === 0) return null;
    return (valor / receita) * 100;
  };

  // Formata a AV%
  const formatAV = (av: number | null): string => {
    if (av === null) return '-';
    return `${av.toFixed(1)}%`;
  };

  // Calcula % da Análise Horizontal (variação entre períodos)
  const calcularAH = (valores: Record<string, number>, colIndex: number): number | null => {
    if (colIndex === 0) return null; // Primeiro período não tem anterior
    
    const colAtual = colunas[colIndex];
    const colAnterior = colunas[colIndex - 1];
    
    let valorAtual: number;
    let valorAnterior: number;
    
    if (viewMode === 'mesAno') {
      valorAtual = getValorMesAno(valores, colAtual);
      valorAnterior = getValorMesAno(valores, colAnterior);
    } else {
      valorAtual = valores[colAtual] || 0;
      valorAnterior = valores[colAnterior] || 0;
    }
    
    if (valorAnterior === 0) {
      if (valorAtual === 0) return 0;
      return null; // Não é possível calcular se anterior é zero
    }
    
    return ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100;
  };

  // Formata a AH%
  const formatAH = (ah: number | null): string => {
    if (ah === null) return '-';
    const prefix = ah > 0 ? '+' : '';
    return `${prefix}${ah.toFixed(1)}%`;
  };

  // Cor do AH baseada em positivo/negativo (mais ofuscada)
  const getAHColor = (ah: number | null): string => {
    if (ah === null) return 'text-muted-foreground/40';
    if (ah > 0) return 'text-emerald-600/60 dark:text-emerald-400/60';
    if (ah < 0) return 'text-red-600/60 dark:text-red-400/60';
    return 'text-muted-foreground/40';
  };

  // Cor do AV (mais ofuscada que valores principais)
  const getAVColor = (): string => {
    return 'text-muted-foreground/60';
  };

  // Margem de Contribuição - soma de todas as categorias até Despesas E-Commerce (ordem <= 8)
  const margemContribuicaoPorColuna = useMemo(() => {
    const margem: Record<string, number> = {};
    const cats = hierarchy.filter((cat) => cat.ordem <= 8);
    colunas.forEach((col) => {
      if (viewMode === 'mesAno') {
        margem[col] = cats.reduce((sum, cat) => sum + getValorMesAno(cat.valores, col), 0);
      } else {
        margem[col] = cats.reduce((sum, cat) => sum + (cat.valores[col] || 0), 0);
      }
    });
    return margem;
  }, [hierarchy, colunas, viewMode, getValorMesAno]);

  // Resultado Líquido antes IRPJ E CSLL - soma das categorias de ordem 9 a 19
  const resultadoLiquidoPorColuna = useMemo(() => {
    const res: Record<string, number> = {};
    const cats = hierarchy.filter((cat) => cat.ordem >= 9 && cat.ordem <= 19);
    colunas.forEach((col) => {
      if (viewMode === 'mesAno') {
        res[col] = cats.reduce((sum, cat) => sum + getValorMesAno(cat.valores, col), 0);
      } else {
        res[col] = cats.reduce((sum, cat) => sum + (cat.valores[col] || 0), 0);
      }
    });
    return res;
  }, [hierarchy, colunas, viewMode, getValorMesAno]);

  const temResultadoLiquido = useMemo(
    () => hierarchy.some((cat) => cat.ordem >= 9 && cat.ordem <= 19),
    [hierarchy]
  );

  // Despesas Fixas - soma das categorias de ordem 9 a 12 (linha exibida acima dos 4 blocos)
  const despesasFixasPorColuna = useMemo(() => {
    const res: Record<string, number> = {};
    const cats = hierarchy.filter((cat) => cat.ordem >= 9 && cat.ordem <= 12);
    colunas.forEach((col) => {
      if (viewMode === 'mesAno') {
        res[col] = cats.reduce((sum, cat) => sum + getValorMesAno(cat.valores, col), 0);
      } else {
        res[col] = cats.reduce((sum, cat) => sum + (cat.valores[col] || 0), 0);
      }
    });
    return res;
  }, [hierarchy, colunas, viewMode, getValorMesAno]);





  const toggleLevel = (level: 1 | 2 | 3, key: string) => {
    const setters = { 1: setExpandedLevel1, 2: setExpandedLevel2, 3: setExpandedLevel3 };
    setters[level]((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    const l1 = new Set<string>();
    const l2 = new Set<string>();
    const l3 = new Set<string>();
    hierarchy.forEach((cat) => {
      l1.add(cat.displayName);
      cat.grupos.forEach((grupo) => {
        l2.add(`${cat.displayName}-${grupo.grupo}`);
        grupo.descricoes.forEach((desc) => {
          l3.add(`${cat.displayName}-${grupo.grupo}-${desc.descricao}`);
        });
      });
    });
    setExpandedLevel1(l1);
    setExpandedLevel2(l2);
    setExpandedLevel3(l3);
  };

  const collapseAll = () => {
    setExpandedLevel1(new Set());
    setExpandedLevel2(new Set());
    setExpandedLevel3(new Set());
  };

  const getValueColor = (valor: number) => {
    if (valor > 0) return 'text-emerald-600 dark:text-emerald-400';
    if (valor < 0) return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const formatColHeader = (col: string) => {
    if (col === 'total') return 'Valor Total';
    if (viewMode === 'mesAno') return formatMesOnly(col);
    if (col.includes('-')) return formatMes(col);
    return col;
  };

  // Função helper para obter valor baseado no viewMode
  const getDisplayValue = (valores: Record<string, number>, col: string): number => {
    if (viewMode === 'mesAno') {
      return getValorMesAno(valores, col);
    }
    return valores[col] || 0;
  };

  // Exportação para Excel respeitando a estrutura exibida na tela
  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');

    const header1: (string | number)[] = ['Descrição'];
    const header2: (string | number)[] = [''];
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
    let colCursor = 1;

    colunas.forEach((col, colIndex) => {
      let span = 1;
      if (showAV) span++;
      if (showAH && colIndex > 0) span++;
      header1.push(formatColHeader(col));
      header2.push('Valor');
      for (let i = 1; i < span; i++) header1.push('');
      if (showAV) header2.push('AV%');
      if (showAH && colIndex > 0) header2.push('AH%');
      if (span > 1) {
        merges.push({ s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + span - 1 } });
      }
      colCursor += span;
    });

    const rows: (string | number | null)[][] = [header1, header2];

    const pushRow = (label: string, valores: Record<string, number>, indent: number, isTotalRow = false) => {
      const row: (string | number | null)[] = [`${'    '.repeat(indent)}${label}`];
      colunas.forEach((col, colIndex) => {
        const valor = isTotalRow ? (valores[col] || 0) : getDisplayValue(valores, col);
        row.push(valor);
        if (showAV) {
          const av = calcularAV(valor, col);
          row.push(av === null ? '-' : Number((av / 100).toFixed(4)));
        }
        if (showAH && colIndex > 0) {
          const ah = calcularAH(valores, colIndex);
          row.push(ah === null ? '-' : Number((ah / 100).toFixed(4)));
        }
      });
      rows.push(row);
    };

    hierarchy.forEach((cat, catIndex) => {
      const prevCat = hierarchy[catIndex - 1];
      if (cat.ordem >= 9 && cat.ordem <= 12 && (!prevCat || prevCat.ordem < 9)) {
        pushRow('Despesas Fixas', despesasFixasPorColuna, 0, true);
      }
      pushRow(cat.displayName, cat.valores, 0);

      cat.grupos.forEach((grupo) => {
        pushRow(grupo.grupo, grupo.valores, 1);
        grupo.descricoes.forEach((desc) => {
          pushRow(desc.descricao, desc.valores, 2);
          desc.numContas.forEach((nc) => {
            pushRow(nc.numConta, nc.valores, 3);
          });
        });
      });

      const nextCat = hierarchy[catIndex + 1];
      if (cat.ordem <= 8 && (!nextCat || nextCat.ordem > 8)) {
        pushRow('Margem de Contribuição', margemContribuicaoPorColuna, 0, true);
      }
      if (cat.ordem >= 9 && cat.ordem <= 19 && (!nextCat || nextCat.ordem > 19)) {
        pushRow('Resultado Líquido antes IRPJ E CSLL', resultadoLiquidoPorColuna, 0, true);
      }
    });

    pushRow('Total', totaisPorColuna, 0, true);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = merges;
    ws['!cols'] = [{ wch: 55 }, ...Array(header2.length - 1).fill({ wch: 16 })];

    // Formatação numérica
    const range = XLSX.utils.decode_range(ws['!ref'] as string);
    for (let r = 2; r <= range.e.r; r++) {
      for (let c = 1; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cell || typeof cell.v !== 'number') continue;
        cell.z = header2[c] === 'Valor' ? '#,##0.00;(#,##0.00);-' : '0.0%';
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DRE Detalhado');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `DRE-Detalhado-${stamp}.xlsx`);
  };



  return (
    <div className={cn('bg-card rounded-xl border border-border overflow-hidden', className)}>
      {/* Header com Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 border-b border-border bg-muted/30 gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Demonstrativo de Resultado</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hierarchy.length} categoria{hierarchy.length !== 1 ? 's' : ''} • Estrutura contábil
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Tabs de visualização */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="total" className="text-xs px-2 h-7">Total</TabsTrigger>
              <TabsTrigger value="ano" className="text-xs px-2 h-7">Por Ano</TabsTrigger>
              <TabsTrigger value="mes" className="text-xs px-2 h-7">Por Mês</TabsTrigger>
              <TabsTrigger value="mesAno" className="text-xs px-2 h-7">Mês/Ano</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Toggle AV% */}
          <div className="flex items-center gap-2">
            <Switch
              id="av-toggle"
              checked={showAV}
              onCheckedChange={setShowAV}
              className="h-4 w-8"
            />
            <Label htmlFor="av-toggle" className="text-xs text-muted-foreground cursor-pointer">
              AV%
            </Label>
          </div>

          {/* Toggle AH% - só mostra se tiver mais de uma coluna */}
          {colunas.length > 1 && (
            <div className="flex items-center gap-2">
              <Switch
                id="ah-toggle"
                checked={showAH}
                onCheckedChange={setShowAH}
                className="h-4 w-8"
              />
              <Label htmlFor="ah-toggle" className="text-xs text-muted-foreground cursor-pointer">
                AH%
              </Label>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-primary/10 transition-colors">
              Expandir
            </button>
            <span className="text-muted-foreground text-xs">|</span>
            <button onClick={collapseAll} className="text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-primary/10 transition-colors">
              Recolher
            </button>
          </div>

          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>

        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/60">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[280px]">
                Descrição
              </th>
              {colunas.map((col, colIndex) => {
                let colSpan = 1;
                if (showAV) colSpan++;
                if (showAH && colIndex > 0) colSpan++;
                return (
                  <th key={col} colSpan={colSpan} className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {formatColHeader(col)}
                  </th>
                );
              })}
            </tr>
            {(showAV || showAH) && (
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-1.5 text-[10px] font-medium text-muted-foreground tracking-wider">
                  
                </th>
                {colunas.map((col, colIndex) => (
                  <>
                    <th key={`${col}-valor`} className="text-right px-3 py-1.5 text-[10px] font-medium text-muted-foreground tracking-wider w-28">
                      Valor
                    </th>
                    {showAV && (
                      <th key={`${col}-av`} className="text-right px-3 py-1.5 text-[10px] font-medium text-muted-foreground tracking-wider w-16 bg-muted/30">
                        AV%
                      </th>
                    )}
                    {showAH && colIndex > 0 && (
                      <th key={`${col}-ah`} className="text-right px-3 py-1.5 text-[10px] font-medium text-muted-foreground tracking-wider w-16 bg-blue-500/10">
                        AH%
                      </th>
                    )}
                  </>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {hierarchy.map((cat, catIndex) => {
              const isL1Expanded = expandedLevel1.has(cat.displayName);
              const nextCat = hierarchy[catIndex + 1];
              const prevCat = hierarchy[catIndex - 1];
              // Margem de Contribuição: após última categoria com ordem <= 8
              const shouldShowMargemContribuicao = cat.ordem <= 8 && (!nextCat || nextCat.ordem > 8);
              // RESULTADO LIQUIDO: após última categoria com ordem entre 9 e 16
              const shouldShowResultadoLiquido =
                temResultadoLiquido && cat.ordem >= 9 && cat.ordem <= 19 && (!nextCat || nextCat.ordem > 19);
              // Despesas Fixas: antes da primeira categoria com ordem entre 9 e 12
              const shouldShowDespesasFixas =
                cat.ordem >= 9 && cat.ordem <= 12 && (!prevCat || prevCat.ordem < 9);

              return (
                <>
                  {/* Despesas Fixas - Totalizador acima dos 4 blocos administrativos */}
                  {shouldShowDespesasFixas && (
                    <tr className="dre-table-row border-b-2 border-t border-border bg-muted/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5" />
                          <span className="font-bold text-sm text-foreground">Despesas Fixas</span>
                        </div>
                      </td>
                      {colunas.map((col, colIndex) => {
                        const valor = despesasFixasPorColuna[col] || 0;
                        const av = calcularAV(valor, col);
                        const ah = calcularAH(despesasFixasPorColuna, colIndex);
                        return (
                          <>
                            <td key={col} className={cn('px-3 py-3 text-right tabular-nums font-mono font-bold text-sm', getValueColor(valor))}>
                              {formatCurrency(valor)}
                            </td>
                            {showAV && (
                              <td key={`${col}-av`} className="px-3 py-3 text-right tabular-nums font-mono text-xs text-muted-foreground/50 bg-muted/30">
                                {formatAV(av)}
                              </td>
                            )}
                            {showAH && colIndex > 0 && (
                              <td key={`${col}-ah`} className={cn('px-3 py-3 text-right tabular-nums font-mono text-xs bg-blue-500/10', getAHColor(ah))}>
                                {formatAH(ah)}
                              </td>
                            )}
                          </>
                        );
                      })}
                    </tr>
                  )}


                  {/* Nível 1: Categoria */}
                  <tr
                    key={cat.displayName}
                    className="dre-table-row border-b border-border bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
                    onClick={() => toggleLevel(1, cat.displayName)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="p-0.5">
                          {isL1Expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </span>
                        <span className="font-semibold text-sm">{cat.displayName}</span>
                      </div>
                    </td>
                    {colunas.map((col, colIndex) => {
                      const valor = getDisplayValue(cat.valores, col);
                      const av = calcularAV(valor, col);
                      const ah = calcularAH(cat.valores, colIndex);
                      return (
                        <>
                          <td key={col} className={cn('px-3 py-3 text-right tabular-nums font-mono font-semibold text-sm', getValueColor(valor))}>
                            {formatCurrency(valor)}
                          </td>
                          {showAV && (
                            <td key={`${col}-av`} className="px-3 py-3 text-right tabular-nums font-mono text-xs text-muted-foreground/50 bg-muted/20">
                              {formatAV(av)}
                            </td>
                          )}
                          {showAH && colIndex > 0 && (
                            <td key={`${col}-ah`} className={cn('px-3 py-3 text-right tabular-nums font-mono text-xs bg-blue-500/5', getAHColor(ah))}>
                              {formatAH(ah)}
                            </td>
                          )}
                        </>
                      );
                    })}
                  </tr>

                  {/* Nível 2: Grupo */}
                  {isL1Expanded &&
                    cat.grupos.map((grupo) => {
                      const l2Key = `${cat.displayName}-${grupo.grupo}`;
                      const isL2Expanded = expandedLevel2.has(l2Key);

                      return (
                        <>
                          <tr
                            key={l2Key}
                            className="dre-table-row border-b border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); toggleLevel(2, l2Key); }}
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2 pl-6">
                                <span className="p-0.5">
                                  {isL2Expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                </span>
                                <span className="text-sm font-medium text-foreground/80">{grupo.grupo}</span>
                              </div>
                            </td>
                            {colunas.map((col, colIndex) => {
                              const valor = getDisplayValue(grupo.valores, col);
                              const av = calcularAV(valor, col);
                              const ah = calcularAH(grupo.valores, colIndex);
                              return (
                                <>
                                  <td key={col} className={cn('px-3 py-2 text-right tabular-nums font-mono text-sm font-medium', getValueColor(valor))}>
                                    {formatCurrency(valor)}
                                  </td>
                                  {showAV && (
                                    <td key={`${col}-av`} className="px-3 py-2 text-right tabular-nums font-mono text-xs text-muted-foreground/50 bg-muted/10">
                                      {formatAV(av)}
                                    </td>
                                  )}
                                  {showAH && colIndex > 0 && (
                                    <td key={`${col}-ah`} className={cn('px-3 py-2 text-right tabular-nums font-mono text-xs bg-blue-500/5', getAHColor(ah))}>
                                      {formatAH(ah)}
                                    </td>
                                  )}
                                </>
                              );
                            })}
                          </tr>

                          {/* Nível 3: Descrição */}
                          {isL2Expanded &&
                            grupo.descricoes.map((desc) => {
                              const l3Key = `${l2Key}-${desc.descricao}`;
                              const isL3Expanded = expandedLevel3.has(l3Key);

                              return (
                                <>
                                  <tr
                                    key={l3Key}
                                    className="dre-table-row border-b border-border/30 hover:bg-muted/15 transition-colors cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); toggleLevel(3, l3Key); }}
                                  >
                                    <td className="px-4 py-1.5">
                                      <div className="flex items-center gap-2 pl-12">
                                        <span className="p-0.5">
                                          {isL3Expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                        </span>
                                        <span className="text-xs text-foreground/70">{desc.descricao}</span>
                                      </div>
                                    </td>
                                    {colunas.map((col, colIndex) => {
                                      const valor = getDisplayValue(desc.valores, col);
                                      const av = calcularAV(valor, col);
                                      const ah = calcularAH(desc.valores, colIndex);
                                      return (
                                        <>
                                          <td key={col} className={cn('px-3 py-1.5 text-right tabular-nums font-mono text-xs', getValueColor(valor))}>
                                            {formatCurrency(valor)}
                                          </td>
                                          {showAV && (
                                            <td key={`${col}-av`} className="px-3 py-1.5 text-right tabular-nums font-mono text-[10px] text-muted-foreground/40 bg-muted/5">
                                              {formatAV(av)}
                                            </td>
                                          )}
                                          {showAH && colIndex > 0 && (
                                            <td key={`${col}-ah`} className={cn('px-3 py-1.5 text-right tabular-nums font-mono text-[10px] bg-blue-500/5', getAHColor(ah))}>
                                              {formatAH(ah)}
                                            </td>
                                          )}
                                        </>
                                      );
                                    })}
                                  </tr>

                                  {/* Nível 4: NumConta */}
                                  {isL3Expanded &&
                                    desc.numContas.map((nc, idx) => (
                                      <tr key={`${l3Key}-${nc.numConta}-${idx}`} className="dre-table-row border-b border-border/20 hover:bg-muted/10 transition-colors">
                                        <td className="px-4 py-1">
                                          <div className="flex items-center gap-2 pl-20">
                                            <Minus className="h-2 w-2 text-muted-foreground/30" />
                                            <span className="text-xs text-muted-foreground font-mono">{nc.numConta}</span>
                                          </div>
                                        </td>
                                        {colunas.map((col, colIndex) => {
                                          const valor = getDisplayValue(nc.valores, col);
                                          const av = calcularAV(valor, col);
                                          const ah = calcularAH(nc.valores, colIndex);
                                          return (
                                            <>
                                              <td key={col} className={cn('px-3 py-1 text-right tabular-nums font-mono text-xs', getValueColor(valor))}>
                                                {formatCurrency(valor)}
                                              </td>
                                              {showAV && (
                                                <td key={`${col}-av`} className="px-3 py-1 text-right tabular-nums font-mono text-[10px] text-muted-foreground/40 bg-muted/5">
                                                  {formatAV(av)}
                                                </td>
                                              )}
                                              {showAH && colIndex > 0 && (
                                                <td key={`${col}-ah`} className={cn('px-3 py-1 text-right tabular-nums font-mono text-[10px] bg-blue-500/5', getAHColor(ah))}>
                                                  {formatAH(ah)}
                                                </td>
                                              )}
                                            </>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                </>
                              );
                            })}
                        </>
                      );
                    })}

                  {/* Margem de Contribuição - Subtotal após Despesas E-Commerce */}
                  {shouldShowMargemContribuicao && (
                    <tr className="dre-table-row border-b-2 border-t border-border bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5" />
                          <span className="font-bold text-sm text-foreground">Margem de Contribuição</span>
                        </div>
                      </td>
                      {colunas.map((col, colIndex) => {
                        const valor = margemContribuicaoPorColuna[col] || 0;
                        const av = calcularAV(valor, col);
                        const ah = calcularAH(margemContribuicaoPorColuna, colIndex);
                        return (
                          <>
                            <td key={col} className={cn('px-3 py-3 text-right tabular-nums font-mono font-bold text-sm', getValueColor(valor))}>
                              {formatCurrency(valor)}
                            </td>
                            {showAV && (
                              <td key={`${col}-av`} className="px-3 py-3 text-right tabular-nums font-mono text-xs text-muted-foreground/50 bg-muted/30">
                                {formatAV(av)}
                              </td>
                            )}
                            {showAH && colIndex > 0 && (
                              <td key={`${col}-ah`} className={cn('px-3 py-3 text-right tabular-nums font-mono text-xs bg-blue-500/10', getAHColor(ah))}>
                                {formatAH(ah)}
                              </td>
                            )}
                          </>
                        );
                      })}
                    </tr>
                  )}

                  {/* RESULTADO LIQUIDO - Subtotal após Juros Sobre Capital Próprio */}
                  {shouldShowResultadoLiquido && (
                    <tr className="dre-table-row border-b-2 border-t border-border bg-muted/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5" />
                          <span className="font-bold text-sm text-foreground tracking-wide">Resultado Líquido antes IRPJ E CSLL</span>
                        </div>
                      </td>
                      {colunas.map((col, colIndex) => {
                        const valor = resultadoLiquidoPorColuna[col] || 0;
                        const av = calcularAV(valor, col);
                        const ah = calcularAH(resultadoLiquidoPorColuna, colIndex);
                        return (
                          <>
                            <td key={col} className={cn('px-3 py-3 text-right tabular-nums font-mono font-bold text-sm', getValueColor(valor))}>
                              {formatCurrency(valor)}
                            </td>
                            {showAV && (
                              <td key={`${col}-av`} className="px-3 py-3 text-right tabular-nums font-mono text-xs text-muted-foreground/50 bg-muted/30">
                                {formatAV(av)}
                              </td>
                            )}
                            {showAH && colIndex > 0 && (
                              <td key={`${col}-ah`} className={cn('px-3 py-3 text-right tabular-nums font-mono text-xs bg-blue-500/10', getAHColor(ah))}>
                                {formatAH(ah)}
                              </td>
                            )}
                          </>
                        );
                      })}
                    </tr>
                  )}
                </>
              );
            })}

            {/* Total Geral */}
            <tr className="border-t-2 border-border bg-primary/10">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-5" />
                  <span className="font-bold text-base">Total</span>
                </div>
              </td>
              {colunas.map((col, colIndex) => {
                const valor = totaisPorColuna[col] || 0;
                const av = calcularAV(valor, col);
                const ah = calcularAH(totaisPorColuna, colIndex);
                return (
                  <>
                    <td key={col} className={cn('px-3 py-3 text-right tabular-nums font-mono font-bold text-base', getValueColor(valor))}>
                      {formatCurrency(valor)}
                    </td>
                    {showAV && (
                      <td key={`${col}-av`} className="px-3 py-3 text-right tabular-nums font-mono text-xs text-muted-foreground/50 bg-primary/5">
                        {formatAV(av)}
                      </td>
                    )}
                    {showAH && colIndex > 0 && (
                      <td key={`${col}-ah`} className={cn('px-3 py-3 text-right tabular-nums font-mono text-xs bg-blue-500/10', getAHColor(ah))}>
                        {formatAH(ah)}
                      </td>
                    )}
                  </>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30"></span>
          Positivo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30"></span>
          Negativo
        </span>
      </div>
    </div>
  );
}
