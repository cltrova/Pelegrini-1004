import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { FluxoCaixaGrupo } from '@/types/variacao';
import { formatCurrency } from '@/utils/formatters';

interface VariacaoChartProps {
  data: FluxoCaixaGrupo[];
  ano: string;
}

export function VariacaoChart({ data, ano }: VariacaoChartProps) {
  // Preparar dados para o gráfico de barras
  const chartData = data.slice(0, 10).map((grupo) => ({
    name: grupo.grupo.length > 30 ? grupo.grupo.substring(0, 30) + '...' : grupo.grupo,
    fullName: grupo.grupo,
    saldoInicial: grupo.saldoInicial,
    saldoFinal: grupo.saldoFinal,
    variacao: grupo.valorVariacao,
  }));

  // Dados para gráfico de variação
  const variacaoData = data.slice(0, 12).map((grupo) => ({
    name: grupo.grupo.length > 25 ? grupo.grupo.substring(0, 25) + '...' : grupo.grupo,
    fullName: grupo.grupo,
    variacao: grupo.valorVariacao,
    isPositive: grupo.valorVariacao >= 0,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Comparativo Saldo Inicial vs Final */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-4">Saldo Inicial vs Final - Top 10 Grupos ({ano})</h4>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              type="number"
              tickFormatter={(v) => formatCurrency(v, false).replace('R$', '')}
              className="text-xs"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => {
                const item = chartData.find(d => d.name === label);
                return item?.fullName || label;
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar
              dataKey="saldoInicial"
              name="Saldo Inicial"
              fill="hsl(var(--muted-foreground))"
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="saldoFinal"
              name="Saldo Final"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Variações por Grupo */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-4">Variação por Grupo ({ano})</h4>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={variacaoData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              type="number"
              tickFormatter={(v) => formatCurrency(v, false).replace('R$', '')}
              className="text-xs"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value, true)}
              labelFormatter={(label) => {
                const item = variacaoData.find(d => d.name === label);
                return item?.fullName || label;
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="variacao" name="Variação" radius={[0, 4, 4, 0]}>
              {variacaoData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isPositive ? '#10b981' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
