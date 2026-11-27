import type { CSSProperties, ReactNode } from 'react';
import { ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Gauge, Target, TrendingUp, UsersRound, type LucideIcon } from 'lucide-react';
import { formatCalendarDate, formatCurrency, formatPercent } from '@/utils/formatters';
import './DashboardOverview.css';

export type TeamGoalStatus = 'atingida' | 'proxima' | 'abaixo';

const teamGoals = [
  { id: 'atingida', title: 'Meta atingida', range: '100% ou mais', icon: CheckCircle2 },
  { id: 'proxima', title: 'Próximos da meta', range: '90% a menos de 100%', icon: Target },
  { id: 'abaixo', title: 'Abaixo da meta', range: 'Menos de 90%', icon: CircleAlert },
] as const;

export function getTeamGoalStatus(percent: number): TeamGoalStatus {
  if (percent >= 100) return 'atingida';
  return percent >= 90 ? 'proxima' : 'abaixo';
}

export function formatDashboardPeriod(period?: { inicio: string; fim: string }): string | undefined {
  return period && `${formatCalendarDate(period.inicio)} a ${formatCalendarDate(period.fim)}`;
}

export function DashboardPageHeading({ title, period, actions }: { title: string; period?: string; actions?: ReactNode }) {
  return (
    <header className="dashboard-overview-heading">
      <h1>{title}</h1>
      {(period || actions) && (
        <div className="dashboard-heading-actions">
          {period && <span className="dashboard-period-chip"><CalendarDays aria-hidden="true" /> {period}</span>}
          {actions}
        </div>
      )}
    </header>
  );
}

export function DashboardPanelHeading({ title, icon: Icon, actions }: { title: string; icon: LucideIcon; actions?: ReactNode }) {
  return (
    <header className="dashboard-panel-heading">
      <h2><Icon aria-hidden="true" /> {title}</h2>
      {actions}
    </header>
  );
}

export function DashboardMeter({ percent, label, marker }: {
  percent: number;
  label: string;
  marker?: { percent: number; label: string };
}) {
  const width = Math.max(0, Math.min(percent, 100));
  return (
    <span className="dashboard-meter" role="img" aria-label={label}>
      <span className="dashboard-meter-fill" style={{ width: `${width}%` }} />
      {marker && marker.percent > 0 && marker.percent < 100 && (
        <span className="dashboard-meter-marker" style={{ left: `${marker.percent}%` }} title={marker.label} />
      )}
    </span>
  );
}

interface ExecutiveColumn {
  label: string;
  icon: LucideIcon;
  value: ReactNode;
  context?: ReactNode;
  readings?: ReadonlyArray<{ label: string; value: ReactNode; tone?: TeamGoalStatus }>;
}

function ExecutiveReadings({ readings }: { readings?: ExecutiveColumn['readings'] }) {
  if (!readings?.length) return null;

  return (
    <dl className="dashboard-executive-readings">
      {readings.map(({ label, value, tone }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd data-goal-tone={tone}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DashboardExecutiveSummary({ label, primary, secondary, progress }: {
  label: string;
  primary: ExecutiveColumn;
  secondary: ExecutiveColumn;
  progress?: { percent: number; context: string; tone?: TeamGoalStatus };
}) {
  const PrimaryIcon = primary.icon;
  const SecondaryIcon = secondary.icon;
  return (
    <section className="dashboard-executive dashboard-tab-summary" aria-label={label}>
      <div className="dashboard-executive-revenue">
        <div className="dashboard-executive-head">
          <div className="min-w-0">
            <h2><PrimaryIcon aria-hidden="true" /> {primary.label}</h2>
            <strong className="dashboard-executive-value">{primary.value}</strong>
          </div>
          {progress && (
            <div className="dashboard-executive-percent" data-goal-tone={progress.tone}>
              <strong>{formatPercent(progress.percent)}</strong>
              <small>{progress.context}</small>
            </div>
          )}
        </div>
        {progress ? (
          <DashboardMeter percent={progress.percent} label={`${formatPercent(progress.percent)} ${progress.context}`} />
        ) : primary.context && (
          <p className="dashboard-projection-context">{primary.context}</p>
        )}
        <ExecutiveReadings readings={primary.readings} />
      </div>
      <div className="dashboard-executive-projection">
        <div className="dashboard-executive-head"><h2><SecondaryIcon aria-hidden="true" /> {secondary.label}</h2></div>
        <strong className="dashboard-executive-value">{secondary.value}</strong>
        {secondary.context && <p className="dashboard-projection-context">{secondary.context}</p>}
        <ExecutiveReadings readings={secondary.readings} />
      </div>
    </section>
  );
}

export function DashboardGoalRing({ percent }: { percent: number | null }) {
  const display = percent === null ? '—' : formatPercent(percent);
  const progress = Math.max(0, Math.min(percent ?? 0, 100));

  return (
    <div
      className="dashboard-goal-ring"
      style={{ '--dashboard-ring-progress': `${progress}%` } as CSSProperties}
      data-goal-tone={percent === null ? undefined : getTeamGoalStatus(percent)}
      role="img"
      aria-label={percent === null ? 'Sem percentual de atingimento' : `${display} da meta realizada`}
    >
      <span className="dashboard-goal-ring-value" aria-hidden="true">
        <strong>{display}</strong>
        <small>da meta</small>
      </span>
    </div>
  );
}

interface DashboardGoalPaceProps {
  revenue: number;
  goal: number | null;
  expected: number | null;
  daysRemaining: number | null;
  dailyActual: number | null;
  projection: number | null;
  dailyNeeded: number | null;
  pace: 'acelerar' | 'noritmo' | 'folga';
  onRevenueClick?: () => void;
}

export function DashboardGoalPace({
  revenue, goal, expected, daysRemaining, dailyActual, projection, dailyNeeded, pace, onRevenueClick,
}: DashboardGoalPaceProps) {
  const percent = goal ? revenue / goal * 100 : null;
  const gap = goal === null ? null : goal - revenue;
  const marker = goal && expected !== null ? expected / goal * 100 : null;
  const paceIsEnough = projection !== null && pace === 'noritmo';
  const tone = gap === null ? undefined : gap <= 0 ? 'atingida' : paceIsEnough ? 'proxima' : 'abaixo';
  const status = gap === null ? null : gap <= 0 ? 'Meta atingida'
    : projection === null ? 'Abaixo da meta' : paceIsEnough ? 'No ritmo' : 'Precisa acelerar';

  return (
    <section className="dashboard-executive" aria-label="Ritmo da meta">
      <div className="dashboard-executive-revenue">
        <div className="dashboard-executive-head">
          <div>
            <h2><TrendingUp aria-hidden="true" /> Faturamento realizado</h2>
            {onRevenueClick ? (
              <button type="button" className="dashboard-executive-value dashboard-executive-link" onClick={onRevenueClick}>
                {formatCurrency(revenue)} <ArrowUpRight aria-hidden="true" />
                <span className="sr-only">Abrir detalhamento do faturamento</span>
              </button>
            ) : (
              <strong className="dashboard-executive-value">{formatCurrency(revenue)}</strong>
            )}
          </div>
          {percent !== null && (
            <div className="dashboard-executive-percent" data-goal-tone={getTeamGoalStatus(percent)}>
              <strong>{formatPercent(percent)}</strong>
              <small>da meta mensal</small>
            </div>
          )}
        </div>
        {goal === null ? (
          <p className="dashboard-no-goal">Sem meta cadastrada</p>
        ) : (
          <>
            <DashboardMeter
              percent={percent ?? 0}
              label={`${formatPercent(percent ?? 0)} da meta realizada`}
              marker={marker === null ? undefined : { percent: marker, label: `Meta até hoje: ${formatCurrency(expected ?? 0)}` }}
            />
            <dl className="dashboard-executive-readings">
              <div><dt>Meta mensal</dt><dd>{formatCurrency(goal)}</dd></div>
              {gap !== null && (
                <div>
                  <dt>{gap > 0 ? 'Falta para a meta' : 'Saldo sobre a meta'}</dt>
                  <dd data-goal-tone={gap > 0 ? 'proxima' : 'atingida'}>{gap > 0 ? formatCurrency(gap) : formatCurrency(-gap, true)}</dd>
                </div>
              )}
              {daysRemaining !== null && (
                <div><dt>Dias úteis restantes</dt><dd>{daysRemaining}</dd></div>
              )}
            </dl>
          </>
        )}
      </div>
      <div className="dashboard-executive-projection">
        <div className="dashboard-executive-head">
          <h2><Gauge aria-hidden="true" /> {projection === null && dailyActual !== null ? 'Média por dia útil' : 'Projeção de fechamento'}</h2>
          {status && <span className="dashboard-goal-badge" data-goal-tone={tone}>{status}</span>}
        </div>
        {projection !== null || dailyActual !== null ? (
          <strong className="dashboard-executive-value">{formatCurrency(projection ?? dailyActual ?? 0)}</strong>
        ) : (
          <p className="dashboard-no-goal">Disponível para o mês em andamento.</p>
        )}
        {projection !== null && goal !== null && (
          <>
            <p className="dashboard-projection-context"><strong>{formatPercent(projection / goal * 100)}</strong> da meta no ritmo atual</p>
            <dl className="dashboard-executive-readings">
              {dailyActual !== null && <div><dt>Média realizada por dia útil</dt><dd>{formatCurrency(dailyActual)}</dd></div>}
              {dailyNeeded !== null && <div><dt>Necessário por dia útil</dt><dd>{formatCurrency(dailyNeeded)}</dd></div>}
            </dl>
          </>
        )}
      </div>
    </section>
  );
}

export function DashboardTeamGoals({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<TeamGoalStatus, number>;
  selected: TeamGoalStatus | null;
  onSelect: (status: TeamGoalStatus) => void;
}) {
  const total = counts.atingida + counts.proxima + counts.abaixo;

  return (
    <section className="dashboard-frame dashboard-overview-team" aria-label="Equipe por meta">
      <header className="dashboard-panel-heading">
        <h2><UsersRound aria-hidden="true" /> Equipe por meta</h2>
        {total > 0 && <span className="dashboard-period-chip">{total} {total === 1 ? 'vendedor com meta' : 'vendedores com meta'}</span>}
      </header>
      {total > 0 ? (
        <div className="dashboard-team-body">
          <div className="dashboard-team-bar" aria-hidden="true">
            {teamGoals.filter(({ id }) => counts[id] > 0).map(({ id }) => (
              <span key={id} data-goal-tone={id} style={{ flexGrow: counts[id] }} />
            ))}
          </div>
          <div className="dashboard-team-options" role="group" aria-label="Filtrar o ranking por meta">
            {teamGoals.map(({ id, title, range, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={selected === id}
                aria-controls="dashboard-quick-ranking"
                onClick={() => onSelect(id)}
                data-goal-tone={id}
              >
                <span className="dashboard-team-icon"><Icon aria-hidden="true" /></span>
                <span><strong>{title}</strong><small>{range}</small></span>
                <b>{counts[id]}</b>
                <ChevronRight className="dashboard-team-chevron" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="dashboard-analytics-empty">Nenhum vendedor com meta no período.</p>
      )}
    </section>
  );
}
