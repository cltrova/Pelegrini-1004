import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MapPin,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Building2,
  ShoppingCart,
  DollarSign,
  Users,
} from 'lucide-react';
import brazilPaths from '@/data/brazilStatePaths.json';

interface RegionalData {
  uf: string;
  nome: string;
  faturamento: number;
  pedidos: number;
  clientes: number;
  cidades?: CidadeData[];
}

interface CidadeData {
  cidade: string;
  faturamento: number;
  pedidos: number;
  clientes: number;
}

interface BrazilMapProps {
  data: RegionalData[];
  onStateSelect?: (uf: string) => void;
  /** Optional trend deltas (%) per metric for the right panel */
  trends?: {
    faturamento?: number;
    pedidos?: number;
    clientes?: number;
  };
}

const ESTADOS_NOME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
};

type Periodo = '7D' | '30D' | '12M';

const ESTADOS_PATH = brazilPaths as Record<string, { d: string; cx: number; cy: number }>;

function TrendPill({ value }: { value?: number }) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
        up ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10',
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {up ? '+' : ''}
      {value.toFixed(1)}% vs período anterior
    </span>
  );
}

export function BrazilMap({ data, onStateSelect, trends }: BrazilMapProps) {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('30D');

  const { maxFaturamento, stateData } = useMemo(() => {
    const stateMap = new Map<string, RegionalData>();
    data.forEach((d) => stateMap.set(d.uf, d));
    const max = Math.max(...data.map((d) => d.faturamento), 1);
    return { maxFaturamento: max, stateData: stateMap };
  }, [data]);

  const getStateColor = (uf: string) => {
    const d = stateData.get(uf);
    if (!d || d.faturamento <= 0) return 'hsl(217, 30%, 22%)';
    const intensity = Math.sqrt(d.faturamento / maxFaturamento); // perceptual ramp
    const lightness = 78 - intensity * 48; // 78 → 30
    const saturation = 70 + intensity * 21; // 70 → 91
    return `hsl(217, ${saturation}%, ${lightness}%)`;
  };

  const selectedData = selectedState ? stateData.get(selectedState) : null;

  const handleStateClick = (uf: string) => {
    setSelectedState(uf);
    onStateSelect?.(uf);
  };

  const totais = useMemo(
    () => ({
      faturamento: data.reduce((acc, d) => acc + d.faturamento, 0),
      pedidos: data.reduce((acc, d) => acc + d.pedidos, 0),
      clientes: data.reduce((acc, d) => acc + d.clientes, 0),
    }),
    [data],
  );

  const periodos: Periodo[] = ['7D', '30D', '12M'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_1px_minmax(0,2fr)] gap-6">

      {/* Mapa SVG */}
      <Card className="min-w-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {selectedState ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedState(null)}
                    className="h-6 px-2"
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Voltar
                  </Button>
                  <span>
                    {ESTADOS_NOME[selectedState]} ({selectedState})
                  </span>
                </>
              ) : (
                'Distribuição Geográfica · Brasil'
              )}
            </CardTitle>
            {!selectedState && (
              <Badge variant="secondary" className="text-xs">
                Clique em um estado para detalhes
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedState ? (
            <div className="relative">
              <svg
                viewBox="0 30 600 580"
                className="w-full h-auto"
                style={{ minHeight: '460px', maxHeight: '620px' }}

                onMouseLeave={() => {
                  setHoveredState(null);
                  setHoverPos(null);
                }}
              >
                {Object.entries(ESTADOS_PATH).map(([uf, { d, cx, cy }]) => {
                  const isHovered = hoveredState === uf;
                  const hasData = !!stateData.get(uf);
                  return (
                    <g key={uf}>
                      <path
                        d={d}
                        fill={getStateColor(uf)}
                        stroke="hsl(var(--background))"
                        strokeWidth={isHovered ? 1.4 : 0.6}
                        className={cn(
                          'transition-[fill,stroke-width,opacity] duration-150 cursor-pointer',
                          isHovered && 'brightness-110',
                        )}
                        onMouseEnter={() => setHoveredState(uf)}
                        onMouseMove={(e) => {
                          const rect = (
                            e.currentTarget.ownerSVGElement!.parentElement as HTMLElement
                          ).getBoundingClientRect();
                          setHoverPos({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          });
                        }}
                        onClick={() => hasData && handleStateClick(uf)}
                      />
                      {(() => {
                        const SMALL = new Set(['RN', 'PB', 'PE', 'AL', 'SE', 'ES', 'DF', 'RJ']);
                        const isSmall = SMALL.has(uf);
                        if (isSmall && !isHovered) return null;
                        return (
                          <text
                            x={cx}
                            y={cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="pointer-events-none select-none"
                            style={{
                              fontSize: isSmall ? 13 : 14,
                              fontWeight: 800,
                              fill: '#FFFFFF',
                            }}
                          >
                            {uf}
                          </text>
                        );
                      })()}

                    </g>
                  );
                })}
              </svg>

              {/* Tooltip flutuante */}
              {hoveredState && hoverPos && (
                <div
                  className="absolute pointer-events-none z-20 min-w-[200px] rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground"
                  style={{
                    left: Math.min(hoverPos.x + 14, 380),
                    top: Math.max(hoverPos.y - 10, 0),
                  }}
                >
                  <p className="font-semibold text-sm text-foreground">
                    {ESTADOS_NOME[hoveredState]}{' '}
                    <span className="text-muted-foreground font-normal">({hoveredState})</span>
                  </p>
                  {stateData.get(hoveredState) ? (
                    <div className="mt-1.5 space-y-1 text-xs">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Faturamento</span>
                        <span className="mono-value text-foreground">
                          {formatCurrency(stateData.get(hoveredState)!.faturamento)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Pedidos</span>
                        <span className="mono-value text-foreground">
                          {formatNumber(stateData.get(hoveredState)!.pedidos)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Clientes</span>
                        <span className="mono-value text-foreground">
                          {formatNumber(stateData.get(hoveredState)!.clientes)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Sem vendas no período</p>
                  )}
                </div>
              )}

              {/* Legenda */}
              <div className="absolute bottom-2 right-2 rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">
                  Intensidade de vendas
                </p>
                <div className="flex h-2 w-40 overflow-hidden rounded-full">
                  <span className="flex-1 bg-sky-200" />
                  <span className="flex-1 bg-sky-400" />
                  <span className="flex-1 bg-sky-600" />
                  <span className="flex-1 bg-sky-800" />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                  <span>Menor</span>
                  <span>→</span>
                  <span>Maior</span>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="space-y-2">
                {selectedData?.cidades && selectedData.cidades.length > 0 ? (
                  selectedData.cidades.map((cidade, i) => (
                    <div
                      key={cidade.cidade}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                        <div>
                          <p className="font-medium text-sm">{cidade.cidade}</p>
                          <p className="text-xs text-muted-foreground">
                            {cidade.clientes} clientes • {cidade.pedidos} pedidos
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold mono-value text-sm">
                          {formatCurrency(cidade.faturamento)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPercent(
                            (cidade.faturamento / (selectedData.faturamento || 1)) * 100,
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Building2 className="h-12 w-12 mb-2 opacity-50" />
                    <p>Nenhuma cidade com dados</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Divisor vertical */}
      <div className="hidden lg:block w-px bg-border/60" />

      {/* Painel direito */}
      <div className="space-y-4 min-w-0">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">
                {selectedState ? ESTADOS_NOME[selectedState] : 'Brasil · Total'}
              </CardTitle>
              <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-0.5">
                {periodos.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className={cn(
                      'px-2.5 py-0.5 text-[11px] font-medium rounded-full transition-colors',
                      periodo === p
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricRow
              icon={<DollarSign className="h-4 w-4" />}
              iconBg="bg-primary/10 text-primary"
              label="Faturamento"
              value={formatCurrency(selectedData?.faturamento ?? totais.faturamento)}
              trend={trends?.faturamento}
            />
            <MetricRow
              icon={<ShoppingCart className="h-4 w-4" />}
              iconBg="bg-chart-2/10 text-chart-2"
              label="Pedidos"
              value={formatNumber(selectedData?.pedidos ?? totais.pedidos)}
              trend={trends?.pedidos}
            />
            <MetricRow
              icon={<Users className="h-4 w-4" />}
              iconBg="bg-chart-3/10 text-chart-3"
              label="Clientes"
              value={formatNumber(selectedData?.clientes ?? totais.clientes)}
              trend={trends?.clientes}
            />
          </CardContent>
        </Card>

        {!selectedState && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top 5 Estados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {data.slice(0, 5).map((d, i) => (

                    <div
                      key={d.uf}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleStateClick(d.uf)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                            i === 0 && 'bg-cyan-500 text-white',
                            i === 1 && 'bg-cyan-500/80 text-white',
                            i === 2 && 'bg-cyan-500/60 text-white',
                            i > 2 && 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium">{d.uf}</span>
                        <span className="text-xs text-muted-foreground hidden xl:inline">
                          {ESTADOS_NOME[d.uf]}
                        </span>
                      </div>
                      <span className="text-sm mono-value">
                        {formatCurrency(d.faturamento, true)}
                      </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        )}
      </div>
    </div>
  );
}

function MetricRow({
  icon,
  iconBg,
  label,
  value,
  trend,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  trend?: number;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={cn(
            'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
            iconBg,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-bold mono-value text-sm truncate">{value}</p>
          <div className="mt-1">
            <TrendPill value={trend} />
          </div>
        </div>
      </div>
    </div>
  );
}
