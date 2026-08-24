import { useMemo, useRef, useCallback } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatters';
import { Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';

interface ChartData {
  name: string;
  valor: number;
  color?: string;
}

interface ResponseChartProps {
  data: ChartData[];
  type: 'bar' | 'pie';
  title?: string;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-2 shadow-lg">
        <p className="text-xs font-medium">{label || payload[0].name}</p>
        <p className="text-sm font-bold text-primary">
          {formatCurrency(Math.abs(payload[0].value))}
        </p>
      </div>
    );
  }
  return null;
};

export function ResponseChart({ data, type, title }: ResponseChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExportPng = useCallback(async () => {
    if (!chartRef.current) return;
    
    try {
      const dataUrl = await toPng(chartRef.current, {
        backgroundColor: '#1a1a2e',
        pixelRatio: 2,
        style: {
          padding: '16px',
        }
      });
      
      // Criar link de download
      const link = document.createElement('a');
      link.download = `grafico-financeiro-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Gráfico exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar gráfico:', error);
      toast.error('Erro ao exportar gráfico');
    }
  }, []);
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      valorAbs: Math.abs(item.valor),
      color: item.color || CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [data]);

  if (type === 'pie') {
    return (
      <Card className="p-4 my-3 bg-card/50 relative group">
        <div className="flex items-center justify-between mb-3">
          {title && <h4 className="text-sm font-medium text-center flex-1">{title}</h4>}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleExportPng}
            title="Exportar como PNG"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
        <div ref={chartRef} className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="valorAbs"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                formatter={(value) => <span className="text-xs">{value}</span>}
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 my-3 bg-card/50 relative group">
      <div className="flex items-center justify-between mb-3">
        {title && <h4 className="text-sm font-medium flex-1">{title}</h4>}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleExportPng}
          title="Exportar como PNG"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <div ref={chartRef} className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              type="number" 
              tickFormatter={(value) => formatCurrency(value, true)}
              className="text-xs"
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={100}
              tick={{ fontSize: 11 }}
              className="text-xs"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="valorAbs" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// Parser para detectar dados de gráfico na resposta da IA
// IMPORTANTE: Só extrai dados que existem nos dados reais do DRE
export function parseChartData(
  content: string, 
  dreData?: any[],
  userAskedForChart: boolean = false
): { 
  hasChart: boolean; 
  chartData: ChartData[]; 
  chartType: 'bar' | 'pie';
  chartTitle: string;
} {
  const result = {
    hasChart: false,
    chartData: [] as ChartData[],
    chartType: 'bar' as 'bar' | 'pie',
    chartTitle: '',
  };

  // Só gera gráfico se o usuário pediu explicitamente
  if (!userAskedForChart) {
    return result;
  }

  // Se não temos dados do DRE, não podemos validar - não mostra gráfico
  if (!dreData || dreData.length === 0) {
    return result;
  }

  // Criar mapa de descrições válidas do DRE (lowercase para comparação)
  const validDreItems = new Map<string, { descricao: string; valor: number }>();
  dreData.forEach((item: any) => {
    if (item.descricao && item.valor) {
      const key = item.descricao.toLowerCase().trim();
      validDreItems.set(key, { descricao: item.descricao, valor: item.valor });
    }
  });

  // Função para verificar se um nome parece frase (não categoria financeira)
  const looksLikeSentence = (name: string): boolean => {
    const invalidPatterns = [
      /^atualmente/i,
      /^não\s+(consigo|posso|tenho)/i,
      /^podemos/i,
      /^vamos/i,
      /^analis/i,
      /^observ/i,
      /^consider/i,
      /^importante/i,
      /^destaca/i,
      /^com\s+base/i,
      /^é\s+/i,
      /^para\s+/i,
      /^aqui\s+/i,
    ];
    return invalidPatterns.some(p => p.test(name));
  };

  // Extrair itens com valores monetários da resposta da IA
  const itemPattern = /^(?:\d+\.\s*)?([^:\n]+?):\s*R\$\s*(-?[\d.,]+)/gm;
  const extractedItems: ChartData[] = [];
  
  let match;
  while ((match = itemPattern.exec(content)) !== null) {
    const rawName = match[1].trim();
    const nameLower = rawName.toLowerCase();
    
    // VALIDAÇÃO 1: Nome não pode ser muito longo (categorias são curtas)
    if (rawName.length > 50) continue;
    
    // VALIDAÇÃO 2: Nome não pode parecer uma frase
    if (looksLikeSentence(rawName)) continue;
    
    // VALIDAÇÃO 3: O nome deve existir nos dados do DRE (ou ser muito similar)
    let isValidDreItem = false;
    let matchedDreItem: { descricao: string; valor: number } | undefined;
    
    for (const [key, value] of validDreItems) {
      // Match exato
      if (key === nameLower) {
        isValidDreItem = true;
        matchedDreItem = value;
        break;
      }
      // Match parcial (nome contém ou é contido)
      if (key.includes(nameLower) || nameLower.includes(key)) {
        isValidDreItem = true;
        matchedDreItem = value;
        break;
      }
    }
    
    // Se não é um item válido do DRE, ignora
    if (!isValidDreItem || !matchedDreItem) continue;
    
    // Limpar e converter o valor
    let valueStr = match[2].replace(/\./g, '').replace(',', '.');
    const value = parseFloat(valueStr);
    
    if (!isNaN(value) && Math.abs(value) > 0) {
      // Ignorar itens genéricos como "Receitas Totais", "Custos Totais", etc.
      const isGeneric = /^(receitas?|custos?|despesas?|resultado)\s*(totais?|líquido)?$/i.test(rawName);
      const isSubcategory = /subcategor|resto|outros?$/i.test(rawName);
      
      if (!isGeneric && !isSubcategory && rawName.length > 3) {
        extractedItems.push({
          name: rawName.length > 25 ? rawName.substring(0, 22) + '...' : rawName,
          valor: value,
        });
      }
    }
  }

  // VALIDAÇÃO FINAL: Precisa de pelo menos 2 itens válidos
  if (extractedItems.length < 2) {
    return result;
  }

  // Ordenar por valor absoluto e pegar os top items
  const sortedItems = extractedItems
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
    .slice(0, 6);
  
  result.hasChart = true;
  result.chartData = sortedItems;
  
  // Detectar contexto para título
  const contentLower = content.toLowerCase();
  if (contentLower.includes('despesas operacionais') || contentLower.includes('despesas com')) {
    result.chartTitle = 'Despesas Operacionais';
    result.chartType = 'pie';
  } else if (contentLower.includes('custos')) {
    result.chartTitle = 'Composição de Custos';
    result.chartType = 'bar';
  } else if (contentLower.includes('receitas')) {
    result.chartTitle = 'Composição de Receitas';
    result.chartType = 'bar';
  } else {
    result.chartTitle = 'Análise Financeira';
    result.chartType = 'bar';
  }
  
  return result;
}

// Função para detectar se o usuário pediu um gráfico na conversa
export function userRequestedChart(messages: Array<{ role: string; content: string }>): boolean {
  // Pegar as últimas mensagens do usuário para verificar se pediu gráfico
  const recentUserMessages = messages
    .filter(m => m.role === 'user')
    .slice(-3) // Últimas 3 mensagens do usuário
    .map(m => m.content.toLowerCase());
  
  const chartKeywords = [
    'gráfico',
    'grafico',
    'chart',
    'visualizar',
    'visualize',
    'mostrar em gráfico',
    'mostrar no gráfico',
    'ver em gráfico',
    'desenhar',
    'plotar',
    'gerar gráfico',
    'criar gráfico',
    'exibir gráfico',
    'fazer um gráfico',
    'um gráfico',
    'rosca',
    'pizza',
    'barras',
  ];
  
  return recentUserMessages.some(msg => 
    chartKeywords.some(keyword => msg.includes(keyword))
  );
}
