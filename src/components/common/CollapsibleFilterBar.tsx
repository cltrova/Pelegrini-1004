import { useState, ReactNode } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FilterSummaryItem {
  label: string;
  value: string | number;
}

interface CollapsibleFilterBarProps {
  children: ReactNode;
  title?: string;
  summary?: FilterSummaryItem[];
  activeFiltersCount?: number;
  onClear?: () => void;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function CollapsibleFilterBar({
  children,
  title = 'Filtros',
  summary = [],
  activeFiltersCount = 0,
  onClear,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
  className,
}: CollapsibleFilterBarProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  
  // Suporte a modo controlado e não-controlado
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledOnOpenChange || setInternalIsOpen;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header da barra - sempre visível */}
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50',
              isOpen && 'border-b border-border bg-muted/30'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                activeFiltersCount > 0 
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-muted text-muted-foreground'
              )}>
                <Filter className="h-4 w-4" />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{title}</span>
                {activeFiltersCount > 0 && (
                  <Badge 
                    variant="default" 
                    className="px-2 py-0.5 text-xs font-semibold"
                  >
                    {activeFiltersCount} ativo{activeFiltersCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Resumo dos filtros quando fechado */}
              {!isOpen && summary.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                  {summary.slice(0, 4).map((item, index) => (
                    <span key={index} className="flex items-center gap-1.5">
                      {index > 0 && <span className="text-border">•</span>}
                      <span className="text-muted-foreground">{item.label}:</span>
                      <span className="font-medium text-foreground">{item.value}</span>
                    </span>
                  ))}
                  {summary.length > 4 && (
                    <span className="text-muted-foreground">+{summary.length - 4}</span>
                  )}
                </div>
              )}

              {/* Botão Limpar - só aparece se há filtros ativos e está aberto */}
              {isOpen && activeFiltersCount > 0 && onClear && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onClear();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      e.preventDefault();
                      onClear();
                    }
                  }}
                  className="h-7 px-2 flex items-center text-xs text-muted-foreground hover:text-destructive cursor-pointer rounded hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </span>
              )}

              <ChevronDown 
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )} 
              />
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Conteúdo expansível */}
        <CollapsibleContent>
          <div className="p-4 animate-fade-in">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
