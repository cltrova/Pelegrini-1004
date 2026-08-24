import { Card, CardContent } from '@/components/ui/card';
import { 
  MessageSquare, 
  Users, 
  UserCheck, 
  Target,
  Brain
} from 'lucide-react';
import { ReportSummary } from '@/hooks/useWhatsappReports';
import { formatNumber, formatPercent } from '@/utils/formatters';

interface KPICardsProps {
  summary: ReportSummary;
}

export function KPICards({ summary }: KPICardsProps) {
  const { 
    conversationStats, 
    totalClients,
    totalAgents,
    analyzedConversations,
    resolutionStats,
  } = summary;

  // Calculate resolution rate based on AI analysis (resolution_status) not conversation status
  const totalAnalyzed = resolutionStats.resolved + resolutionStats.partiallyResolved + 
                        resolutionStats.unresolved + resolutionStats.pending;
  const resolutionRate = totalAnalyzed > 0 
    ? ((resolutionStats.resolved + resolutionStats.partiallyResolved) / totalAnalyzed) * 100 
    : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:shadow-lg transition-shadow">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-primary/20">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Total Conversas</p>
              <p className="text-lg sm:text-xl font-bold">{formatNumber(conversationStats.total, 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:shadow-lg transition-shadow">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-blue-500/20">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Clientes Únicos</p>
              <p className="text-lg sm:text-xl font-bold">{formatNumber(totalClients, 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 hover:shadow-lg transition-shadow">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-purple-500/20">
              <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Vendedores Ativos</p>
              <p className="text-lg sm:text-xl font-bold">{formatNumber(totalAgents, 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`bg-gradient-to-br hover:shadow-lg transition-shadow ${
        resolutionRate >= 70 
          ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20' 
          : resolutionRate >= 40 
            ? 'from-amber-500/10 to-amber-500/5 border-amber-500/20'
            : 'from-red-500/10 to-red-500/5 border-red-500/20'
      }`}>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${
              resolutionRate >= 70 ? 'bg-emerald-500/20' : resolutionRate >= 40 ? 'bg-amber-500/20' : 'bg-red-500/20'
            }`}>
              <Target className={`h-4 w-4 sm:h-5 sm:w-5 ${
                resolutionRate >= 70 ? 'text-emerald-500' : resolutionRate >= 40 ? 'text-amber-500' : 'text-red-500'
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Taxa Resolução</p>
              <p className={`text-lg sm:text-xl font-bold ${
                resolutionRate >= 70 ? 'text-emerald-500' : resolutionRate >= 40 ? 'text-amber-500' : 'text-red-500'
              }`}>{formatPercent(resolutionRate)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:shadow-lg transition-shadow col-span-2 sm:col-span-1">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-500/20">
              <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Analisadas IA</p>
              <p className="text-lg sm:text-xl font-bold">{formatNumber(analyzedConversations, 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
