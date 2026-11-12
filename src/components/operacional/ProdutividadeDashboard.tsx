import { useId, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Boxes, ClipboardCheck, FileText, PackageCheck, PackageOpen } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

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
type BarPanel = Exclude<Panel, 'nivel'>;
type Collaborator = { id: string; name: string; branch: number; identity: string; totals: Totals };
type Detail = { panel: Panel; collaboratorId?: string; status?: 'concluidas' | 'pendentes' };

const keys = Object.keys(metrics) as Metric[];
const teal = 'hsl(var(--chart-2))';
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const valueOf = (value: number) => Number.isFinite(Number(value)) ? Number(value) : 0;
const percentOf = (resumo: ProdutividadeResumo) => resumo.nivel_servico_guarda_pct == null ? '—' : number.format(resumo.nivel_servico_guarda_pct) + '%';

function collaboratorKey(row: ProdutividadeLinha) {
  return JSON.stringify([Number(row.cod_empresa), String(row.identificacao_responsavel ?? '').trim() || row.nome_responsavel?.trim()]);
}

function groupCollaborators(rows: readonly ProdutividadeLinha[]) {
  const collaborators = new Map<string, Collaborator>();
  for (const row of rows) {
    const id = collaboratorKey(row);
    const person = collaborators.get(id) ?? {
      id,
      name: row.nome_responsavel?.trim() || 'Sem nome',
      branch: Number(row.cod_empresa),
      identity: String(row.identificacao_responsavel ?? '').trim(),
      totals: Object.fromEntries(keys.map(key => [key, 0])) as Totals,
    };
    for (const key of keys) person.totals[key] += valueOf(row[key]);
    collaborators.set(id, person);
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

function ChartFrame({ panel, children, onDetails }: {
  panel: Panel;
  children: ReactNode;
  onDetails: () => void;
}) {
  const id = useId();
  const { title } = panels[panel];
  return (
    <section aria-labelledby={id} className="min-w-0 overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
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

function VerticalChart({ panel, collaborators, onDetail }: {
  panel: BarPanel;
  collaborators: Collaborator[];
  onDetail: (detail: Detail) => void;
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
              <YAxis width={34} axisLine={false} tickLine={false} allowDecimals={false} tickCount={4} tickFormatter={value => compact.format(value)} />
              <XAxis dataKey="person.id" interval={0} axisLine={false} tickLine={false} tickMargin={6} tick={{ fontSize: 10 }}
                tickFormatter={value => {
                  const person = names.get(value);
                  if (!person) return '';
                  const label = shortName(person.name);
                  return (byShortName.get(label) ?? 0) > 1 ? label + ' · ' + person.branch : label;
                }} />
              <ChartTooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} content={
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
                  stroke={config[metric].color} strokeOpacity={0.48} radius={[4, 4, 0, 0]} barSize={series.length > 1 ? 23 : 28}
                  className="cursor-pointer" isAnimationActive={false}
                  onClick={entry => onDetail({ panel, collaboratorId: (entry.payload?.person ?? entry.person)?.id })} />
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
  return (
    <ChartFrame panel="nivel" onDetails={() => onDetail({ panel: 'nivel' })}>
      {resumo.notas_guarda_consideradas > 0 ? (
        <>
          <div className="relative">
            <ChartContainer config={guardConfig} className="mx-auto aspect-auto h-[124px] w-full max-w-56">
              <PieChart accessibilityLayer>
                <defs>
                  {data.map(({ status }) => (
                    <linearGradient key={status} id={id + '-' + status} x1="0%" y1="0%" x2="85%" y2="100%">
                      <stop offset="0%" stopColor={guardConfig[status].color} />
                      <stop offset="100%" stopColor={guardConfig[status].color} stopOpacity={0.74} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie data={data} cy="55%" dataKey="value" nameKey="status" innerRadius={33} outerRadius={50}
                  startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false} tooltipType="none" pointerEvents="none">
                  {data.map(({ status }) => <Cell key={status} fill={guardConfig[status].color} opacity={0.42} />)}
                </Pie>
                <Pie data={data} cy="49%" dataKey="value" nameKey="status" innerRadius={33} outerRadius={50}
                  startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false} className="cursor-pointer"
                  onClick={entry => onDetail({ panel: 'nivel', status: entry.payload?.status ?? entry.status })}>
                  {data.map(({ status }) => <Cell key={status} fill={'url(#' + id + '-' + status + ')'} />)}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="status" />} />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
              <span className="text-[17px] font-semibold leading-none tabular-nums">{percentOf(resumo)}</span>
              <span className="mt-1 text-[9px] text-muted-foreground">Concluídas</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-2 pb-1">
            {data.map(({ status, value }) => (
              <Button key={status} type="button" variant="ghost" size="sm" className="h-6 gap-1.5 px-2 text-[11px]"
                onClick={() => onDetail({ panel: 'nivel', status })}>
                <span className="h-2 w-2 rounded-sm" aria-hidden="true" style={{ backgroundColor: guardConfig[status].color }} />
                {guardConfig[status].label} <strong className="tabular-nums">{number.format(value)}</strong>
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p className="grid h-[150px] place-items-center px-3 text-sm text-muted-foreground">Sem notas elegíveis no período.</p>
      )}
    </ChartFrame>
  );
}

function DetailsTable({ detail, rows, collaborators, person, resumo, onSelect }: {
  detail: Detail;
  rows: ProdutividadeLinha[];
  collaborators: Collaborator[];
  person?: Collaborator;
  resumo: ProdutividadeResumo;
  onSelect: (id?: string) => void;
}) {
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
  if (detail.collaboratorId && !person) return <p className="text-sm text-muted-foreground">Sem atividade para este colaborador no período.</p>;
  const entries = person
    ? rows.filter(row => collaboratorKey(row) === person.id && metricsShown.some(metric => valueOf(row[metric]) > 0))
      .sort((a, b) => b.data_atividade.localeCompare(a.data_atividade))
      .map(row => ({ label: row.data_atividade.split('-').reverse().join('/'), branch: row.cod_empresa, key: row.data_atividade, totals: row }))
    : collaborators.filter(row => hasActivity(row, metricsShown))
      .sort((a, b) => comparePeople(a, b, metricsShown[0]))
      .map(row => ({ label: row.name, branch: row.branch, key: row.id, totals: row.totals }));
  return (
    <>
      <dl className="flex flex-wrap gap-2">
        {metricsShown.map(metric => (
          <div key={metric} className="min-w-24 rounded-md border bg-muted/30 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{metrics[metric]}</dt>
            <dd className="text-lg font-semibold tabular-nums">{number.format(valueOf((person?.totals ?? resumo)[metric]))}</dd>
          </div>
        ))}
      </dl>
      {person && <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => onSelect()}>Ver todos os colaboradores</Button>}
      {!person && (detail.panel === 'separacao' || detail.panel === 'conferencia') && (
        <p className="text-xs text-muted-foreground">O total de pedidos considera pedidos distintos no período. A tabela soma a atividade diária por colaborador.</p>
      )}
      {detail.panel === 'conferencia' && <p className="text-xs text-muted-foreground">As unidades dos pedidos conferidos usam a quantidade atendida atual. Unidades por leitura vêm do log de conferência.</p>}
      {entries.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{person ? 'Dia' : 'Colaborador'}</TableHead>
              <TableHead>Filial</TableHead>
              {metricsShown.map(metric => <TableHead className="text-right" key={metric}>{metrics[metric]}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(entry => (
              <TableRow key={entry.key}>
                <TableCell className="font-medium">
                  {person ? entry.label : (
                    <Button type="button" variant="link" className="h-auto p-0 text-left"
                      aria-label={'Ver dias de ' + entry.label + ' · Filial ' + entry.branch}
                      onClick={() => onSelect(entry.key)}>
                      {entry.label}
                    </Button>
                  )}
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

export function ProdutividadeDashboard({ rows, resumo }: { rows: ProdutividadeLinha[]; resumo: ProdutividadeResumo }) {
  const cardId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const collaborators = groupCollaborators(rows);
  const selected = collaborators.find(person => person.id === detail?.collaboratorId);
  function showDetail(next: Detail) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDetail(next);
  }
  const cards = [
    { panel: 'separacao', value: number.format(resumo.pedidos_separados), unit: 'pedidos', extra: number.format(resumo.unidades_separadas) + ' unidades' },
    { panel: 'conferencia', value: number.format(resumo.pedidos_conferidos), unit: 'pedidos', extra: number.format(resumo.unidades_pedidos_marcados_conferidos) + ' unidades · ' + number.format(resumo.unidades_conferidas_registradas) + ' por leitura' },
    { panel: 'nivel', value: percentOf(resumo), unit: 'concluídas', extra: number.format(resumo.notas_guarda_concluidas) + ' de ' + number.format(resumo.notas_guarda_consideradas) + ' notas elegíveis' },
    { panel: 'notas', value: number.format(resumo.notas_lancadas), unit: 'notas lançadas', extra: 'Notas fiscais de compra' },
    { panel: 'unidades', value: number.format(resumo.unidades_guardadas), unit: 'unidades guardadas', extra: '' },
  ] as const;
  return (
    <>
      <section aria-label="Totalizadores de produtividade" className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {cards.map(({ panel, value, unit, extra }) => {
          const { label, icon: Icon, color } = panels[panel];
          return (
            <button key={panel} type="button" aria-label={'Detalhar ' + label.toLocaleLowerCase('pt-BR')} aria-describedby={cardId + panel}
              className="group relative min-w-0 overflow-hidden rounded-lg border border-border bg-card px-3 py-2 text-left shadow-sm transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:col-span-2 lg:last:col-span-1"
              onClick={() => showDetail({ panel })}>
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5" style={{ backgroundColor: color }} />
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" style={{ color }} />
                {label}
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 group-hover:text-primary" aria-hidden="true" />
              </span>
              <span id={cardId + panel} className="mt-1 block">
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <strong className="text-xl font-semibold leading-tight tabular-nums">{value}</strong>
                  <span className="text-[10px] text-muted-foreground">{unit}</span>
                </span>
                {extra && <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">{extra}</span>}
              </span>
            </button>
          );
        })}
      </section>
      <section aria-label="Gráficos de produtividade" className="space-y-2">
        <div className="grid gap-2 lg:grid-cols-2">
          <VerticalChart panel="separacao" collaborators={collaborators} onDetail={showDetail} />
          <VerticalChart panel="conferencia" collaborators={collaborators} onDetail={showDetail} />
        </div>
        <div className="grid gap-2 lg:grid-cols-3">
          <GuardChart resumo={resumo} onDetail={showDetail} />
          <VerticalChart panel="notas" collaborators={collaborators} onDetail={showDetail} />
          <VerticalChart panel="unidades" collaborators={collaborators} onDetail={showDetail} />
        </div>
      </section>
      <Dialog open={detail !== null} onOpenChange={open => { if (!open) setDetail(null); }}>
        {detail && (
          <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl overflow-auto rounded-lg"
            onCloseAutoFocus={event => {
              if (returnFocus.current?.isConnected) {
                event.preventDefault();
                returnFocus.current.focus();
              }
            }}>
            <DialogHeader>
              <DialogTitle>{panels[detail.panel].title}</DialogTitle>
              <DialogDescription>
                {selected ? selected.name + ' · Filial ' + selected.branch : 'Dados do período e da filial selecionados.'}
              </DialogDescription>
            </DialogHeader>
            <DetailsTable detail={detail} rows={rows} collaborators={collaborators} person={selected} resumo={resumo}
              onSelect={collaboratorId => setDetail({ panel: detail.panel, collaboratorId })} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
