import { useMemo, useState } from 'react';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { DreGroupedTableLegacy } from './DreGroupedTableLegacy';
import { ChevronRight, ChevronDown, Minus, ChevronsDownUp, ChevronsUpDown, FileBarChart2, Sparkles } from 'lucide-react';
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
// Estrutura fixa solicitada:
//  1 Receitas
//  2 (-) Deduções de Receita
//  3 Custo de Vendas de Mercadorias
//  4 Despesas com Vendas
//   => [Margem de Contribuição = soma de 1..4]
//  6 Despesas fixas
//  7 Resultado Financeiro Líquido
//  8 Outras Receitas
//   => [Lucro/Prejuízo = Margem + 6 + 7 + 8]
// 10 Saídas de Caixa - Financeiro
//   => [Total]
const nivelOrderMap: Record<string, { ordem: number; displayName: string }> = {
  'Receitas': { ordem: 1, displayName: 'Receitas' },
  'Impostos': { ordem: 2, displayName: '(-) Deduções de Receita' },
  'Devoluções': { ordem: 2, displayName: '(-) Deduções de Receita' },
  'Deduções de Receita': { ordem: 2, displayName: '(-) Deduções de Receita' },
  '(-) Deduções de Receita': { ordem: 2, displayName: '(-) Deduções de Receita' },
  'Custo de Vendas de Mercadorias': { ordem: 3, displayName: 'Custo de Vendas de Mercadorias' },
  'Custos de Vendas de Mercadorias': { ordem: 3, displayName: 'Custo de Vendas de Mercadorias' },
  // Despesas com Vendas agrupa CMV de serviços + pessoal vendas + outras despesas com vendas + PDD + e-commerce
  'Despesas com Vendas': { ordem: 4, displayName: 'Despesas com Vendas' },
  'Custos de Vendas de Serviços': { ordem: 4, displayName: 'Despesas com Vendas' },
  'Despesas com Pessoal de Vendas': { ordem: 4, displayName: 'Despesas com Vendas' },
  'Outras Despesas com vendas': { ordem: 4, displayName: 'Despesas com Vendas' },
  'Provisão para Credito Liquid. Duvidosas': { ordem: 4, displayName: 'Despesas com Vendas' },
  'Despesas E-Commerce': { ordem: 4, displayName: 'Despesas com Vendas' },
  // Despesas fixas
  'Despesas Fixas': { ordem: 6, displayName: 'Despesas fixas' },
  'Despesas fixas': { ordem: 6, displayName: 'Despesas fixas' },
  'Despesas com Pessoal Administrativo': { ordem: 6, displayName: 'Despesas fixas' },
  'Outras Despesas Administrativas': { ordem: 6, displayName: 'Despesas fixas' },
  'Despesas Não Dedutiveis': { ordem: 6, displayName: 'Despesas fixas' },
  'Despesas Tributárias': { ordem: 6, displayName: 'Despesas fixas' },
  // Resultado Financeiro Líquido
  'Resultado Financeiro': { ordem: 7, displayName: 'Resultado Financeiro Líquido' },
  'Resultado Financeiro Líquido': { ordem: 7, displayName: 'Resultado Financeiro Líquido' },
  'Receitas Financeiros': { ordem: 7, displayName: 'Resultado Financeiro Líquido' },
  'Despesas Financeiros': { ordem: 7, displayName: 'Resultado Financeiro Líquido' },
  // Outras Receitas
  'Outras Receitas': { ordem: 8, displayName: 'Outras Receitas' },
  'Outras Receitas Operacionais': { ordem: 8, displayName: 'Outras Receitas' },
  'Juros Sobre Capital Próprio': { ordem: 8, displayName: 'Outras Receitas' },
  // Saídas de Caixa - Financeiro
  'Saídas de Caixa - Financeiro': { ordem: 10, displayName: 'Saídas de Caixa - Financeiro' },
  'Outras Despesas': { ordem: 10, displayName: 'Saídas de Caixa - Financeiro' },
  'Provisão Para IRPJ e CSLL': { ordem: 10, displayName: 'Saídas de Caixa - Financeiro' },
  'Ajustes de Exercícios Anteriores': { ordem: 10, displayName: 'Saídas de Caixa - Financeiro' },
  'Sem Descrição': { ordem: 10, displayName: 'Saídas de Caixa - Financeiro' },
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

export function DreGroupedTable(props: DreGroupedTableProps) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  // Estrutura reordenada (Margem de Contribuição + Resultado Líquido) é específica do cliente RPA.
  if (codEmpresaAtiva !== '1002') {
    return <DreGroupedTableLegacy {...props} />;
  }
  return <DreGroupedTableRPA {...props} />;
}

function DreGroupedTableRPA({ data, className }: DreGroupedTableProps) {
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
  const getValorMesAno = (valores: Record<string, number>, mes: string): number => {
    let total = 0;
    anos.forEach((ano) => {
      const key = `${ano}-${mes}`;
      total += valores[key] || 0;
    });
    return total;
  };

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
  }, [hierarchy, colunas, viewMode, anos]);

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
  }, [hierarchy, colunas, viewMode, anos]);

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

  // Margem de Contribuição - soma de Receitas, Deduções, Custo Mercadorias e Despesas com Vendas (ordem <= 4)
  const margemContribuicaoPorColuna = useMemo(() => {
    const margem: Record<string, number> = {};
    const cats = hierarchy.filter((cat) => cat.ordem <= 4);
    colunas.forEach((col) => {
      if (viewMode === 'mesAno') {
        margem[col] = cats.reduce((sum, cat) => sum + getValorMesAno(cat.valores, col), 0);
      } else {
        margem[col] = cats.reduce((sum, cat) => sum + (cat.valores[col] || 0), 0);
      }
    });
    return margem;
  }, [hierarchy, colunas, viewMode, anos]);

  // Lucro/Prejuízo = Margem de Contribuição + Despesas fixas (6) + Resultado Financeiro (7) + Outras Receitas (8)
  const lucroPrejuizoPorColuna = useMemo(() => {
    const lucro: Record<string, number> = {};
    const cats = hierarchy.filter((cat) => cat.ordem === 6 || cat.ordem === 7 || cat.ordem === 8);
    colunas.forEach((col) => {
      const somaOutros = viewMode === 'mesAno'
        ? cats.reduce((sum, cat) => sum + getValorMesAno(cat.valores, col), 0)
        : cats.reduce((sum, cat) => sum + (cat.valores[col] || 0), 0);
      lucro[col] = (margemContribuicaoPorColuna[col] || 0) + somaOutros;
    });
    return lucro;
  }, [hierarchy, colunas, viewMode, anos, margemContribuicaoPorColuna]);

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

  // Acento colorido por categoria (barrinha lateral esquerda no L1)
  const getCategoryAccent = (ordem: number): string => {
    if (ordem === 1) return 'hsl(158, 64%, 52%)';   // Receitas
    if (ordem === 2) return 'hsl(43, 96%, 56%)';    // Deduções
    if (ordem === 3) return 'hsl(24, 95%, 58%)';    // CMV
    if (ordem === 4) return 'hsl(340, 82%, 62%)';   // Despesas Vendas
    if (ordem === 6) return 'hsl(280, 65%, 65%)';   // Despesas Fixas
    if (ordem === 7) return 'hsl(199, 89%, 55%)';   // Financeiro
    if (ordem === 8) return 'hsl(158, 64%, 52%)';   // Outras Receitas
    return 'hsl(220, 9%, 55%)';                     // Saídas / demais
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60',
        'bg-gradient-to-b from-card via-card to-card/70',
        'shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_18px_50px_-24px_rgba(0,0,0,0.55)]',
        className
      )}
    >
      {/* Glow sutil superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.06] to-transparent" />

      {/* Header premium */}
      <div className="relative flex flex-col xl:flex-row items-start xl:items-center justify-between px-5 py-4 border-b border-border/60 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.5)]">
            <FileBarChart2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[15px] tracking-tight text-foreground">Demonstrativo de Resultado</h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                DRE
              </span>
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <span className="tabular-nums font-medium text-foreground/70">{hierarchy.length}</span>
              categoria{hierarchy.length !== 1 ? 's' : ''}
              <span className="text-muted-foreground/50">•</span>
              <span>Estrutura contábil hierárquica</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tabs de visualização - pill premium */}
          <div className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-muted/40 border border-border/60 backdrop-blur">
            {(['total', 'ano', 'mes', 'mesAno'] as ViewMode[]).map((mode) => {
              const label = mode === 'total' ? 'Total' : mode === 'ano' ? 'Por Ano' : mode === 'mes' ? 'Por Mês' : 'Mês/Ano';
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'h-7 px-3 text-[11.5px] font-medium rounded-lg transition-all',
                    active
                      ? 'bg-background text-foreground shadow-[0_1px_0_0_hsl(var(--border))_inset,0_2px_8px_-2px_rgba(0,0,0,0.2)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Toggles AV / AH */}
          <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-1.5">
              <Switch id="av-toggle" checked={showAV} onCheckedChange={setShowAV} className="h-4 w-8" />
              <Label htmlFor="av-toggle" className="text-[11px] font-medium text-muted-foreground cursor-pointer select-none">AV%</Label>
            </div>
            {colunas.length > 1 && (
              <>
                <span className="h-4 w-px bg-border/60" />
                <div className="flex items-center gap-1.5">
                  <Switch id="ah-toggle" checked={showAH} onCheckedChange={setShowAH} className="h-4 w-8" />
                  <Label htmlFor="ah-toggle" className="text-[11px] font-medium text-muted-foreground cursor-pointer select-none">AH%</Label>
                </div>
              </>
            )}
          </div>

          {/* Expandir / Recolher */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/50">
            <button
              onClick={expandAll}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11.5px] font-medium rounded-lg text-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              Expandir
            </button>
            <button
              onClick={collapseAll}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11.5px] font-medium rounded-lg text-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
              Recolher
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto premium-scrollbar">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border/70 bg-background/80 backdrop-blur-md">
              <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.14em] min-w-[300px]">
                Descrição
              </th>
              {colunas.map((col, colIndex) => {
                let colSpan = 1;
                if (showAV) colSpan++;
                if (showAH && colIndex > 0) colSpan++;
                return (
                  <th
                    key={col}
                    colSpan={colSpan}
                    className="text-right px-4 py-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.14em]"
                  >
                    {formatColHeader(col)}
                  </th>
                );
              })}
            </tr>
            {(showAV || showAH) && (
              <tr className="border-b border-border/60 bg-muted/25 backdrop-blur-md">
                <th className="text-left px-5 py-1.5 text-[9.5px] font-medium text-muted-foreground/70 tracking-wider" />
                {colunas.map((col, colIndex) => (
                  <>
                    <th key={`${col}-valor`} className="text-right px-3 py-1.5 text-[9.5px] font-medium text-muted-foreground/70 tracking-wider w-28">
                      Valor
                    </th>
                    {showAV && (
                      <th key={`${col}-av`} className="text-right px-3 py-1.5 text-[9.5px] font-medium text-muted-foreground/70 tracking-wider w-16 bg-muted/20">
                        AV%
                      </th>
                    )}
                    {showAH && colIndex > 0 && (
                      <th key={`${col}-ah`} className="text-right px-3 py-1.5 text-[9.5px] font-medium tracking-wider w-16 bg-sky-500/10 text-sky-300/80">
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
              const shouldShowMargemContribuicao = cat.ordem <= 4 && (!nextCat || nextCat.ordem > 4);
              const shouldShowLucroPrejuizo = cat.ordem <= 8 && (!nextCat || nextCat.ordem > 8);
              const accent = getCategoryAccent(cat.ordem);

              return (
                <>
                  {/* Nível 1: Categoria */}
                  <tr
                    key={cat.displayName}
                    className={cn(
                      'dre-table-row group/l1 border-b border-border/60 cursor-pointer transition-colors relative',
                      'bg-gradient-to-r from-muted/30 via-muted/20 to-transparent hover:from-muted/50 hover:via-muted/30'
                    )}
                    onClick={() => toggleLevel(1, cat.displayName)}
                  >
                    <td className="relative px-5 py-3.5">
                      {/* barra de acento lateral */}
                      <span
                        aria-hidden
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full opacity-80 group-hover/l1:opacity-100 transition-opacity"
                        style={{ backgroundColor: accent, boxShadow: `0 0 12px 0 ${accent}` }}
                      />
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'flex items-center justify-center h-5 w-5 rounded-md border border-border/50 bg-background/60 text-muted-foreground transition-all',
                            'group-hover/l1:text-foreground group-hover/l1:border-border'
                          )}
                        >
                          {isL1Expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </span>
                        <span className="font-semibold text-[13.5px] tracking-tight text-foreground">{cat.displayName}</span>
                      </div>
                    </td>
                    {colunas.map((col, colIndex) => {
                      const valor = getDisplayValue(cat.valores, col);
                      const av = calcularAV(valor, col);
                      const ah = calcularAH(cat.valores, colIndex);
                      return (
                        <>
                          <td key={col} className={cn('px-3 py-3.5 text-right tabular-nums font-mono font-semibold text-[13px]', getValueColor(valor))}>
                            {formatCurrency(valor)}
                          </td>
                          {showAV && (
                            <td key={`${col}-av`} className="px-3 py-3.5 text-right tabular-nums font-mono text-[11px] text-muted-foreground/70 bg-muted/20">
                              {formatAV(av)}
                            </td>
                          )}
                          {showAH && colIndex > 0 && (
                            <td key={`${col}-ah`} className={cn('px-3 py-3.5 text-right tabular-nums font-mono text-[11px] bg-sky-500/[0.06]', getAHColor(ah))}>
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
                            className="dre-table-row group/l2 border-b border-border/40 bg-muted/[0.08] hover:bg-muted/25 transition-colors cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); toggleLevel(2, l2Key); }}
                          >
                            <td className="px-5 py-2.5">
                              <div className="flex items-center gap-2 pl-6">
                                <span className="flex items-center justify-center h-4 w-4 rounded text-muted-foreground/70 group-hover/l2:text-foreground transition-colors">
                                  {isL2Expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </span>
                                <span className="text-[12.5px] font-medium text-foreground/85">{grupo.grupo}</span>
                              </div>
                            </td>
                            {colunas.map((col, colIndex) => {
                              const valor = getDisplayValue(grupo.valores, col);
                              const av = calcularAV(valor, col);
                              const ah = calcularAH(grupo.valores, colIndex);
                              return (
                                <>
                                  <td key={col} className={cn('px-3 py-2.5 text-right tabular-nums font-mono text-[12.5px] font-medium', getValueColor(valor))}>
                                    {formatCurrency(valor)}
                                  </td>
                                  {showAV && (
                                    <td key={`${col}-av`} className="px-3 py-2.5 text-right tabular-nums font-mono text-[10.5px] text-muted-foreground/60 bg-muted/10">
                                      {formatAV(av)}
                                    </td>
                                  )}
                                  {showAH && colIndex > 0 && (
                                    <td key={`${col}-ah`} className={cn('px-3 py-2.5 text-right tabular-nums font-mono text-[10.5px] bg-sky-500/[0.05]', getAHColor(ah))}>
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
                                    className="dre-table-row group/l3 border-b border-border/25 hover:bg-muted/15 transition-colors cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); toggleLevel(3, l3Key); }}
                                  >
                                    <td className="px-5 py-2">
                                      <div className="flex items-center gap-2 pl-12">
                                        <span className="text-muted-foreground/60 group-hover/l3:text-foreground/80 transition-colors">
                                          {isL3Expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </span>
                                        <span className="text-[11.5px] text-foreground/75">{desc.descricao}</span>
                                      </div>
                                    </td>
                                    {colunas.map((col, colIndex) => {
                                      const valor = getDisplayValue(desc.valores, col);
                                      const av = calcularAV(valor, col);
                                      const ah = calcularAH(desc.valores, colIndex);
                                      return (
                                        <>
                                          <td key={col} className={cn('px-3 py-2 text-right tabular-nums font-mono text-[11.5px]', getValueColor(valor))}>
                                            {formatCurrency(valor)}
                                          </td>
                                          {showAV && (
                                            <td key={`${col}-av`} className="px-3 py-2 text-right tabular-nums font-mono text-[10px] text-muted-foreground/50 bg-muted/[0.06]">
                                              {formatAV(av)}
                                            </td>
                                          )}
                                          {showAH && colIndex > 0 && (
                                            <td key={`${col}-ah`} className={cn('px-3 py-2 text-right tabular-nums font-mono text-[10px] bg-sky-500/[0.04]', getAHColor(ah))}>
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
                                      <tr key={`${l3Key}-${nc.numConta}-${idx}`} className="dre-table-row border-b border-border/15 hover:bg-muted/10 transition-colors">
                                        <td className="px-5 py-1.5">
                                          <div className="flex items-center gap-2 pl-20">
                                            <Minus className="h-2 w-2 text-muted-foreground/40" />
                                            <span className="text-[11px] text-muted-foreground/90 font-mono">{nc.numConta}</span>
                                          </div>
                                        </td>
                                        {colunas.map((col, colIndex) => {
                                          const valor = getDisplayValue(nc.valores, col);
                                          const av = calcularAV(valor, col);
                                          const ah = calcularAH(nc.valores, colIndex);
                                          return (
                                            <>
                                              <td key={col} className={cn('px-3 py-1.5 text-right tabular-nums font-mono text-[11px]', getValueColor(valor))}>
                                                {formatCurrency(valor)}
                                              </td>
                                              {showAV && (
                                                <td key={`${col}-av`} className="px-3 py-1.5 text-right tabular-nums font-mono text-[10px] text-muted-foreground/40 bg-muted/[0.05]">
                                                  {formatAV(av)}
                                                </td>
                                              )}
                                              {showAH && colIndex > 0 && (
                                                <td key={`${col}-ah`} className={cn('px-3 py-1.5 text-right tabular-nums font-mono text-[10px] bg-sky-500/[0.04]', getAHColor(ah))}>
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

                  {/* Margem de Contribuição - Subtotal */}
                  {shouldShowMargemContribuicao && (
                    <tr className="dre-table-row border-y border-primary/30 bg-gradient-to-r from-primary/[0.12] via-primary/[0.06] to-primary/[0.03]">
                      <td className="relative px-5 py-3.5">
                        <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary shadow-[0_0_12px_0_hsl(var(--primary))]" />
                        <div className="flex items-center gap-2">
                          <span className="w-5" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80 mr-2">Subtotal</span>
                          <span className="font-bold text-[13.5px] text-foreground tracking-tight">Margem de Contribuição</span>
                        </div>
                      </td>
                      {colunas.map((col, colIndex) => {
                        const valor = margemContribuicaoPorColuna[col] || 0;
                        const av = calcularAV(valor, col);
                        const ah = calcularAH(margemContribuicaoPorColuna, colIndex);
                        return (
                          <>
                            <td key={col} className={cn('px-3 py-3.5 text-right tabular-nums font-mono font-bold text-[13.5px]', getValueColor(valor))}>
                              {formatCurrency(valor)}
                            </td>
                            {showAV && (
                              <td key={`${col}-av`} className="px-3 py-3.5 text-right tabular-nums font-mono text-[11px] text-muted-foreground/70 bg-primary/[0.05]">
                                {formatAV(av)}
                              </td>
                            )}
                            {showAH && colIndex > 0 && (
                              <td key={`${col}-ah`} className={cn('px-3 py-3.5 text-right tabular-nums font-mono text-[11px] bg-sky-500/10', getAHColor(ah))}>
                                {formatAH(ah)}
                              </td>
                            )}
                          </>
                        );
                      })}
                    </tr>
                  )}

                  {/* Resultado Líquido */}
                  {shouldShowLucroPrejuizo && (() => {
                    const valorTotalLP = lucroPrejuizoPorColuna['total'] ?? Object.values(lucroPrejuizoPorColuna)[0] ?? 0;
                    const isLucro = valorTotalLP >= 0;
                    const label = 'Resultado Líquido';
                    return (
                      <tr
                        className={cn(
                          'dre-table-row border-y',
                          isLucro
                            ? 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/[0.14] via-emerald-500/[0.06] to-emerald-500/[0.03]'
                            : 'border-red-500/30 bg-gradient-to-r from-red-500/[0.14] via-red-500/[0.06] to-red-500/[0.03]'
                        )}
                      >
                        <td className="relative px-5 py-3.5">
                          <span
                            aria-hidden
                            className={cn(
                              'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full',
                              isLucro ? 'bg-emerald-400 shadow-[0_0_12px_0_hsl(158,64%,52%)]' : 'bg-red-400 shadow-[0_0_12px_0_hsl(0,72%,55%)]'
                            )}
                          />
                          <div className="flex items-center gap-2">
                            <span className="w-5" />
                            <span
                              className={cn(
                                'text-[10px] font-semibold uppercase tracking-[0.18em] mr-2',
                                isLucro ? 'text-emerald-400/80' : 'text-red-400/80'
                              )}
                            >
                              {isLucro ? 'Lucro' : 'Prejuízo'}
                            </span>
                            <span
                              className={cn(
                                'font-bold text-[13.5px] tracking-tight',
                                isLucro ? 'text-emerald-300' : 'text-red-300'
                              )}
                            >
                              {label}
                            </span>
                          </div>
                        </td>
                        {colunas.map((col, colIndex) => {
                          const valor = lucroPrejuizoPorColuna[col] || 0;
                          const av = calcularAV(valor, col);
                          const ah = calcularAH(lucroPrejuizoPorColuna, colIndex);
                          return (
                            <>
                              <td key={col} className={cn('px-3 py-3.5 text-right tabular-nums font-mono font-bold text-[13.5px]', getValueColor(valor))}>
                                {formatCurrency(valor)}
                              </td>
                              {showAV && (
                                <td key={`${col}-av`} className={cn('px-3 py-3.5 text-right tabular-nums font-mono text-[11px] text-muted-foreground/70', isLucro ? 'bg-emerald-500/[0.05]' : 'bg-red-500/[0.05]')}>
                                  {formatAV(av)}
                                </td>
                              )}
                              {showAH && colIndex > 0 && (
                                <td key={`${col}-ah`} className={cn('px-3 py-3.5 text-right tabular-nums font-mono text-[11px] bg-sky-500/10', getAHColor(ah))}>
                                  {formatAH(ah)}
                                </td>
                              )}
                            </>
                          );
                        })}
                      </tr>
                    );
                  })()}
                </>
              );
            })}

            {/* Total Geral */}
            <tr className="border-t-2 border-primary/40 bg-gradient-to-r from-primary/[0.18] via-primary/[0.10] to-primary/[0.05]">
              <td className="relative px-5 py-4">
                <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[4px] rounded-r-full bg-primary shadow-[0_0_16px_0_hsl(var(--primary))]" />
                <div className="flex items-center gap-2">
                  <span className="w-5" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary mr-2">Total</span>
                  <span className="font-bold text-[15px] text-foreground tracking-tight">Total Geral</span>
                </div>
              </td>
              {colunas.map((col, colIndex) => {
                const valor = totaisPorColuna[col] || 0;
                const av = calcularAV(valor, col);
                const ah = calcularAH(totaisPorColuna, colIndex);
                return (
                  <>
                    <td key={col} className={cn('px-3 py-4 text-right tabular-nums font-mono font-bold text-[15px]', getValueColor(valor))}>
                      {formatCurrency(valor)}
                    </td>
                    {showAV && (
                      <td key={`${col}-av`} className="px-3 py-4 text-right tabular-nums font-mono text-[11px] text-muted-foreground/70 bg-primary/[0.07]">
                        {formatAV(av)}
                      </td>
                    )}
                    {showAH && colIndex > 0 && (
                      <td key={`${col}-ah`} className={cn('px-3 py-4 text-right tabular-nums font-mono text-[11px] bg-sky-500/[0.12]', getAHColor(ah))}>
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

      {/* Footer com legenda premium */}
      <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 mr-1">Legenda</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10.5px] font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_0_hsl(158,64%,52%)]" />
          Positivo
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-[10.5px] font-medium text-red-300">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_8px_0_hsl(0,72%,55%)]" />
          Negativo
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-[10.5px] font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_0_hsl(var(--primary))]" />
          Subtotais / Total
        </span>
        {colunas.length > 1 && showAH && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/25 text-[10.5px] font-medium text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            AH% vs período anterior
          </span>
        )}
      </div>
    </div>
  );
}
