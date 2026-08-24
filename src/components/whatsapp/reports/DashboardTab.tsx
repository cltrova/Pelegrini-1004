import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Zap,
  Target,
  Flame,
  ThumbsUp,
  UserCog,
  Heart
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ReportSummary } from '@/hooks/useWhatsappReports';
import { formatNumber, formatPercent } from '@/utils/formatters';

interface DashboardTabProps {
  summary: ReportSummary;
}

export function DashboardTab({ summary }: DashboardTabProps) {
  const { 
    conversationStats, 
    sentimentStats, 
    satisfactionStats,
    serviceQualityStats,
    responseMetrics,
  } = summary;

  // Calculate rates
  const resolutionRate = conversationStats.total > 0 
    ? ((conversationStats.resolved + conversationStats.closed) / conversationStats.total) * 100 
    : 0;

  const totalSentiment = sentimentStats.positive + sentimentStats.neutral + sentimentStats.negative;
  const hotRate = totalSentiment > 0
    ? (sentimentStats.positive / totalSentiment) * 100
    : 0;

  const totalSatisfaction = satisfactionStats.verySatisfied + satisfactionStats.satisfied + satisfactionStats.neutral + satisfactionStats.dissatisfied + satisfactionStats.veryDissatisfied;
  const satisfiedRate = totalSatisfaction > 0
    ? ((satisfactionStats.verySatisfied + satisfactionStats.satisfied) / totalSatisfaction) * 100
    : 0;

  // Sales status data for donut chart
  const salesStatusData = [
    { name: 'Quente', value: sentimentStats.positive || 0, displayValue: sentimentStats.positive, color: '#10b981', icon: '🔥' },
    { name: 'Morno', value: sentimentStats.neutral || 0, displayValue: sentimentStats.neutral, color: '#f59e0b', icon: '⚡' },
    { name: 'Frio', value: sentimentStats.negative || 0, displayValue: sentimentStats.negative, color: '#ef4444', icon: '❄️' },
  ];
  
  const chartData = salesStatusData.map(item => ({
    ...item,
    value: item.value || 0.001
  })).filter(item => item.displayValue > 0 || totalSentiment === 0);

  // Conversation status data
  const totalConversations = conversationStats.active + conversationStats.pending + conversationStats.queue + conversationStats.resolved + conversationStats.closed;
  
  const conversationStatusData = [
    { name: 'Ativas', gradientId: 'Ativas', value: conversationStats.active || 0, displayValue: conversationStats.active, color: '#22c55e', icon: '🟢' },
    { name: 'Pendentes', gradientId: 'Pendentes', value: conversationStats.pending || 0, displayValue: conversationStats.pending, color: '#eab308', icon: '🟡' },
    { name: 'Na fila', gradientId: 'NaFila', value: conversationStats.queue || 0, displayValue: conversationStats.queue, color: '#3b82f6', icon: '🔵' },
    { name: 'Resolvidas', gradientId: 'Resolvidas', value: conversationStats.resolved || 0, displayValue: conversationStats.resolved, color: '#10b981', icon: '✅' },
    { name: 'Fechadas', gradientId: 'Fechadas', value: conversationStats.closed || 0, displayValue: conversationStats.closed, color: '#6b7280', icon: '⚫' },
  ];

  const conversationChartData = conversationStatusData.map(item => ({
    ...item,
    value: item.value || 0.001
  })).filter(item => item.displayValue > 0 || totalConversations === 0);

  // Satisfaction data
  const satisfactionData = [
    { label: 'Muito Satisfeito', value: satisfactionStats.verySatisfied, color: 'bg-emerald-500', percentage: totalSatisfaction > 0 ? (satisfactionStats.verySatisfied / totalSatisfaction) * 100 : 0 },
    { label: 'Satisfeito', value: satisfactionStats.satisfied, color: 'bg-green-500', percentage: totalSatisfaction > 0 ? (satisfactionStats.satisfied / totalSatisfaction) * 100 : 0 },
    { label: 'Neutro', value: satisfactionStats.neutral, color: 'bg-amber-500', percentage: totalSatisfaction > 0 ? (satisfactionStats.neutral / totalSatisfaction) * 100 : 0 },
    { label: 'Insatisfeito', value: satisfactionStats.dissatisfied, color: 'bg-orange-500', percentage: totalSatisfaction > 0 ? (satisfactionStats.dissatisfied / totalSatisfaction) * 100 : 0 },
    { label: 'Muito Insatisfeito', value: satisfactionStats.veryDissatisfied, color: 'bg-red-500', percentage: totalSatisfaction > 0 ? (satisfactionStats.veryDissatisfied / totalSatisfaction) * 100 : 0 },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Charts Section - 2 donut charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Conversation Status - Donut Chart */}
        <Card className="overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-blue-500 to-gray-500" />
          <CardHeader className="pb-2 px-3 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              Status das Conversas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="relative h-[140px] w-[140px] sm:h-[180px] sm:w-[180px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="gradientAtivas" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#4ade80" />
                      </linearGradient>
                      <linearGradient id="gradientPendentes" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#eab308" />
                        <stop offset="100%" stopColor="#facc15" />
                      </linearGradient>
                      <linearGradient id="gradientNaFila" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#60a5fa" />
                      </linearGradient>
                      <linearGradient id="gradientResolvidas" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#34d399" />
                      </linearGradient>
                      <linearGradient id="gradientFechadas" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#6b7280" />
                        <stop offset="100%" stopColor="#9ca3af" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={totalConversations > 0 ? conversationChartData : [{ name: 'Sem dados', value: 1, color: '#374151' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={totalConversations > 0 ? 2 : 0}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {totalConversations > 0 ? (
                        conversationChartData.map((entry, index) => (
                          <Cell 
                            key={`cell-conv-${index}`} 
                            fill={`url(#gradient${entry.gradientId})`}
                            className="drop-shadow-sm"
                          />
                        ))
                      ) : (
                        <Cell fill="#374151" />
                      )}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-bold">{totalConversations}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">total</span>
                </div>
              </div>
              
              <div className="flex-1 w-full grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:gap-2.5">
                {conversationStatusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                      <div 
                        className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 rounded-full shadow-sm flex-shrink-0" 
                        style={{ 
                          background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)` 
                        }} 
                      />
                      <span className="text-xs sm:text-sm text-muted-foreground truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-semibold text-xs sm:text-sm tabular-nums flex-shrink-0" style={{ color: item.color }}>
                      {item.displayValue}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Taxa de Conversão</span>
                <span className={`font-bold text-base sm:text-lg ${resolutionRate >= 70 ? 'text-emerald-500' : resolutionRate >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                  {formatPercent(resolutionRate)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Status - Donut Chart */}
        <Card className="overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" />
          <CardHeader className="pb-2 px-3 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              Status de Venda
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="relative h-[140px] w-[140px] sm:h-[180px] sm:w-[180px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="gradientQuente" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#34d399" />
                      </linearGradient>
                      <linearGradient id="gradientMorno" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#fbbf24" />
                      </linearGradient>
                      <linearGradient id="gradientFrio" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#f87171" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={totalSentiment > 0 ? chartData : [{ name: 'Sem dados', value: 1, color: '#374151' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={totalSentiment > 0 ? 3 : 0}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {totalSentiment > 0 ? (
                        chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`url(#gradient${entry.name})`}
                            className="drop-shadow-sm"
                          />
                        ))
                      ) : (
                        <Cell fill="#374151" />
                      )}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-bold">{totalSentiment}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">leads</span>
                </div>
              </div>
              
              <div className="flex-1 w-full grid grid-cols-3 sm:flex sm:flex-col gap-2 sm:gap-3">
                {salesStatusData.map((item) => (
                  <div key={item.name} className="flex flex-col sm:flex-row items-center sm:justify-between gap-0.5 sm:gap-0">
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                      <div 
                        className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 rounded-full shadow-sm" 
                        style={{ 
                          background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)` 
                        }} 
                      />
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        <span className="hidden sm:inline">{item.icon} </span>{item.name}
                      </span>
                    </div>
                    <span className="font-semibold text-xs sm:text-sm tabular-nums" style={{ color: item.color }}>
                      {item.displayValue}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Taxa Leads Quentes</span>
                <span className={`font-bold text-base sm:text-lg ${hotRate >= 60 ? 'text-emerald-500' : hotRate >= 40 ? 'text-amber-500' : 'text-indigo-500'}`}>
                  {formatPercent(hotRate)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Satisfaction Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Progress Bars */}
        <Card className="overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" />
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
              Satisfação dos Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-3 sm:space-y-4">
              {satisfactionData.map((item) => (
                <div key={item.label} className="space-y-1 sm:space-y-1.5">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground truncate">{item.label}</span>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <span className="text-muted-foreground w-6 sm:w-8 text-right">{item.value}</span>
                      <span className="font-semibold w-12 sm:w-14 text-right">{formatPercent(item.percentage)}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${item.color} transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.max(item.percentage, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="flex flex-col gap-4">
          <Card className="flex-1 hover:shadow-lg transition-shadow">
            <CardContent className="p-5 h-full flex items-center">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Taxa de Satisfeitos</p>
                    <p className="text-xs text-muted-foreground">Muito satisfeitos + Satisfeitos</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-emerald-500">
                  {formatPercent(satisfiedRate)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-center">Qualidade Média</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Speedometer SVG */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="relative">
                    <svg viewBox="0 0 200 120" className="w-32 h-20">
                      <path 
                        d="M 20 100 A 80 80 0 0 1 73 33" 
                        fill="none" 
                        stroke="#ef4444" 
                        strokeWidth="14" 
                        strokeLinecap="round"
                        opacity="0.3"
                      />
                      <path 
                        d="M 73 33 A 80 80 0 0 1 127 33" 
                        fill="none" 
                        stroke="#f59e0b" 
                        strokeWidth="14" 
                        strokeLinecap="round"
                        opacity="0.3"
                      />
                      <path 
                        d="M 127 33 A 80 80 0 0 1 180 100" 
                        fill="none" 
                        stroke="#10b981" 
                        strokeWidth="14" 
                        strokeLinecap="round"
                        opacity="0.3"
                      />
                      
                      {(() => {
                        const value = serviceQualityStats.averageRating;
                        const percentage = Math.min(Math.max(value / 10, 0), 1);
                        const angle = percentage * 180 - 90;
                        const needleLength = 55;
                        const x2 = 100 + needleLength * Math.cos((angle - 90) * Math.PI / 180);
                        const y2 = 100 + needleLength * Math.sin((angle - 90) * Math.PI / 180);
                        const color = value >= 7 ? '#10b981' : value >= 4 ? '#f59e0b' : '#ef4444';
                        
                        return (
                          <>
                            <line 
                              x1="100" 
                              y1="100" 
                              x2={x2} 
                              y2={y2} 
                              stroke={color} 
                              strokeWidth="3" 
                              strokeLinecap="round"
                              className="drop-shadow-md"
                            />
                            <circle cx="100" cy="100" r="6" fill={color} className="drop-shadow-sm" />
                          </>
                        );
                      })()}
                      
                      <text x="15" y="110" fontSize="10" fill="currentColor" className="text-muted-foreground">0</text>
                      <text x="95" y="20" fontSize="10" fill="currentColor" className="text-muted-foreground">5</text>
                      <text x="178" y="110" fontSize="10" fill="currentColor" className="text-muted-foreground">10</text>
                    </svg>
                  </div>
                  
                  <div className="text-center -mt-1">
                    <span className={`text-xl font-bold ${
                      serviceQualityStats.averageRating >= 7 ? 'text-emerald-500' : 
                      serviceQualityStats.averageRating >= 4 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {formatNumber(serviceQualityStats.averageRating, 1)}
                    </span>
                    <span className="text-xs text-muted-foreground">/10</span>
                  </div>
                </div>

                {/* Quality Metrics */}
                <div className="flex-1 space-y-2">
                  {(() => {
                    const { solutionProvidedRate, firstContactResolutionRate, empathyLevel, agentTone } = serviceQualityStats;
                    const totalEmpathy = empathyLevel.high + empathyLevel.medium + empathyLevel.low;
                    const highEmpathyRate = totalEmpathy > 0 ? (empathyLevel.high / totalEmpathy) * 100 : 0;
                    const totalTone = agentTone.professional + agentTone.friendly + agentTone.cold + agentTone.rude;
                    const professionalRate = totalTone > 0 ? (agentTone.professional / totalTone) * 100 : 0;

                    const metrics = [
                      { label: 'Solução fornecida', value: solutionProvidedRate, icon: CheckCircle2 },
                      { label: 'Resolução 1° contato', value: firstContactResolutionRate, icon: Target },
                      { label: 'Empatia alta', value: highEmpathyRate, icon: Heart },
                      { label: 'Tom profissional', value: professionalRate, icon: UserCog },
                    ];

                    return metrics.map((metric) => (
                      <div key={metric.label} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <metric.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{metric.label}</span>
                        </div>
                        <span className="text-sm font-medium">
                          {formatPercent(metric.value)}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Service Quality Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Tempo de Resposta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10">
                <span className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  Rápido
                </span>
                <span className="font-semibold text-emerald-500">{responseMetrics.fast}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10">
                <span className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Moderado
                </span>
                <span className="font-semibold text-amber-500">{responseMetrics.moderate}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/10">
                <span className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Lento
                </span>
                <span className="font-semibold text-red-500">{responseMetrics.slow}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCog className="h-4 w-4 text-purple-500" />
              Tom do Atendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/10">
                <span className="text-sm">👔 Profissional</span>
                <span className="font-semibold text-blue-500">{serviceQualityStats.agentTone.professional}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10">
                <span className="text-sm">😊 Amigável</span>
                <span className="font-semibold text-emerald-500">{serviceQualityStats.agentTone.friendly}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10">
                <span className="text-sm">❄️ Frio</span>
                <span className="font-semibold text-amber-500">{serviceQualityStats.agentTone.cold}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/10">
                <span className="text-sm">😤 Rude</span>
                <span className="font-semibold text-red-500">{serviceQualityStats.agentTone.rude}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
