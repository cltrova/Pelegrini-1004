import { useId, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Boxes, ClipboardCheck, FileText, PackageCheck, PackageOpen } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getProdutividadeColaborador, type ProdutividadeColaborador } from './produtividadeColaborador';

const metrics = {
  pedidos_separados: 'Pedidos separados',
  unidades_separadas: 'Unidades separadas',
  pedidos_conferidos: 'Pedidos conferidos',
  unidades_pedidos_marcados_conferidos: 'Unidades dos pedidos conferidos',
  unidades_conferidas_registradas: 'Unidades por leitura',
  notas_lancadas: 'Notas lançadas',
  unidades_guardadas: 'Unidades guardadas',
} as const;

type Metric = keyof typeof metrics;
type Totals = Record<Metric, number>;

export type ProdutividadeResumo = Totals & {
  notas_guarda_consideradas: number;
  notas_guarda_concluidas: number;
  nivel_servico_guarda_pct: number | null;
};
export type ProdutividadeLinha = Totals & {
  data_atividade: string;
  cod_empresa_bi: number;
  cod_empresa: number;
  identificacao_responsavel: string;
  nome_responsavel: string;
};

const panels = {
  separacao: { label: 'Separação', title: 'Separação por colaborador', icon: PackageOpen, color: 'hsl(var(--chart-1))', series: ['pedidos_separados', 'unidades_separadas'] },
  conferencia: { label: 'Conferência', title: 'Conferência por colaborador', icon: ClipboardCheck, color: 'hsl(var(--chart-2))', series: ['pedidos_conferidos', 'unidades_pedidos_marcados_conferidos'] },
  nivel: { label: 'Guarda de NF', title: 'Nível de serviço de guarda de NF', icon: PackageCheck, color: 'hsl(var(--chart-3))', series: [] },
  notas: { label: 'Lançamento de NF', title: 'Lançamento de NF por colaborador', icon: FileText, color: 'hsl(var(--chart-4))', series: ['notas_lancadas'] },
  unidades: { label: 'Guarda de unidades', title: 'Unidades guardadas por colaborador', icon: Boxes, color: 'hsl(var(--chart-1))', series: ['unidades_guardadas'] },
} as const;
type Panel = keyof typeof panels;
type BarPanel = 'separacao' | 'conferencia';
type Collaborator = ProdutividadeColaborador & { totals: Totals };
type Detail = { panel: Panel; status?: 'concluidas' | 'pendentes'; byDay?: boolean };

const keys = Object.keys(metrics) as Metric[];
const teal = 'hsl(var(--chart-2))';
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const valueOf = (value: number) => Number.isFinite(Number(value)) ? Number(value) : 0;
const percentOf = (resumo: ProdutividadeResumo) => resumo.nivel_servico_guarda_pct == null ? '—' : number.format(resumo.nivel_servico_guarda_pct) + '%';

function groupCollaborators(rows: readonly ProdutividadeLinha[]) {
  const collaborators = new Map<string, Collaborator>();
  for (const row of rows) {
    const collaborator = getProdutividadeColaborador(row);
    const person = collaborators.get(collaborator.id) ?? {
      ...collaborator,
      totals: Object.fromEntries(keys.map(key => [key, 0])) as Totals,
    };
    for (const key of keys) person.totals[key] += valueOf(row[key]);
    collaborators.set(collaborator.id, person);
  }
  return [...collaborators.values()];
}

function shortName(name: string) {
  const [first, ...rest] = name.split(/\s+/);
  const last = rest[rest.length - 1];
  if (!last || name.length < 12) return name;
  return first + ' ' + last[0] + '.';
}

function hasActivity(person: Collaborator, series: readonly Metric[]) {
  return series.some(key => person.totals[key] > 0);
}

function comparePeople(a: Collaborator, b: Collaborator, metric: Metric) {
  return b.totals[metric] - a.totals[metric] || a.name.localeCompare(b.name, 'pt-BR');
}

function ChartFrame({ panel, title = panels[panel].title, children, onDetails }: {
  panel: Panel;
  title?: string;
  children: ReactNode;
  onDetails: () => void;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="operational-panel min-w-0 overflow-hidden rounded-sm border bg-card">
      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-border/60 px-3.5">
        <h2 id={id} className="text-sm font-semibold leading-tight">{title}</h2>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground"
          title="Ver dados" aria-label={'Ver dados de ' + title.toLocaleLowerCase('pt-BR')} onClick={onDetails}>
          <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
      </div>
      {children}
    </section>
  );
}

function VerticalChart({ panel, collaborators, onDetail, onCollaborator }: {
  panel: BarPanel;
  collaborators: Collaborator[];
  onDetail: (detail: Detail) => void;
  onCollaborator: (person: ProdutividadeColaborador) => void;
}) {
  const gradient = 'produtividade-' + useId().replace(/[^a-z0-9_-]/gi, '');
  const series: readonly Metric[] = panels[panel].series;
  const [hidden, setHidden] = useState<Metric | null>(null);
  const visible = series.filter(metric => metric !== hidden);
  const rank = visible[visible.length - 1];
  const data = collaborators.filter(person => hasActivity(person, visible))
    .sort((a, b) => comparePeople(a, b, rank))
    .map(person => ({ ...person.totals, person }));
  const names = new Map(data.map(({ person }) => [person.id, person]));
  const byShortName = new Map<string, number>();
  for (const { person } of data) {
    const label = shortName(person.name);
    byShortName.set(label, (byShortName.get(label) ?? 0) + 1);
  }
  const config = Object.fromEntries(series.map((metric, index) => [
    metric,
    { label: metrics[metric], color: index ? teal : series.length > 1 ? 'hsl(var(--chart-1))' : panels[panel].color },
  ]));

  return (
    <ChartFrame panel={panel} onDetails={() => onDetail({ panel })}>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-1 px-3 pb-0.5 pt-1.5">
          {series.map(metric => (
            <Button key={metric} type="button" size="sm" variant="ghost"
              className="h-6 gap-1.5 px-2 text-[11px] aria-[pressed=false]:text-muted-foreground aria-[pressed=false]:line-through"
              aria-pressed={hidden !== metric}
              aria-disabled={hidden !== null && hidden !== metric}
              onClick={() => setHidden(current => current === metric ? null : current ?? metric)}>
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: config[metric].color }} aria-hidden="true" />
              {metrics[metric]}
            </Button>
          ))}
        </div>
      )}
      {data.length === 0 ? (
        <p className="grid h-[156px] place-items-center px-3 text-sm text-muted-foreground">Sem atividade para exibir.</p>
      ) : (
        <div className="overflow-x-auto px-2 pb-1">
          <ChartContainer config={config} className="aspect-auto h-[156px] w-full"
            style={{ minWidth: data.length * 64 + 28 }}>
            <BarChart accessibilityLayer data={data} margin={{ top: 10, right: 9, bottom: 0, left: 0 }} barGap={3}>
              <defs>
                {series.map(metric => (
                  <linearGradient key={metric} id={gradient + '-' + metric} x1="0%" y1="0%" x2="85%" y2="100%">
                    <stop offset="0%" stopColor={config[metric].color} />
                    <stop offset="54%" stopColor={config[metric].color} stopOpacity={0.88} />
                    <stop offset="100%" stopColor={config[metric].color} stopOpacity={0.53} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4" />
              <YAxis width={48} axisLine={false} tickLine={false} allowDecimals={false} tickCount={4} tickFormatter={value => compact.format(value)} />
              <XAxis dataKey="person.id" interval={0} axisLine={false} tickLine={false}
                tick={({ x, y, payload }) => {
                  const person = names.get(payload.value);
                  if (!person) return <g />;
                  const label = shortName(person.name);
                  return (
                    <text x={x} y={y + 10} textAnchor="middle" fontSize={10} role="button" tabIndex={0}
                      aria-label={'Ver atividades de ' + person.name + ' · Filial ' + person.branch}
                      className="cursor-pointer fill-muted-foreground hover:fill-primary focus-visible:fill-primary"
                      onClick={() => onCollaborator(person)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onCollaborator(person);
                        }
                      }}>
                      {(byShortName.get(label) ?? 0) > 1 ? label + ' · ' + person.branch : label}
                    </text>
                  );
                }} />
              <ChartTooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)', pointerEvents: 'none' }} content={
                <ChartTooltipContent
                  labelFormatter={value => {
                    const person = names.get(value);
                    return person && person.name + ' · Filial ' + person.branch;
                  }}
                  formatter={(value, label, item) => (
                    <div className="flex w-full items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: config[String(item.dataKey)]?.color }} />
                      <span className="text-muted-foreground">{label}</span>
                      <strong className="ml-auto tabular-nums">{number.format(Number(value))}</strong>
                    </div>
                  )}
                />
              } />
              {visible.map(metric => (
                <Bar key={metric} dataKey={metric} name={metrics[metric]} fill={'url(#' + gradient + '-' + metric + ')'}
                  stroke={config[metric].color} strokeOpacity={0.48} radius={[2, 2, 0, 0]} barSize={series.length > 1 ? 23 : 28}
                  className="cursor-pointer hover:brightness-125" isAnimationActive={false}
                  onClick={entry => {
                    const person = entry.payload?.person ?? entry.person;
                    if (person) onCollaborator(person);
                  }} />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </ChartFrame>
  );
}

const guardConfig = {
  concluidas: { label: 'Concluídas', color: 'hsl(var(--chart-2))' },
  pendentes: { label: 'Pendentes', color: 'hsl(var(--chart-4))' },
};

function guardData(resumo: ProdutividadeResumo) {
  const total = valueOf(resumo.notas_guarda_consideradas);
  const concluidas = valueOf(resumo.notas_guarda_concluidas);
  return [
    { status: 'concluidas' as const, value: concluidas },
    { status: 'pendentes' as const, value: Math.max(0, total - concluidas) },
  ];
}

function GuardChart({ resumo, onDetail }: { resumo: ProdutividadeResumo; onDetail: (detail: Detail) => void }) {
  const id = 'guarda-' + useId().replace(/[^a-z0-9_-]/gi, '');
  const data = guardData(resumo);
  const [active, setActive] = useState<(typeof data)[number]['status'] | null>(null);
  return (
    <ChartFrame panel="nivel" onDetails={() => onDetail({ panel: 'nivel' })}>
      {resumo.notas_guarda_consideradas > 0 ? (
        <div className="grid min-h-[162px] grid-cols-[128px_minmax(0,1fr)] items-center gap-2 p-3">
          <div className="relative h-32 w-32">
            <ChartContainer config={guardConfig} className="aspect-square h-full w-full">
              <PieChart>
                <defs>
                  {data.map(({ status }) => (
                    <linearGradient key={status} id={id + '-' + status} x1="0%" y1="0%" x2="85%" y2="100%">
                      <stop offset="0%" stopColor={guardConfig[status].color} />
                      <stop offset="100%" stopColor={guardConfig[status].color} stopOpacity={0.74} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie data={data} dataKey="value" nameKey="status" innerRadius={45} outerRadius={59}
                  startAngle={90} endAngle={-270} cornerRadius={4} paddingAngle={3} stroke="none" isAnimationActive={false} className="cursor-pointer"
                  onMouseEnter={entry => setActive(entry.payload?.status ?? entry.status)}
                  onMouseLeave={() => setActive(null)}
                  onClick={entry => onDetail({ panel: 'nivel', status: entry.payload?.status ?? entry.status })}>
                  {data.map(({ status }) => <Cell key={status} fill={'url(#' + id + '-' + status + ')'}
                    opacity={active && active !== status ? 0.35 : 1} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
              <span className="text-xl font-semibold leading-none tabular-nums">{percentOf(resumo)}</span>
              <span className="mt-1 text-[10px] text-muted-foreground">Concluídas</span>
            </div>
          </div>
          <div className="min-w-0 space-y-1">
            {data.map(({ status, value }) => (
              <Button key={status} type="button" variant="ghost" size="sm"
                className={cn('h-8 w-full justify-start gap-1.5 px-2 text-xs', active === status && 'bg-muted')}
                onMouseEnter={() => setActive(status)} onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(status)} onBlur={() => setActive(null)}
                onClick={() => onDetail({ panel: 'nivel', status })}>
                <span className="h-2 w-2 rounded-sm" aria-hidden="true" style={{ backgroundColor: guardConfig[status].color }} />
                {guardConfig[status].label} <strong className="ml-auto tabular-nums">{number.format(value)}</strong>
              </Button>
            ))}
            <p className="px-2 pt-1 text-[11px] text-muted-foreground">{number.format(resumo.notas_guarda_consideradas)} notas elegíveis</p>
          </div>
        </div>
      ) : (
        <p className="grid h-[150px] place-items-center px-3 text-sm text-muted-foreground">Sem notas elegíveis no período.</p>
      )}
    </ChartFrame>
  );
}

function InvoicesChart({ collaborators, onDetail, onCollaborator }: {
  collaborators: Collaborator[];
  onDetail: (detail: Detail) => void;
  onCollaborator: (person: ProdutividadeColaborador) => void;
}) {
  const rows = collaborators.filter(person => person.totals.notas_lancadas > 0)
    .sort((a, b) => comparePeople(a, b, 'notas_lancadas'));
  const max = rows[0]?.totals.notas_lancadas ?? 1;
  return (
    <ChartFrame panel="notas" onDetails={() => onDetail({ panel: 'notas' })}>
      {rows.length ? (
        <ol className="max-h-[166px] space-y-0.5 overflow-y-auto px-2 py-1">
          {rows.map((person, index) => (
            <li key={person.id}>
              <button type="button" className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-1 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                aria-label={person.name + ' · Filial ' + person.branch + ' · ' + number.format(person.totals.notas_lancadas) + ' notas lançadas'}
                onClick={() => onCollaborator(person)}>
                <span className="text-[10px] text-muted-foreground tabular-nums">{index + 1}</span>
                <span className="flex min-w-0 items-baseline gap-1.5 text-xs font-medium">
                  <span className="truncate">{person.name}</span>
                  <span className="shrink-0 text-[10px] font-normal text-muted-foreground">Filial {person.branch}</span>
                </span>
                <strong className="text-xs tabular-nums">{number.format(person.totals.notas_lancadas)}</strong>
                <span className="col-start-2 col-span-2 mt-1 block h-1.5 bg-muted" aria-hidden="true"
                  style={{ maskImage: 'repeating-linear-gradient(to right, black 0 7px, transparent 7px 10px)' }}>
                  <span className="block h-full bg-gradient-to-r from-primary to-[hsl(var(--chart-2))] group-hover:brightness-125"
                    style={{ width: person.totals.notas_lancadas / max * 100 + '%' }} />
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : <p className="grid h-[162px] place-items-center px-3 text-sm text-muted-foreground">Sem notas lançadas no período.</p>}
    </ChartFrame>
  );
}

const guardLine = { unidades: { label: 'Unidades guardadas', color: teal } };
const unitsByDayTitle = 'Unidades guardadas por dia';
const oneDay = 86_400_000;
type DailyUnits = { time: number; unidades: number };
const dateLabel = (time: number) => new Date(time).toISOString().slice(0, 10).split('-').reverse().join('/');

function groupDailyUnits(rows: ProdutividadeLinha[]): DailyUnits[] {
  const daily = new Map<number, number>();
  for (const row of rows) {
    const time = Date.parse(row.data_atividade + 'T00:00:00Z');
    if (Number.isFinite(time)) daily.set(time, (daily.get(time) ?? 0) + valueOf(row.unidades_guardadas));
  }
  return [...daily].sort(([a], [b]) => a - b).map(([time, unidades]) => ({ time, unidades }));
}

function UnitsChart({ days, onDetail }: { days: DailyUnits[]; onDetail: (detail: Detail) => void }) {
  const id = 'unidades-' + useId().replace(/[^a-z0-9_-]/gi, '');
  const data = days.flatMap((day, index) => {
    const previous = days[index - 1];
    return previous && day.time - previous.time > oneDay
      ? [{ time: previous.time + oneDay, unidades: null }, day] : [day];
  });
  const single = days.length === 1;
  const singleTime = days[0]?.time ?? 0;
  return (
    <ChartFrame panel="unidades" title={unitsByDayTitle} onDetails={() => onDetail({ panel: 'unidades', byDay: true })}>
      {data.length ? (
        <ChartContainer config={guardLine} className="aspect-auto h-[162px] w-full px-2 pb-1">
          <AreaChart accessibilityLayer data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={id} x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor={teal} stopOpacity={0.45} />
                <stop offset="100%" stopColor={teal} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4" />
            <YAxis width={48} axisLine={false} tickLine={false} allowDecimals={false} tickCount={4} tickFormatter={value => compact.format(value)} />
            <XAxis type="number" dataKey="time" scale="time"
              domain={single ? [singleTime - oneDay / 2, singleTime + oneDay / 2] : ['dataMin', 'dataMax']}
              ticks={single ? [singleTime] : undefined} minTickGap={16} axisLine={false} tickLine={false} tickCount={5}
              tickFormatter={value => dateLabel(value).slice(0, 5)} />
            <ChartTooltip content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const time = payload?.[0]?.payload?.time;
                  return typeof time === 'number' ? dateLabel(time) : '';
                }}
                formatter={value => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">Unidades guardadas</span>
                    <strong className="tabular-nums">{number.format(Number(value))}</strong>
                  </div>
                )}
              />
            } />
            <Area type="linear" dataKey="unidades" stroke={teal} strokeWidth={2.5} fill={'url(#' + id + ')'}
              isAnimationActive={false} dot={days.length <= 7 || data.length !== days.length} activeDot={{ r: 5, strokeWidth: 2 }} />
          </AreaChart>
        </ChartContainer>
      ) : <p className="grid h-[162px] place-items-center px-3 text-sm text-muted-foreground">Sem atividade para exibir.</p>}
    </ChartFrame>
  );
}

function DetailsTable({ detail, collaborators, resumo, days, onCollaborator }: {
  detail: Detail;
  collaborators: Collaborator[];
  resumo: ProdutividadeResumo;
  days: DailyUnits[];
  onCollaborator: (person: ProdutividadeColaborador) => void;
}) {
  if (detail.byDay) {
    if (!days.length) return <p className="text-sm text-muted-foreground">Sem atividade no período.</p>;
    return (
      <Table>
        <TableHeader><TableRow><TableHead>Dia</TableHead><TableHead className="text-right">Unidades guardadas</TableHead></TableRow></TableHeader>
        <TableBody>
          {days.map(({ time, unidades }) => (
            <TableRow key={time}>
              <TableCell>{dateLabel(time)}</TableCell>
              <TableCell className="text-right tabular-nums">{number.format(unidades)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  if (detail.panel === 'nivel') {
    const data = guardData(resumo);
    return (
      <>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <dt className="text-xs text-muted-foreground">Notas elegíveis</dt>
            <dd className="text-lg font-semibold tabular-nums">{number.format(resumo.notas_guarda_consideradas)}</dd>
          </div>
          {data.map(({ status, value }) => (
            <div key={status} className={cn('rounded-md border p-3', detail.status === status && 'border-primary/60 bg-primary/10')}>
              <dt className="text-xs text-muted-foreground">{guardConfig[status].label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{number.format(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">{resumo.notas_guarda_consideradas > 0
          ? 'O índice de ' + percentOf(resumo) + ' considera a situação atual das notas lançadas no período, sem prazo.'
          : 'Sem notas elegíveis no período.'}</p>
      </>
    );
  }
  const metricsShown: readonly Metric[] = detail.panel === 'conferencia'
    ? [...panels.conferencia.series, 'unidades_conferidas_registradas']
    : panels[detail.panel].series;
  const entries = collaborators.filter(row => hasActivity(row, metricsShown))
    .sort((a, b) => comparePeople(a, b, metricsShown[0]));
  return (
    <>
      <dl className="flex flex-wrap gap-2">
        {metricsShown.map(metric => (
          <div key={metric} className="min-w-24 rounded-sm border bg-muted/30 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{metrics[metric]}</dt>
            <dd className="text-lg font-semibold tabular-nums">{number.format(valueOf(resumo[metric]))}</dd>
          </div>
        ))}
      </dl>
      {(detail.panel === 'separacao' || detail.panel === 'conferencia') && (
        <p className="text-xs text-muted-foreground">O total de pedidos considera pedidos distintos no período. A tabela soma a atividade diária por colaborador.</p>
      )}
      {detail.panel === 'conferencia' && <p className="text-xs text-muted-foreground">As unidades dos pedidos conferidos usam a quantidade atendida atual. Unidades por leitura vêm do log de conferência.</p>}
      {entries.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Filial</TableHead>
              {metricsShown.map(metric => <TableHead className="text-right" key={metric}>{metrics[metric]}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(entry => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">
                  <Button type="button" variant="link" className="h-auto p-0 text-left"
                    aria-label={'Ver atividades de ' + entry.name + ' · Filial ' + entry.branch}
                    onClick={() => onCollaborator(entry)}>
                    {entry.name}
                  </Button>
                </TableCell>
                <TableCell>{entry.branch}</TableCell>
                {metricsShown.map(metric => <TableCell className="text-right tabular-nums" key={metric}>{number.format(valueOf(entry.totals[metric]))}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <p className="text-sm text-muted-foreground">Sem atividade no período.</p>}
    </>
  );
}

export function ProdutividadeDashboard({ rows, resumo, onCollaborator }: {
  rows: ProdutividadeLinha[];
  resumo: ProdutividadeResumo;
  onCollaborator: (person: ProdutividadeColaborador) => void;
}) {
  const cardId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const collaborators = groupCollaborators(rows);
  const days = groupDailyUnits(rows);
  function showDetail(next: Detail) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDetail(next);
  }
  const cards = [
    { panel: 'separacao', label: metrics.pedidos_separados, value: number.format(resumo.pedidos_separados) },
    { panel: 'separacao', label: metrics.unidades_separadas, value: number.format(resumo.unidades_separadas) },
    { panel: 'conferencia', label: metrics.pedidos_conferidos, value: number.format(resumo.pedidos_conferidos) },
    { panel: 'conferencia', label: metrics.unidades_pedidos_marcados_conferidos, value: number.format(resumo.unidades_pedidos_marcados_conferidos) },
    { panel: 'conferencia', label: metrics.unidades_conferidas_registradas, value: number.format(resumo.unidades_conferidas_registradas) },
    { panel: 'notas', label: metrics.notas_lancadas, value: number.format(resumo.notas_lancadas) },
    { panel: 'unidades', label: metrics.unidades_guardadas, value: number.format(resumo.unidades_guardadas) },
    { panel: 'nivel', label: 'Guarda concluída', value: percentOf(resumo) },
  ] as const;
  return (
    <>
      <section aria-label="Totalizadores de produtividade" className="operational-kpi-grid operational-metric-strip grid grid-cols-2 gap-px overflow-hidden rounded-sm border bg-border sm:grid-cols-4 xl:grid-cols-8">
        {cards.map(({ panel, label, value }, index) => {
          const { icon: Icon, color } = panels[panel];
          return (
            <button key={label} type="button" aria-label={'Detalhar ' + label.toLocaleLowerCase('pt-BR')} aria-describedby={cardId + index}
              className="group relative flex min-h-16 min-w-0 flex-col justify-between gap-1 overflow-hidden bg-card px-3 py-2 text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => showDetail({ panel })}>
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5" style={{ backgroundColor: color }} />
              <span className="flex items-start gap-1.5 text-[11px] font-medium leading-tight text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" style={{ color }} />
                {label}
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 group-hover:text-primary" aria-hidden="true" />
              </span>
              <strong id={cardId + index} className="text-xl font-semibold leading-tight tabular-nums">{value}</strong>
            </button>
          );
        })}
      </section>
      <section aria-label="Gráficos de produtividade" className="space-y-2">
        <div className="grid gap-2 lg:grid-cols-2">
          <VerticalChart panel="separacao" collaborators={collaborators} onDetail={showDetail} onCollaborator={onCollaborator} />
          <VerticalChart panel="conferencia" collaborators={collaborators} onDetail={showDetail} onCollaborator={onCollaborator} />
        </div>
        <div className="grid gap-2 lg:grid-cols-3">
          <GuardChart resumo={resumo} onDetail={showDetail} />
          <InvoicesChart collaborators={collaborators} onDetail={showDetail} onCollaborator={onCollaborator} />
          <UnitsChart days={days} onDetail={showDetail} />
        </div>
      </section>
      <Dialog open={detail !== null} onOpenChange={open => { if (!open) setDetail(null); }}>
        {detail && (
          <DialogContent className="operational-overlay max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl overflow-auto"
            onCloseAutoFocus={event => {
              event.preventDefault();
              if (returnFocus.current?.isConnected) returnFocus.current.focus();
            }}>
            <DialogHeader>
              <DialogTitle>{detail.byDay ? unitsByDayTitle : panels[detail.panel].title}</DialogTitle>
              <DialogDescription>Dados do período e da filial selecionados.</DialogDescription>
            </DialogHeader>
            <DetailsTable detail={detail} collaborators={collaborators} resumo={resumo} days={days} onCollaborator={onCollaborator} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
