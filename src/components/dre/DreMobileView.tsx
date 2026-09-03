import { useState } from 'react';
import { ChevronRight, ChevronDown, TrendingUp, TrendingDown, DollarSign, Percent, Info, LayoutDashboard, Table, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DreRecord, DreIndicator, DreGroupSummary } from '@/types/dre';
import { formatCurrency, formatPercent, formatCompactNumber } from '@/utils/formatters';
import { defaultDreConfig } from '@/config/dreConfig';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DreMobileViewProps {
  data: DreRecord[];
  indicators: DreIndicator[];
  groupSummary: DreGroupSummary[];
}

// Mapeamento de grupo para ordem e displayName
const nivelOrderMap: Record<string, { ordem: number; displayName: string }> = {
  'Receitas': { ordem: 1, displayName: 'Receitas' },
  'Impostos': { ordem: 2, displayName: '(-) Deduções' },
  'Custos de Vendas de Mercadorias': { ordem: 3, displayName: 'CMV' },
  'Custos de Vendas de Serviços': { ordem: 4, displayName: 'CSV' },
  'Despesas com Pessoal de Vendas': { ordem: 5, displayName: 'Desp. Pessoal Vendas' },
  'Outras Despesas com vendas': { ordem: 6, displayName: 'Outras Desp. Vendas' },
  'Provisão para Credito Liquid. Duvidosas': { ordem: 7, displayName: 'PCLD' },
  'Despesas E-Commerce': { ordem: 8, displayName: 'Desp. E-Commerce' },
  'Despesas com Pessoal Administrativo': { ordem: 9, displayName: 'Desp. Admin' },
  'Outras Despesas Administrativas': { ordem: 10, displayName: 'Outras Desp. Admin' },
  'Despesas Não Dedutiveis': { ordem: 11, displayName: 'Desp. Não Dedutíveis' },
  'Despesas Tributárias': { ordem: 12, displayName: 'Desp. Tributárias' },
  'Receitas Financeiros': { ordem: 13, displayName: 'Rec. Financeiras' },
  'Despesas Financeiros': { ordem: 14, displayName: 'Desp. Financeiras' },
  'Outras Receitas Operacionais': { ordem: 15, displayName: 'Outras Rec. Oper.' },
  'Juros Sobre Capital Próprio': { ordem: 16, displayName: 'JSCP' },
  'Outras Despesas': { ordem: 17, displayName: 'Outras Despesas' },
  'Provisão Para IRPJ e CSLL': { ordem: 18, displayName: 'IRPJ/CSLL' },
  'Ajustes de Exercícios Anteriores': { ordem: 19, displayName: 'Ajustes Ant.' },
  'Sem Descrição': { ordem: 20, displayName: 'Outros' },
};

// Mapeamento de Grupo Raiz
const grupoRaizMap: Record<string, string> = {
  'Receitas': 'Lucro Bruto',
  'Impostos': 'Lucro Bruto',
  'Custos de Vendas de Mercadorias': 'Lucro Bruto',
  'Custos de Vendas de Serviços': 'Lucro Bruto',
  'Receitas Financeiros': 'Result. Financeiro',
  'Despesas Financeiros': 'Result. Financeiro',
  'Despesas com Pessoal de Vendas': 'Desp. Operacionais',
  'Outras Despesas com vendas': 'Desp. Operacionais',
  'Provisão para Credito Liquid. Duvidosas': 'Desp. Operacionais',
  'Despesas E-Commerce': 'Desp. Operacionais',
  'Despesas com Pessoal Administrativo': 'Desp. Administrativas',
  'Outras Despesas Administrativas': 'Desp. Administrativas',
  'Despesas Não Dedutiveis': 'Desp. Administrativas',
  'Despesas Tributárias': 'Desp. Administrativas',
};

const GRUPO_RAIZ_COLORS: Record<string, string> = {
  'Lucro Bruto': 'bg-emerald-500',
  'Result. Financeiro': 'bg-blue-500',
  'Desp. Operacionais': 'bg-red-500',
  'Desp. Administrativas': 'bg-purple-500',
  'Outras': 'bg-amber-500',
};

function applyValueTransform(codigo: string, valor: number): number {
  if (defaultDreConfig.invertSignCodes.includes(codigo)) {
    return -valor;
  }
  return valor;
}

// Componente de Card de Indicador Mobile
function MobileIndicatorCard({ indicator }: { indicator: DreIndicator }) {
  const getIcon = () => {
    if (indicator.label.toLowerCase().includes('receita')) return <TrendingUp className="h-4 w-4" />;
    if (indicator.label.toLowerCase().includes('despesa')) return <TrendingDown className="h-4 w-4" />;
    if (indicator.label.toLowerCase().includes('margem')) return <Percent className="h-4 w-4" />;
    return <DollarSign className="h-4 w-4" />;
  };

  const formatValue = () => {
    if (indicator.percentual !== undefined) return formatPercent(indicator.percentual);
    return formatCompactNumber(indicator.value);
  };

  const getColorClass = () => {
    if (indicator.color === 'positive') return 'text-emerald-500';
    if (indicator.color === 'negative') return 'text-red-500';
    return 'text-foreground';
  };

  return (
    <div className="bg-card rounded-lg border border-border p-3 flex-1 min-w-[140px]">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('p-1 rounded', indicator.color === 'positive' ? 'bg-emerald-500/10 text-emerald-500' : indicator.color === 'negative' ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground')}>
          {getIcon()}
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{indicator.label}</span>
      </div>
      <div className={cn('text-lg font-bold tabular-nums', getColorClass())}>
        {formatValue()}
      </div>
    </div>
  );
}

// Componente de Item da DRE Mobile
function MobileDreItem({ 
  label, 
  value, 
  level = 0, 
  isExpanded, 
  hasChildren, 
  onToggle,
  children 
}: { 
  label: string; 
  value: number; 
  level?: number; 
  isExpanded?: boolean;
  hasChildren?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  const getValueColor = (val: number) => {
    if (val > 0) return 'text-emerald-500';
    if (val < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const paddingLeft = level * 12;

  return (
    <>
      <div 
        className={cn(
          'flex items-center justify-between py-2.5 px-3 border-b border-border/50',
          level === 0 && 'bg-muted/40',
          level === 1 && 'bg-muted/20',
          hasChildren && 'active:bg-muted/60'
        )}
        onClick={onToggle}
        style={{ paddingLeft: `${12 + paddingLeft}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren && (
            <span className="shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
          )}
          <span className={cn(
            'truncate',
            level === 0 && 'font-semibold text-sm',
            level === 1 && 'font-medium text-sm text-foreground/80',
            level >= 2 && 'text-xs text-foreground/70'
          )}>
            {label}
          </span>
        </div>
        <span className={cn(
          'tabular-nums font-mono shrink-0 ml-2',
          level === 0 && 'font-semibold text-sm',
          level >= 1 && 'text-sm',
          getValueColor(value)
        )}>
          {formatCompactNumber(value)}
        </span>
      </div>
      {isExpanded && children}
    </>
  );
}

export function DreMobileView({ data, indicators, groupSummary }: DreMobileViewProps) {
  const [activeView, setActiveView] = useState<'resumo' | 'detalhe'>('resumo');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedGrupos, setExpandedGrupos] = useState<Set<string>>(new Set());

  // Calcula Grupo Raiz
  const grupoRaizData = (() => {
    const grupos: Record<string, number> = {};
    let totalReceitas = 0;

    data.forEach((record) => {
      const grupoRaiz = grupoRaizMap[record.grupo] || 'Outras';
      grupos[grupoRaiz] = (grupos[grupoRaiz] || 0) + record.valor;
      if (record.grupo === 'Receitas') {
        totalReceitas += record.valor;
      }
    });

    return Object.entries(grupos)
      .map(([grupo, valor]) => ({
        grupo,
        valor,
        percentual: totalReceitas !== 0 ? (valor / totalReceitas) * 100 : 0,
      }))
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  })();

  // Constrói hierarquia simplificada
  const hierarchy = (() => {
    const categorias: Record<string, { displayName: string; ordem: number; total: number; grupos: Record<string, number> }> = {};

    data.forEach((record) => {
      const grupoOriginal = record.grupo || 'Sem Descrição';
      const mapping = nivelOrderMap[grupoOriginal] || { ordem: 20, displayName: grupoOriginal };
      const valorTransformado = applyValueTransform(record.codigo, record.valor);

      if (!categorias[mapping.displayName]) {
        categorias[mapping.displayName] = {
          displayName: mapping.displayName,
          ordem: mapping.ordem,
          total: 0,
          grupos: {},
        };
      }
      categorias[mapping.displayName].total += valorTransformado;
      categorias[mapping.displayName].grupos[grupoOriginal] = 
        (categorias[mapping.displayName].grupos[grupoOriginal] || 0) + valorTransformado;
    });

    return Object.values(categorias).sort((a, b) => a.ordem - b.ordem);
  })();

  const totalGeral = hierarchy.reduce((sum, cat) => sum + cat.total, 0);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const toggleGrupo = (grupo: string) => {
    setExpandedGrupos(prev => {
      const next = new Set(prev);
      if (next.has(grupo)) {
        next.delete(grupo);
      } else {
        next.add(grupo);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header fixo com indicadores */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        {/* Indicadores em scroll horizontal */}
        <div className="p-3 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
            {indicators.slice(0, 4).map((indicator, idx) => (
              <MobileIndicatorCard key={idx} indicator={indicator} />
            ))}
          </div>
        </div>

        {/* Tabs de navegação */}
        <div className="flex border-t border-border">
          <button
            className={cn(
              'flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
              activeView === 'resumo' 
                ? 'text-primary border-b-2 border-primary bg-primary/5' 
                : 'text-muted-foreground'
            )}
            onClick={() => setActiveView('resumo')}
          >
            <LayoutDashboard className="h-4 w-4" />
            Resumo
          </button>
          <button
            className={cn(
              'flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
              activeView === 'detalhe' 
                ? 'text-primary border-b-2 border-primary bg-primary/5' 
                : 'text-muted-foreground'
            )}
            onClick={() => setActiveView('detalhe')}
          >
            <Table className="h-4 w-4" />
            Detalhe
          </button>
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto">
        {activeView === 'resumo' ? (
          <div className="p-3 space-y-4">
            {/* Grupo Raiz - Cards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">Resultado por Grupo</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[200px]">
                      <p className="text-xs">Agrupa lançamentos em categorias: Lucro Bruto, Resultado Financeiro, Despesas.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="space-y-2">
                {grupoRaizData.map((item) => (
                  <div 
                    key={item.grupo}
                    className="bg-card rounded-lg border border-border p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-2 h-8 rounded-full', GRUPO_RAIZ_COLORS[item.grupo] || 'bg-gray-500')} />
                      <div>
                        <div className="text-sm font-medium">{item.grupo}</div>
                        <div className={cn('text-xs', item.percentual >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                          {formatPercent(item.percentual / 100)}
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      'text-base font-bold tabular-nums',
                      item.valor >= 0 ? 'text-emerald-500' : 'text-red-500'
                    )}>
                      {formatCompactNumber(item.valor)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo por Categoria */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">Por Categoria</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[200px]">
                      <p className="text-xs">Totalização por categoria contábil do DRE.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                {hierarchy.map((cat) => (
                  <div 
                    key={cat.displayName}
                    className="flex items-center justify-between py-2.5 px-3 border-b border-border/50 last:border-b-0"
                  >
                    <span className="text-sm font-medium truncate pr-2">{cat.displayName}</span>
                    <span className={cn(
                      'text-sm font-bold tabular-nums shrink-0',
                      cat.total >= 0 ? 'text-emerald-500' : 'text-red-500'
                    )}>
                      {formatCompactNumber(cat.total)}
                    </span>
                  </div>
                ))}
                {/* Total Geral */}
                <div className="flex items-center justify-between py-3 px-3 bg-primary/10 border-t border-primary/20">
                  <span className="text-sm font-bold">Resultado Líquido</span>
                  <span className={cn(
                    'text-base font-bold tabular-nums',
                    totalGeral >= 0 ? 'text-emerald-500' : 'text-red-500'
                  )}>
                    {formatCompactNumber(totalGeral)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Detalhe - Lista hierárquica */
          <div className="bg-card">
            <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Demonstrativo de Resultado</span>
              <Badge variant="secondary" className="text-xs">
                {hierarchy.length} categorias
              </Badge>
            </div>
            
            {hierarchy.map((cat) => {
              const isCatExpanded = expandedCategories.has(cat.displayName);
              const gruposEntries = Object.entries(cat.grupos);
              
              return (
                <MobileDreItem
                  key={cat.displayName}
                  label={cat.displayName}
                  value={cat.total}
                  level={0}
                  isExpanded={isCatExpanded}
                  hasChildren={gruposEntries.length > 0}
                  onToggle={() => toggleCategory(cat.displayName)}
                >
                  {gruposEntries.map(([grupo, valor]) => (
                    <MobileDreItem
                      key={grupo}
                      label={grupo}
                      value={valor}
                      level={1}
                    />
                  ))}
                </MobileDreItem>
              );
            })}

            {/* Total Geral */}
            <div className="flex items-center justify-between py-3 px-3 bg-primary/10 border-t-2 border-primary/30 sticky bottom-0">
              <span className="text-sm font-bold">RESULTADO LÍQUIDO</span>
              <span className={cn(
                'text-lg font-bold tabular-nums',
                totalGeral >= 0 ? 'text-emerald-500' : 'text-red-500'
              )}>
                {formatCurrency(totalGeral)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
