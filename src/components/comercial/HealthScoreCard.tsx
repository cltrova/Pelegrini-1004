import { useMemo } from 'react';
import { Heart, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import type { ComercialKPIs, VendedorPerformance } from '@/types/comercial';

interface Props {
  kpis: ComercialKPIs;
  vendedores: VendedorPerformance[];
}

interface ScoreItem {
  label: string;
  score: number; // 0..100
  weight: number;
  detalhe: string;
}

export function HealthScoreCard({ kpis, vendedores }: Props) {
  const { score, items } = useMemo(() => {
    const items: ScoreItem[] = [];

    // 1) Margem (peso 25)
    const margem = kpis.faturamentoLiquido > 0
      ? ((kpis.faturamentoLiquido - kpis.totalValorCusto) / kpis.faturamentoLiquido) * 100
      : 0;
    const margemScore = Math.max(0, Math.min(100, (margem / 35) * 100));
    items.push({
      label: 'Margem',
      score: margemScore,
      weight: 25,
      detalhe: `${margem.toFixed(1)}% sobre líquido`,
    });

    // 2) Devolução (peso 20) — inverso
    const taxaDev = kpis.faturamentoBruto > 0
      ? (kpis.totalDevolucoes / kpis.faturamentoBruto) * 100
      : 0;
    const devScore = Math.max(0, 100 - (taxaDev / 10) * 100);
    items.push({
      label: 'Devoluções',
      score: devScore,
      weight: 20,
      detalhe: `${taxaDev.toFixed(2)}% do bruto`,
    });

    // 3) Ticket médio (peso 15) — score por escala log
    const ticketScore = Math.max(0, Math.min(100, (Math.log10(Math.max(1, kpis.ticketMedio)) / 4) * 100));
    items.push({
      label: 'Ticket Médio',
      score: ticketScore,
      weight: 15,
      detalhe: `R$ ${kpis.ticketMedio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
    });

    // 4) Metas (peso 25)
    const comMeta = vendedores.filter(v => v.meta && v.meta > 0);
    let metasScore = 50;
    let metasDetalhe = 'Sem metas';
    if (comMeta.length > 0) {
      const ating = comMeta.map(v => Math.min(150, (v.faturamentoLiquido / (v.meta || 1)) * 100));
      const avg = ating.reduce((a, b) => a + b, 0) / ating.length;
      metasScore = Math.max(0, Math.min(100, avg));
      const acima = comMeta.filter(v => (v.faturamentoLiquido / (v.meta || 1)) >= 1).length;
      metasDetalhe = `${acima}/${comMeta.length} atingiram`;
    }
    items.push({ label: 'Metas', score: metasScore, weight: 25, detalhe: metasDetalhe });

    // 5) Distribuição vendedores (peso 15) — concentração baixa = melhor
    let distScore = 50;
    let distDetalhe = '—';
    if (vendedores.length >= 3) {
      const sorted = [...vendedores].sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido);
      const total = sorted.reduce((s, v) => s + v.faturamentoLiquido, 0);
      const top3 = sorted.slice(0, 3).reduce((s, v) => s + v.faturamentoLiquido, 0);
      const conc = total > 0 ? (top3 / total) * 100 : 100;
      distScore = Math.max(0, 100 - Math.max(0, conc - 50)); // se top3 < 50%, score 100
      distDetalhe = `Top 3 = ${conc.toFixed(0)}%`;
    }
    items.push({ label: 'Equipe', score: distScore, weight: 15, detalhe: distDetalhe });

    const totalWeight = items.reduce((s, i) => s + i.weight, 0);
    const finalScore = Math.round(
      items.reduce((s, i) => s + (i.score * i.weight) / totalWeight, 0)
    );

    return { score: finalScore, items };
  }, [kpis, vendedores]);

  const color =
    score >= 80 ? 'hsl(var(--success))'
    : score >= 60 ? 'hsl(217 91% 60%)'
    : score >= 40 ? 'hsl(38 92% 50%)'
    : 'hsl(var(--destructive))';

  const label =
    score >= 80 ? 'Excelente'
    : score >= 60 ? 'Saudável'
    : score >= 40 ? 'Atenção'
    : 'Crítico';

  const Icon = score >= 60 ? TrendingUp : TrendingDown;
  const getItemColor = (itemScore: number) =>
    itemScore >= 60 ? 'hsl(var(--success))' : itemScore >= 40 ? 'hsl(38 92% 50%)' : 'hsl(var(--destructive))';

  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/50 bg-card p-5 transition-colors duration-300 hover:border-primary/40">
      <div className="relative flex items-start gap-5">
        {/* Circular gauge */}
        <div className="relative shrink-0">
          <svg width="130" height="130" viewBox="0 0 130 130" className="-rotate-90">
            <circle cx="65" cy="65" r="52" stroke="hsl(var(--muted))" strokeWidth="10" fill="none" opacity={0.3} />
            <circle
              cx="65" cy="65" r="52"
              stroke={color}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{
                transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black mono-value tracking-tighter" style={{ color }}>{score}</span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">/ 100</span>
          </div>
        </div>

        {/* Detalhe */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-4 w-4" style={{ color }} />
            <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">Health Score Comercial</p>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xl font-bold" style={{ color }}>{label}</h3>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>

          <div className="space-y-1.5">
            {items.map((it) => (
              <div key={it.label} className="group/item">
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <Activity className="h-2.5 w-2.5 opacity-60" />
                    {it.label}
                  </span>
                  <span className="font-mono text-foreground/70">{it.detalhe}</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-1000"
                    style={{
                      width: `${it.score}%`,
                      backgroundColor: getItemColor(it.score),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
