import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Item {
  nome: string;
  qtd: number;
}

const COLORS = [
  'hsl(217, 91%, 60%)', 'hsl(173, 80%, 40%)', 'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(280, 65%, 60%)',
  'hsl(200, 80%, 50%)', 'hsl(330, 70%, 50%)', 'hsl(160, 60%, 45%)', 'hsl(45, 85%, 55%)',
];

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);

export function ClientesPorVendedorCard({ data }: { data: Item[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const ranking = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.qtd - a.qtd);
    const max = sorted[0]?.qtd || 1;
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
      pctMax: (item.qtd / max) * 100,
    }));
  }, [data]);

  return (
    <Card className="premium-card chart-premium stagger-4 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Clientes por Vendedor
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {ranking.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
        ) : (
          <div
            className="relative flex-1 min-h-0"
            onMouseLeave={() => setHovered(null)}
          >
            <div className="pointer-events-none absolute top-0 left-0 right-1 h-4 bg-gradient-to-b from-card to-transparent z-10" />
            <div className="pointer-events-none absolute bottom-0 left-0 right-1 h-4 bg-gradient-to-t from-card to-transparent z-10" />

            <div className="cpv-scroll flex flex-col justify-between flex-1 gap-3 max-h-[440px] overflow-y-auto overflow-x-hidden pr-1 py-1">
              {ranking.map((item, idx) => {
                const color = COLORS[idx % COLORS.length];
                const isActive = hovered === item.nome;
                const isDimmed = hovered !== null && !isActive;

                return (
                  <div
                    key={item.nome}
                    onMouseEnter={() => setHovered(item.nome)}
                    className={cn(
                      'flex items-center gap-4 group rounded-md px-1 py-1 cursor-default',
                      'transition-all duration-300 ease-out',
                      isActive && 'translate-x-0.5',
                      isDimmed && 'opacity-50',
                    )}
                    style={{
                      animation: `cpvFade 420ms ${Math.min(idx * 35, 420)}ms ease-out backwards`,
                    }}
                  >
                    <span
                      className={cn(
                        'w-7 text-sm font-semibold italic tabular-nums text-right transition-colors duration-300',
                        isActive ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {String(item.rank).padStart(2, '0')}
                    </span>

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
                          {fmt(item.qtd)}
                        </p>
                      </div>

                      <div className="relative h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="cpv-bar relative h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(item.pctMax, 2)}%`,
                            background: `linear-gradient(90deg, ${color}80, ${color})`,
                            boxShadow:
                              isActive
                                ? `0 0 12px ${color}cc`
                                : idx < 3
                                ? `0 0 8px ${color}80`
                                : 'none',
                            animationDelay: `${Math.min(idx * 35, 420)}ms`,
                          }}
                        >
                          <span className="cpv-shine absolute inset-y-0 -left-1/3 w-1/3" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <style>{`
        @keyframes cpvFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cpvFill {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes cpvShine {
          0% { transform: translateX(-120%); opacity: 0; }
          30% { opacity: 0.35; }
          70% { opacity: 0.2; }
          100% { transform: translateX(420%); opacity: 0; }
        }
        .cpv-bar {
          transform-origin: left center;
          animation: cpvFill 720ms cubic-bezier(0.22, 0.9, 0.32, 1) backwards;
        }
        .cpv-shine {
          background: linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.35), transparent);
          animation: cpvShine 3.8s ease-in-out infinite;
        }
        .cpv-scroll { scroll-behavior: smooth; scrollbar-width: thin; scrollbar-color: transparent transparent; }
        .cpv-scroll:hover { scrollbar-color: hsl(var(--primary) / 0.3) transparent; }
        .cpv-scroll::-webkit-scrollbar { width: 4px; }
        .cpv-scroll::-webkit-scrollbar-track { background: transparent; }
        .cpv-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 999px; transition: background 200ms; }
        .cpv-scroll:hover::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.3); }
      `}</style>
    </Card>
  );
}
