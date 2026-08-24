import { useMemo, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Medal } from 'lucide-react';
import { buildPageWindow } from '@/utils/pagination';

interface RankItem {
  key: string;
  nome: string;
  valor: number;
}

interface InteractiveRankCardProps {
  title: string;
  icon?: ReactNode;
  data: RankItem[];
  formatValue: (n: number) => string;
  pageSize?: number;
  defaultColor?: string;
}

const FALLBACK_COLORS = [
  'hsl(217, 91%, 60%)', 'hsl(173, 80%, 40%)', 'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(280, 65%, 60%)',
  'hsl(200, 80%, 50%)', 'hsl(330, 70%, 50%)', 'hsl(160, 60%, 45%)', 'hsl(45, 85%, 55%)',
];

// Medal palette - gold / silver / bronze
const MEDAL = {
  0: { color: 'hsl(45, 95%, 55%)', glow: 'hsl(45, 95%, 65%)', label: 'Ouro' },
  1: { color: 'hsl(220, 8%, 75%)', glow: 'hsl(220, 12%, 85%)', label: 'Prata' },
  2: { color: 'hsl(25, 70%, 50%)', glow: 'hsl(25, 80%, 60%)', label: 'Bronze' },
} as const;

export function InteractiveRankCard({
  title,
  icon,
  data,
  formatValue,
  pageSize = 10,
  defaultColor,
}: InteractiveRankCardProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const ranking = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.valor - a.valor);
    const max = sorted[0]?.valor || 1;
    return sorted.map((it, idx) => ({ ...it, rank: idx + 1, pctMax: (it.valor / max) * 100 }));
  }, [data]);

  const totalPages = Math.max(1, Math.ceil(ranking.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const pageItems = ranking.slice(start, start + pageSize);

  const getColor = (globalIdx: number) => {
    if (globalIdx < 3) return MEDAL[globalIdx as 0 | 1 | 2].color;
    return defaultColor || FALLBACK_COLORS[globalIdx % FALLBACK_COLORS.length];
  };

  return (
    <Card className="premium-card chart-premium stagger-3 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          {ranking.length > pageSize && (
            <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
              {start + 1}–{Math.min(start + pageSize, ranking.length)} / {ranking.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col" onMouseLeave={() => setHovered(null)}>
        {ranking.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
        ) : (
          <>
            <div className="flex flex-col justify-between flex-1 gap-3">
              {pageItems.map((item, idxInPage) => {
                const globalIdx = start + idxInPage;
                const color = getColor(globalIdx);
                const isTop3 = globalIdx < 3;
                const medal = isTop3 ? MEDAL[globalIdx as 0 | 1 | 2] : null;
                const isActive = hovered === item.key;
                const isDimmed = hovered !== null && !isActive;

                return (
                  <div
                    key={item.key}
                    onMouseEnter={() => setHovered(item.key)}
                    className={cn(
                      'flex items-center gap-4 rounded-md px-1 py-1 cursor-default',
                      'transition-all duration-300 ease-out',
                      isActive && 'translate-x-0.5',
                      isDimmed && 'opacity-50',
                    )}
                    style={{ animation: `irFade 420ms ${Math.min(idxInPage * 35, 420)}ms ease-out backwards` }}
                  >
                    {medal ? (
                      <span
                        className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-transform duration-300"
                        style={{
                          background: `linear-gradient(135deg, ${medal.glow}, ${medal.color})`,
                          boxShadow: isActive
                            ? `0 0 14px ${medal.color}cc, inset 0 0 0 1px hsl(0 0% 100% / 0.25)`
                            : `0 0 8px ${medal.color}80, inset 0 0 0 1px hsl(0 0% 100% / 0.2)`,
                          transform: isActive ? 'scale(1.08)' : 'scale(1)',
                        }}
                      >
                        <Medal className="h-3.5 w-3.5 text-background" strokeWidth={2.5} />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'w-7 text-sm font-semibold italic tabular-nums text-right transition-colors duration-300',
                          isActive ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {String(item.rank).padStart(2, '0')}
                      </span>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <p
                          className={cn(
                            'text-sm font-semibold truncate transition-colors duration-300',
                            isActive ? 'text-foreground' : 'text-foreground/90',
                          )}
                        >
                          {item.nome}
                        </p>
                        <p className="text-sm font-bold mono-value text-foreground flex-shrink-0 tabular-nums">
                          {formatValue(item.valor)}
                        </p>
                      </div>

                      <div className="relative h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="ir-bar relative h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(item.pctMax, 2)}%`,
                            background: `linear-gradient(90deg, ${color}80, ${color})`,
                            boxShadow: isActive
                              ? `0 0 12px ${color}cc`
                              : isTop3
                              ? `0 0 8px ${color}80`
                              : 'none',
                            animationDelay: `${Math.min(idxInPage * 35, 420)}ms`,
                          }}
                        >
                          <span className="ir-shine absolute inset-y-0 -left-1/3 w-1/3" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-all',
                    safePage === 0
                      ? 'text-muted-foreground/40 cursor-not-allowed'
                      : 'text-foreground hover:bg-muted/60 hover:text-primary',
                  )}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </button>

                <div className="flex items-center gap-1">
                  {buildPageWindow(safePage, totalPages).map((p, i) =>
                    p === '...' ? (
                      <span key={`d${i}`} className="px-1 text-[11px] text-muted-foreground/60 select-none">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          'h-6 min-w-6 px-1.5 text-[11px] font-semibold rounded-md tabular-nums transition-all',
                          p === safePage
                            ? 'bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.4)]'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        {p + 1}
                      </button>
                    )
                  )}
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage === totalPages - 1}
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-all',
                    safePage === totalPages - 1
                      ? 'text-muted-foreground/40 cursor-not-allowed'
                      : 'text-foreground hover:bg-muted/60 hover:text-primary',
                  )}
                >
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <style>{`
        @keyframes irFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes irFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes irShine {
          0% { transform: translateX(-120%); opacity: 0; }
          30% { opacity: 0.35; }
          70% { opacity: 0.2; }
          100% { transform: translateX(420%); opacity: 0; }
        }
        .ir-bar { transform-origin: left center; animation: irFill 720ms cubic-bezier(0.22, 0.9, 0.32, 1) backwards; }
        .ir-shine {
          background: linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.35), transparent);
          animation: irShine 3.8s ease-in-out infinite;
        }
      `}</style>
    </Card>
  );
}
