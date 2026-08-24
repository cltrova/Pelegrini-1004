import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useWhatsappAgentReports, ReportFilters } from '@/hooks/useWhatsappReports';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { UserCheck } from 'lucide-react';
import { formatNumber, formatPercent } from '@/utils/formatters';

interface AgentsReportTabProps {
  filters?: ReportFilters;
}

export function AgentsReportTab({ filters }: AgentsReportTabProps) {
  const { data: agents, isLoading } = useWhatsappAgentReports(filters);

  if (isLoading) {
    return <LoadingState message="Carregando dados de vendedores..." />;
  }

  if (!agents || agents.length === 0) {
    return (
      <EmptyState
        icon={<UserCheck className="h-8 w-8" />}
        title="Nenhum vendedor encontrado"
        message="Ainda não há vendedores com conversas atribuídas para o período selecionado."
      />
    );
  }

  const getQualityColor = (score: number) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 6) return 'text-yellow-500';
    if (score >= 4) return 'text-orange-500';
    return 'text-red-500';
  };

  const getQualityBadge = (score: number) => {
    if (score >= 8) return <Badge className="bg-green-600">Excelente</Badge>;
    if (score >= 6) return <Badge className="bg-yellow-600">Bom</Badge>;
    if (score >= 4) return <Badge className="bg-orange-500">Regular</Badge>;
    if (score > 0) return <Badge className="bg-red-600">Precisa Melhorar</Badge>;
    return <Badge variant="secondary">Sem dados</Badge>;
  };

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="text-base sm:text-lg">Comparativo de Vendedores</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {/* Desktop Table View */}
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center">Atendimentos</TableHead>
                <TableHead className="text-center">Resolvidos</TableHead>
                <TableHead className="text-center">Taxa FCR</TableHead>
                <TableHead className="text-center">Satisfação</TableHead>
                <TableHead className="text-center">Qualidade</TableHead>
                <TableHead className="text-center">Avaliação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.agentId}>
                  <TableCell className="font-medium">{agent.agentName}</TableCell>
                  <TableCell className="text-center">{agent.conversationsHandled}</TableCell>
                  <TableCell className="text-center text-green-500">{agent.resolvedCount}</TableCell>
                  <TableCell className="text-center">{formatPercent(agent.firstContactResolutionRate)}</TableCell>
                  <TableCell className="text-center">
                    <span className={getQualityColor(agent.averageSatisfactionScore)}>
                      {agent.averageSatisfactionScore > 0 ? formatNumber(agent.averageSatisfactionScore, 1) : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={getQualityColor(agent.averageServiceQuality)}>
                      {agent.averageServiceQuality > 0 ? formatNumber(agent.averageServiceQuality, 1) : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {getQualityBadge(agent.averageServiceQuality)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-border">
          {agents.map((agent) => (
            <div key={agent.agentId} className="p-3 space-y-3">
              {/* Header: Name + Badge */}
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{agent.agentName}</p>
                {getQualityBadge(agent.averageServiceQuality)}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-lg font-semibold">{agent.conversationsHandled}</p>
                  <p className="text-[10px] text-muted-foreground">Atendimentos</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-lg font-semibold text-green-500">{agent.resolvedCount}</p>
                  <p className="text-[10px] text-muted-foreground">Resolvidos</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-lg font-semibold">{formatPercent(agent.firstContactResolutionRate)}</p>
                  <p className="text-[10px] text-muted-foreground">FCR</p>
                </div>
              </div>

              {/* Quality Scores */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground text-xs">Satisfação: </span>
                    <span className={getQualityColor(agent.averageSatisfactionScore)}>
                      {agent.averageSatisfactionScore > 0 ? formatNumber(agent.averageSatisfactionScore, 1) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Qualidade: </span>
                    <span className={getQualityColor(agent.averageServiceQuality)}>
                      {agent.averageServiceQuality > 0 ? formatNumber(agent.averageServiceQuality, 1) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
