import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EstoqueRecord } from '@/types/estoque';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface Props {
  data: EstoqueRecord[];
}

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

export function EstoqueCharts({ data }: Props) {
  const valorPorEmpresa = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(r => map.set(r.empresa, (map.get(r.empresa) || 0) + r.valor_estoque));
    return [...map.entries()]
      .map(([name, value]) => ({ name: name.replace(/^CASPPER\s*/i, ''), value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const curvaABC = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(r => map.set(r.classe_abc, (map.get(r.classe_abc) || 0) + 1));
    return [...map.entries()]
      .map(([name, value]) => ({ name: `Curva ${name}`, value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const qtdPorMarca = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(r => map.set(r.marca, (map.get(r.marca) || 0) + r.quantidade_estoque));
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  const valorPorGrupo = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(r => map.set(r.grupo, (map.get(r.grupo) || 0) + r.valor_estoque));
    return [...map.entries()]
      .map(([name, value]) => ({ name: name.length > 30 ? name.substring(0, 30) + '...' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Valor por Empresa */}
      <Card className="premium-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Valor de Estoque por Filial</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={valorPorEmpresa} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Curva ABC */}
      <Card className="premium-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Distribuição por Curva ABC</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={curvaABC}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {curvaABC.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Qtd por Marca - Top 10 */}
      <Card className="premium-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Quantidade em Estoque por Marca (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={qtdPorMarca} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Valor por Grupo - Top 10 */}
      <Card className="premium-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Valor de Estoque por Grupo (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={valorPorGrupo} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
