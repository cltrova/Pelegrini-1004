import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DreRecord, DreHierarchyNode } from '@/types/dre';
import { buildDreHierarchy, flattenHierarchy } from '@/hooks/useDreData';
import { formatCurrency } from '@/utils/formatters';

interface DreHierarchyTableProps {
  data: DreRecord[];
  className?: string;
}

export function DreHierarchyTable({ data, className }: DreHierarchyTableProps) {
  // Expandir níveis 0 e 1 por padrão para visão geral
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const keys = new Set<string>();
    data.forEach((record) => {
      if (record.nivel <= 1) {
        keys.add(`${record.codigo}-${record.ordem}`);
      }
    });
    return keys;
  });

  const hierarchy = useMemo(() => buildDreHierarchy(data), [data]);
  const flatData = useMemo(
    () => flattenHierarchy(hierarchy, expandedKeys),
    [hierarchy, expandedKeys]
  );

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
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
    const allKeys = new Set<string>();
    data.forEach((record) => {
      allKeys.add(`${record.codigo}-${record.ordem}`);
    });
    setExpandedKeys(allKeys);
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  // Estilos por nível hierárquico - quanto menor o nível, mais destaque
  const getRowStyles = (nivel: number, hasChildren: boolean) => {
    const base = 'border-b border-border transition-colors';
    
    switch (nivel) {
      case 0:
        // Totalizadores principais - máximo destaque
        return cn(base, 'bg-primary/10 hover:bg-primary/15 font-bold text-base');
      case 1:
        // Subtotais - destaque médio
        return cn(base, 'bg-muted/50 hover:bg-muted/70 font-semibold');
      case 2:
        // Grupos intermediários
        return cn(base, 'bg-muted/20 hover:bg-muted/30 font-medium');
      default:
        // Linhas detalhadas
        return cn(base, 'hover:bg-muted/20');
    }
  };

  // Indentação visual baseada no nível
  const getIndentation = (nivel: number) => {
    return nivel * 24; // 24px por nível
  };

  // Cor do valor baseada no sinal
  const getValueColor = (valor: number) => {
    if (valor > 0) return 'text-success';
    if (valor < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  // Tamanho da fonte baseado no nível
  const getFontSize = (nivel: number) => {
    switch (nivel) {
      case 0: return 'text-base';
      case 1: return 'text-sm';
      default: return 'text-sm';
    }
  };

  return (
    <div className={cn('bg-card rounded-xl border border-border overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div>
          <h3 className="font-semibold text-foreground">Demonstrativo de Resultado</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {flatData.length} linha{flatData.length !== 1 ? 's' : ''} • Ordenado por estrutura contábil
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-primary/10 transition-colors"
          >
            Expandir tudo
          </button>
          <span className="text-muted-foreground text-xs">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-primary/10 transition-colors"
          >
            Recolher
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/60">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Descrição
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-44">
                Valor (R$)
              </th>
            </tr>
          </thead>
          <tbody>
            {flatData.map((node) => {
              const { record } = node;
              const key = `${record.codigo}-${record.ordem}`;
              const isExpanded = expandedKeys.has(key);
              const hasChildren = node.children.length > 0;

              return (
                <tr
                  key={key}
                  className={getRowStyles(record.nivel, hasChildren)}
                >
                  {/* Descrição com indentação e toggle */}
                  <td className="px-4 py-2.5">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${getIndentation(record.nivel)}px` }}
                    >
                      {/* Ícone de expandir/recolher ou placeholder */}
                      {hasChildren ? (
                        <button
                          onClick={() => toggleExpand(key)}
                          className="p-1 hover:bg-background/50 rounded transition-colors flex-shrink-0"
                          aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      ) : (
                        <span className="w-6 flex-shrink-0 flex items-center justify-center">
                          <Minus className="h-3 w-3 text-muted-foreground/40" />
                        </span>
                      )}
                      
                      {/* Descrição */}
                      <span className={cn(
                        getFontSize(record.nivel),
                        record.nivel <= 1 && 'font-semibold'
                      )}>
                        {record.descricao}
                      </span>
                    </div>
                  </td>

                  {/* Valor - alinhado à direita, formato moeda */}
                  <td className={cn(
                    'px-4 py-2.5 text-right tabular-nums font-mono',
                    getFontSize(record.nivel),
                    getValueColor(record.valor),
                    record.nivel <= 1 && 'font-semibold'
                  )}>
                    {formatCurrency(record.valor)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer com legenda */}
      <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-success/20 border border-success/30"></span>
          Positivo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30"></span>
          Negativo
        </span>
      </div>
    </div>
  );
}
