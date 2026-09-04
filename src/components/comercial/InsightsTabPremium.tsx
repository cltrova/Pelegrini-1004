import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, UserPlus, Bot, Sparkles, TrendingUp, TrendingDown,
  ShieldCheck, Activity, Brain, Zap, ArrowUpRight, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { buildPageWindow } from '@/utils/pagination';

interface ClienteRisco {
  codigo: string | number;
  fantasia?: string;
  razao?: string;
  ultimaCompra?: string | null;
  diasSemCompra?: number;
}
interface ClienteNovo {
  codigo: string | number;
  fantasia?: string;
  razao?: string;
  primeiraCompra?: string | null;
  faturamentoLiquido: number;
}
interface EvolucaoPoint { vendas: number }

interface Props {
  clientesEmRisco: ClienteRisco[];
  novosClientes: ClienteNovo[];
  evolucaoMensal: EvolucaoPoint[];
  top5PercentualTotal: number;
}

function useCountUp(value: number, duration = 900) {
  const [d, setD] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
    startRef.current = null;
    fromRef.current = d;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setD(fromRef.current + (value - fromRef.current) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return d;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('') || '?';
}

/** Cor estável a partir do nome */
function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function InsightsTabPremium({
  clientesEmRisco,
  novosClientes,
  evolucaoMensal,
  top5PercentualTotal,
}: Props) {
  const totalRiscoValor = useMemo(
    () => clientesEmRisco.length, // sem valor; placeholder p/ count-up
    [clientesEmRisco]
  );
  const totalNovosValor = useMemo(
    () => novosClientes.reduce((s, c) => s + (c.faturamentoLiquido || 0), 0),
    [novosClientes]
  );
  const animRisco = useCountUp(totalRiscoValor);
  const animNovosValor = useCountUp(totalNovosValor);

  const tendenciaUp =
    evolucaoMensal.length >= 2 &&
    evolucaoMensal[evolucaoMensal.length - 1].vendas >
      evolucaoMensal[evolucaoMensal.length - 2].vendas;

  return (
    <section className="relative space-y-6">
      {/* === Grid principal: Risco + Novos === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* --- Clientes em Risco --- */}
        <GlassCard
          tone="warning"
          delay={0}
          title="Clientes em Risco"
          subtitle="Sem compras há mais de 90 dias"
          icon={AlertTriangle}
          countLabel={
            clientesEmRisco.length
              ? `${clientesEmRisco.length} em alerta`
              : 'Carteira saudável'
          }
        >
          {clientesEmRisco.length === 0 ? (
            <EmptyRiskState />
          ) : (
            <PremiumScrollList>
              {clientesEmRisco.map((c, i) => (
                <RiskItem key={String(c.codigo)} c={c} index={i} />
              ))}
            </PremiumScrollList>
          )}
        </GlassCard>

        {/* --- Novos Clientes --- */}
        <GlassCard
          tone="success"
          delay={80}
          title="Novos Clientes"
          subtitle="Primeira compra no último mês"
          icon={UserPlus}
          countLabel={
            novosClientes.length
              ? `${novosClientes.length} conquistados`
              : 'Sem novos no período'
          }
          headerExtra={
            novosClientes.length > 0 && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Receita
                </div>
                <div className="text-sm font-bold tabular-nums text-success">
                  {formatCurrency(animNovosValor)}
                </div>
              </div>
            )
          }
        >
          {novosClientes.length === 0 ? (
            <EmptyNeutralState
              message="Nenhum novo cliente"
              hint="Novos clientes aparecerão aqui assim que registrarem a primeira compra."
            />
          ) : (
            <PremiumScrollList>
              {novosClientes.map((c, i) => (
                <NovoItem key={String(c.codigo)} c={c} index={i} />
              ))}
            </PremiumScrollList>
          )}
        </GlassCard>
      </div>

      {/* === Análise IA === */}
      <GlassCard
        tone="primary"
        delay={140}
        title="Análise IA"
        subtitle="Insights automáticos baseados nos seus dados em tempo real"
        icon={Bot}
        gradientTitle
        countLabel="3 insights ativos"
        headerExtra={
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Live
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AIInsightCard
            tone={tendenciaUp ? 'success' : 'warning'}
            icon={tendenciaUp ? TrendingUp : TrendingDown}
            label="Tendência"
            value={tendenciaUp ? 'Crescimento' : 'Estável / Queda'}
            description={
              tendenciaUp
                ? 'Vendas aceleraram no último mês comparado ao anterior.'
                : 'Vendas estagnadas ou em retração no último mês.'
            }
            delay={0}
          />
          <AIInsightCard
            tone={clientesEmRisco.length > 0 ? 'warning' : 'success'}
            icon={clientesEmRisco.length > 0 ? AlertTriangle : ShieldCheck}
            label="Atenção"
            value={
              clientesEmRisco.length > 0
                ? `${clientesEmRisco.length} em risco`
                : 'Tudo certo'
            }
            description={
              clientesEmRisco.length > 0
                ? 'Clientes inativos podem estar prestes a churn — vale uma abordagem.'
                : 'Nenhum cliente crítico detectado na sua base ativa.'
            }
            delay={80}
          />
          <AIInsightCard
            tone="primary"
            icon={Sparkles}
            label="Concentração"
            value={`${formatPercent(top5PercentualTotal)} no Top 5`}
            description="Participação dos 5 maiores clientes no faturamento total do período."
            delay={160}
          />
        </div>
      </GlassCard>

      <style>{`
        @keyframes ipremFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .iprem-scroll::-webkit-scrollbar { width: 6px; }
        .iprem-scroll::-webkit-scrollbar-track { background: transparent; }
        .iprem-scroll::-webkit-scrollbar-thumb {
          background: hsl(var(--border));
          border-radius: 3px;
        }
        .iprem-scroll:hover::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.35); }
      `}</style>
    </section>
  );
}

/* ============== Subcomponentes ============== */

type Tone = 'primary' | 'success' | 'warning' | 'danger';

const TONE_MAP: Record<Tone, { ring: string; soft: string; text: string }> = {
  primary: {
    ring: 'hsl(var(--primary))',
    soft: 'hsl(var(--primary) / 0.10)',
    text: 'hsl(var(--primary))',
  },
  success: {
    ring: 'hsl(var(--success))',
    soft: 'hsl(var(--success) / 0.10)',
    text: 'hsl(var(--success))',
  },
  warning: {
    ring: 'hsl(var(--warning))',
    soft: 'hsl(var(--warning) / 0.10)',
    text: 'hsl(var(--warning))',
  },
  danger: {
    ring: 'hsl(var(--destructive))',
    soft: 'hsl(var(--destructive) / 0.10)',
    text: 'hsl(var(--destructive))',
  },
};

interface GlassCardProps {
  tone: Tone;
  title: string;
  subtitle?: string;
  icon: typeof Sparkles;
  countLabel?: string;
  headerExtra?: React.ReactNode;
  gradientTitle?: boolean;
  delay?: number;
  children: React.ReactNode;
}

function GlassCard({
  tone, title, subtitle, icon: Icon, countLabel, headerExtra, gradientTitle, delay = 0, children,
}: GlassCardProps) {
  const t = TONE_MAP[tone];
  return (
    <div
      className="group relative overflow-hidden rounded-lg border border-border/60 bg-card transition-colors duration-300 ease-out hover:border-primary/30"
      style={{
        animation: `ipremFadeUp 0.6s ${delay}ms ease-out backwards`,
      }}
    >
      <div className="relative flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{
              background: t.soft,
              boxShadow: `inset 0 0 0 1px ${t.ring}44`,
            }}
          >
            <Icon className="h-4.5 w-4.5" style={{ color: t.text }} />
          </div>
          <div className="min-w-0">
            <h3
              className={cn(
                'text-base font-semibold tracking-tight leading-tight',
                gradientTitle && 'text-primary'
              )}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
            {countLabel && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: t.ring }}
                />
                {countLabel}
              </div>
            )}
          </div>
        </div>
        {headerExtra}
      </div>

      <div className="relative px-5 pb-5 pt-1">{children}</div>
    </div>
  );
}

function PremiumScrollList({ children, pageSize = 5 }: { children: React.ReactNode; pageSize?: number }) {
  const items = React.Children.toArray(children);
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return (
    <div className="flex flex-col">
      <div className="space-y-2 min-h-[320px]">
        {pageItems}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className={cn(
              'flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-all',
              safePage === 0
                ? 'text-muted-foreground/40 cursor-not-allowed'
                : 'text-foreground hover:bg-muted/40 hover:text-primary',
            )}
          >
            <ChevronLeft className="h-3 w-3" /> Anterior
          </button>

          <div className="flex items-center gap-1">
            {buildPageWindow(safePage, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`d${i}`} className="px-1 text-[10px] text-muted-foreground/60 select-none">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-5 min-w-5 px-1.5 text-[10px] font-semibold rounded-md tabular-nums transition-all',
                    p === safePage
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
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
              'flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-all',
              safePage === totalPages - 1
                ? 'text-muted-foreground/40 cursor-not-allowed'
                : 'text-foreground hover:bg-muted/40 hover:text-primary',
            )}
          >
            Próxima <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ name, tone }: { name: string; tone: Tone }) {
  const t = TONE_MAP[tone];
  const hue = hashHue(name);
  return (
    <div
      className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-[11px] font-bold tracking-wide"
      style={{
        background: `hsl(${hue} 55% 42% / 0.18)`,
        boxShadow: `inset 0 0 0 1px ${t.ring}33`,
        color: t.text,
      }}
    >
      {initials(name)}
    </div>
  );
}

function RiskItem({ c, index }: { c: ClienteRisco; index: number }) {
  const name = c.fantasia || c.razao || '—';
  const dias = c.diasSemCompra ?? 0;
  const sev: Tone = dias >= 180 ? 'danger' : 'warning';
  const t = TONE_MAP[sev];
  return (
    <div
      className="group/item relative flex items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5 transition-colors duration-300 hover:border-warning/30 hover:bg-muted/30"
      style={{
        animation: `ipremFadeUp 0.45s ${index * 30}ms ease-out backwards`,
      }}
    >
      <Avatar name={name} tone={sev} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" title={name}>{name}</p>
        <p className="text-[11px] text-muted-foreground">
          Última compra: {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR') : 'Nunca'}
        </p>
      </div>
      <div
        className="rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
        style={{
          background: t.soft,
          borderColor: `${t.ring}44`,
          color: t.text,
        }}
      >
        {dias}d
      </div>
    </div>
  );
}

function NovoItem({ c, index }: { c: ClienteNovo; index: number }) {
  const name = c.fantasia || c.razao || '—';
  return (
    <div
      className="group/item relative flex items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5 transition-colors duration-300 hover:border-success/30 hover:bg-muted/30"
      style={{ animation: `ipremFadeUp 0.45s ${index * 30}ms ease-out backwards` }}
    >
      <Avatar name={name} tone="success" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" title={name}>{name}</p>
        <p className="text-[11px] text-muted-foreground">
          1ª compra: {c.primeiraCompra ? new Date(c.primeiraCompra).toLocaleDateString('pt-BR') : '-'}
        </p>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums text-success">
          {formatCurrency(c.faturamentoLiquido)}
        </div>
        <div className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
          <ArrowUpRight className="h-2.5 w-2.5" /> novo
        </div>
      </div>
    </div>
  );
}

function EmptyRiskState() {
  return (
    <div className="relative flex flex-col items-center justify-center text-center py-10">
      <div className="relative mb-4">
        <div
          className="relative h-16 w-16 rounded-lg flex items-center justify-center bg-success/10 border border-success/30"
          style={{
            boxShadow: 'inset 0 0 0 1px hsl(var(--success) / 0.30)',
          }}
        >
          <ShieldCheck className="h-7 w-7 text-success" />
        </div>
      </div>
      <h4 className="text-sm font-semibold tracking-tight">Carteira saudável</h4>
      <p className="text-[11.5px] text-muted-foreground max-w-[260px] mt-1 leading-relaxed">
        Nenhum cliente com mais de 90 dias sem compra. Continue o ótimo trabalho.
      </p>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-success">
        <Sparkles className="h-3 w-3" /> 0 em risco
      </div>
    </div>
  );
}

function EmptyNeutralState({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10">
      <div className="h-14 w-14 rounded-lg flex items-center justify-center mb-3 bg-muted/30 border border-border/60">
        <UserPlus className="h-6 w-6 text-muted-foreground" />
      </div>
      <h4 className="text-sm font-semibold tracking-tight">{message}</h4>
      <p className="text-[11.5px] text-muted-foreground max-w-[260px] mt-1 leading-relaxed">
        {hint}
      </p>
    </div>
  );
}

interface AIInsightCardProps {
  tone: Tone;
  icon: typeof Sparkles;
  label: string;
  value: string;
  description: string;
  delay?: number;
}

function AIInsightCard({ tone, icon: Icon, label, value, description, delay = 0 }: AIInsightCardProps) {
  const t = TONE_MAP[tone];
  return (
    <div
      className="group relative overflow-hidden rounded-lg border border-border/60 bg-card p-4 transition-colors duration-300 hover:border-primary/30 hover:bg-muted/30"
      style={{
        animation: `ipremFadeUp 0.5s ${delay}ms ease-out backwards`,
      }}
    >
      <div className="relative flex items-start justify-between gap-2 mb-3">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center"
          style={{
            background: t.soft,
            boxShadow: `inset 0 0 0 1px ${t.ring}44`,
          }}
        >
          <Icon className="h-4 w-4" style={{ color: t.text }} />
        </div>
        <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <Brain className="h-3 w-3" /> IA
        </div>
      </div>
      <div className="relative space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p
          className="text-base font-bold tracking-tight"
          style={{ color: t.text }}
        >
          {value}
        </p>
        <p className="text-[11.5px] text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
