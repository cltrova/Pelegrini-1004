import { useMemo, useState } from 'react';
import { Tag, Search, TrendingUp, Crown, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface MarcaItem {
  marca: string;
  marcaNome?: string;
  realizado: number;
  meta?: number;
}

const PALETTE = [
  '#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F472B6', '#84CC16', '#FB923C', '#6366F1',
  '#14B8A6', '#A855F7', '#FACC15', '#22D3EE', '#F87171',
];

interface Props {
  marcas: MarcaItem[];
  isLoading?: boolean;
}

export function RepresentatividadeMarcasList({ marcas, isLoading }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const { rows, total, max } = useMemo(() => {
    const arr = (marcas || [])
      .filter(m => (m.realizado || 0) > 0)
      .map(m => ({
        key: m.marca,
        label: m.marcaNome || m.marca,
        value: m.realizado || 0,
        meta: m.meta || 0,
      }))
      .sort((a, b) => b.value - a.value);
    const total = arr.reduce((a, b) => a + b.value, 0);
    const max = arr[0]?.value || 0;
    return { rows: arr, total, max };
  }, [marcas]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => r.label.toLowerCase().includes(q));
  }, [rows, query]);

  const visible = expanded ? filtered : filtered.slice(0, 10);
  const hiddenCount = filtered.length - visible.length;
  const topMarca = rows[0];

  if (!isLoading && rows.length === 0) return null;

  return (
    <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-card to-card/60 shadow-lg">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                Representatividade de Marcas
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {rows.length} marcas · passe o mouse para destacar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {topMarca && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                <div className="text-[11px]">
                  <span className="text-muted-foreground">Líder: </span>
                  <span className="font-semibold">{topMarca.label}</span>
                  <span className="text-amber-500 font-mono ml-1.5">
                    {formatPercent(total > 0 ? (topMarca.value / total) * 100 : 0)}
                  </span>
                </div>
              </div>
            )}
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total</div>
              <div className="text-lg font-bold font-mono tabular-nums bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {formatCurrency(total)}
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar marca..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9 text-sm bg-background/60"
          />
        </div>
      </CardHeader>

      <CardContent className="p-2 md:p-3">
        {isLoading && rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Carregando marcas...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Nenhuma marca encontrada para "{query}"</div>
        ) : (
          <div className="space-y-1">
            {visible.map((row, i) => {
              const realIdx = rows.findIndex(r => r.key === row.key);
              const color = PALETTE[realIdx % PALETTE.length];
              const pctTotal = total > 0 ? (row.value / total) * 100 : 0;
              const pctBar = max > 0 ? (row.value / max) * 100 : 0;
              const isHovered = hovered === row.key;
              const dim = hovered && !isHovered;

              return (
                <div
                  key={row.key}
                  onMouseEnter={() => setHovered(row.key)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    'group relative rounded-xl px-3 py-2.5 transition-all duration-200',
                    'hover:bg-accent/50 cursor-pointer',
                    dim && 'opacity-40',
                    isHovered && 'bg-accent/60 shadow-sm scale-[1.005]'
                  )}
                  style={{
                    borderLeft: `3px solid ${isHovered ? color : 'transparent'}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <div
                      className={cn(
                        'flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold tabular-nums',
                        realIdx === 0 && 'bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30',
                        realIdx === 1 && 'bg-slate-400/15 text-slate-400 ring-1 ring-slate-400/30',
                        realIdx === 2 && 'bg-orange-700/15 text-orange-600 ring-1 ring-orange-700/30',
                        realIdx > 2 && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {realIdx + 1}
                    </div>

                    {/* Color dot */}
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0 transition-transform"
                      style={{
                        background: color,
                        boxShadow: isHovered ? `0 0 12px ${color}` : 'none',
                        transform: isHovered ? 'scale(1.4)' : 'scale(1)',
                      }}
                    />

                    {/* Label + bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-semibold truncate">{row.label}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm font-mono tabular-nums font-bold">
                            {formatCurrency(row.value)}
                          </span>
                          <Badge
                            variant="outline"
                            className="font-mono tabular-nums text-[10px] px-1.5 py-0 h-5"
                            style={{
                              color,
                              borderColor: `${color}66`,
                              background: `${color}15`,
                            }}
                          >
                            {formatPercent(pctTotal)}
                          </Badge>
                        </div>
                      </div>

                      {/* Animated bar */}
                      <div className="relative h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${pctBar}%`,
                            background: `linear-gradient(90deg, ${color}99, ${color})`,
                            boxShadow: isHovered ? `0 0 8px ${color}80` : 'none',
                          }}
                        />
                      </div>

                      {row.meta > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                          <TrendingUp className="h-3 w-3" />
                          <span>Meta: {formatCurrency(row.meta)}</span>
                          <span className="font-mono" style={{ color: row.value >= row.meta ? '#10B981' : '#F59E0B' }}>
                            ({formatPercent(row.meta > 0 ? (row.value / row.meta) * 100 : 0)})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(true)}
                className="w-full mt-2 text-xs h-8"
              >
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
                Ver mais {hiddenCount} marca{hiddenCount > 1 ? 's' : ''}
              </Button>
            )}
            {expanded && filtered.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
                className="w-full mt-2 text-xs h-8"
              >
                <ChevronUp className="h-3.5 w-3.5 mr-1" />
                Mostrar menos
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
