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
}

// Medal palette - gold / silver / bronze
const MEDAL = {
  0: { bg: 'bg-amber-500/10 text-amber-600 border-amber-500/35', label: 'Ouro' },
  1: { bg: 'bg-slate-500/10 text-slate-500 border-slate-500/30', label: 'Prata' },
  2: { bg: 'bg-orange-500/10 text-orange-600 border-orange-500/35', label: 'Bronze' },
} as const;

export function InteractiveRankCard({
  title,
  icon,
  data,
  formatValue,
  pageSize = 10,
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
                      'transition-[opacity,transform] duration-300 ease-out',
                      isActive && 'translate-x-0.5',
                      isDimmed && 'opacity-50',
                    )}
                    style={{ animation: `irFade 420ms ${Math.min(idxInPage * 35, 420)}ms ease-out backwards` }}
                  >
                    {medal ? (
                      <span
                        className={cn(
                          'w-7 h-7 flex items-center justify-center rounded-md border flex-shrink-0',
                          medal.bg,
                        )}
                      >
                        <Medal className="h-3.5 w-3.5" strokeWidth={2.5} />
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
                          className={cn(
                            'ir-bar relative h-full rounded-full transition-[width,background-color] duration-500',
                            isTop3 ? 'bg-primary' : 'bg-foreground/35',
                            isActive && 'bg-primary',
                          )}
                          style={{
                            width: `${Math.max(item.pctMax, 2)}%`,
                            animationDelay: `${Math.min(idxInPage * 35, 420)}ms`,
                          }}
                        />
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
                    'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors',
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
                          'h-6 min-w-6 px-1.5 text-[11px] font-semibold rounded-md tabular-nums transition-colors',
                          p === safePage
                            ? 'bg-primary text-primary-foreground'
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
                    'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors',
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
        .ir-bar { transform-origin: left center; animation: irFill 720ms cubic-bezier(0.22, 0.9, 0.32, 1) backwards; }
      `}</style>
    </Card>
  );
}
