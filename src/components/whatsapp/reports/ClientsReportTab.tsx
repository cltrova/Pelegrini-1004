import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useWhatsappClientReports, ClientReport, ReportFilters } from '@/hooks/useWhatsappReports';
import { useAnalyzeSentiment } from '@/hooks/useWhatsappData';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { 
  Search, 
  Users, 
  ThumbsUp, 
  ThumbsDown, 
  Meh,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ClientsReportTabProps {
  filters?: ReportFilters;
}

export function ClientsReportTab({ filters }: ClientsReportTabProps) {
  const { data: clients, isLoading } = useWhatsappClientReports(filters);
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const analyzeSentiment = useAnalyzeSentiment();
  const queryClient = useQueryClient();

  if (isLoading) {
    return <LoadingState message="Carregando dados de clientes..." />;
  }

  if (!clients || clients.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="Nenhum cliente encontrado"
        message="Ainda não há clientes com conversas registradas para o período selecionado."
      />
    );
  }

  const filteredClients = clients.filter(client => 
    client.contactName.toLowerCase().includes(search.toLowerCase()) ||
    client.phoneNumber.includes(search)
  );

  const toggleExpanded = (clientId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const handleAnalyze = async (client: ClientReport) => {
    if (!client.latestConversationId) {
      toast.error('Nenhuma conversa encontrada para analisar');
      return;
    }

    setAnalyzingIds(prev => new Set(prev).add(client.contactId));

    try {
      await analyzeSentiment.mutateAsync(client.latestConversationId);
      toast.success('Análise concluída com sucesso!');
      // Invalidate to refresh data
      queryClient.invalidateQueries({ queryKey: ['whatsapp-client-reports'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-report-summary'] });
    } catch (error) {
      toast.error('Erro ao analisar conversa');
      console.error('Analysis error:', error);
    } finally {
      setAnalyzingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(client.contactId);
        return newSet;
      });
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            <ThumbsUp className="h-3 w-3 mr-1" />
            Positivo
          </Badge>
        );
      case 'negative':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
            <ThumbsDown className="h-3 w-3 mr-1" />
            Negativo
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Meh className="h-3 w-3 mr-1" />
            Neutro
          </Badge>
        );
    }
  };

  const getSatisfactionBadge = (level: string) => {
    switch (level) {
      case 'very_satisfied':
        return <Badge className="bg-green-600">Muito Satisfeito</Badge>;
      case 'satisfied':
        return <Badge className="bg-emerald-500">Satisfeito</Badge>;
      case 'dissatisfied':
        return <Badge className="bg-orange-500">Insatisfeito</Badge>;
      case 'very_dissatisfied':
        return <Badge className="bg-red-600">Muito Insatisfeito</Badge>;
      default:
        return <Badge variant="secondary">Neutro</Badge>;
    }
  };

  const getResolutionIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'partially_resolved':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'unresolved':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getResolutionLabel = (status: string) => {
    switch (status) {
      case 'resolved': return 'Resolvido';
      case 'partially_resolved': return 'Parcial';
      case 'unresolved': return 'Não Resolvido';
      default: return 'Pendente';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-base sm:text-lg">Análise por Cliente</span>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-center">Conversas</TableHead>
                  <TableHead>Último Contato</TableHead>
                  <TableHead>Sentimento</TableHead>
                  <TableHead>Satisfação</TableHead>
                  <TableHead>Resolução</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const isExpanded = expandedRows.has(client.contactId);
                  const isAnalyzing = analyzingIds.has(client.contactId);

                  return (
                    <Collapsible key={client.contactId} open={isExpanded} asChild>
                      <>
                        <TableRow className="group">
                          <TableCell className="font-medium">{client.contactName}</TableCell>
                          <TableCell className="text-muted-foreground">{client.phoneNumber}</TableCell>
                          <TableCell className="text-center">{client.conversationsCount}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {client.lastContact 
                              ? format(parseISO(client.lastContact), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : '-'
                            }
                          </TableCell>
                          <TableCell>{getSentimentBadge(client.sentiment)}</TableCell>
                          <TableCell>{getSatisfactionBadge(client.satisfactionLevel)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getResolutionIcon(client.resolutionStatus)}
                              <span className="text-sm">{getResolutionLabel(client.resolutionStatus)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAnalyze(client)}
                                disabled={isAnalyzing || !client.latestConversationId}
                                className="h-8 px-3"
                              >
                                {isAnalyzing ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    Analisando
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                    Avaliar
                                  </>
                                )}
                              </Button>

                              {client.hasAnalysis && client.summary && (
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpanded(client.contactId)}
                                    className="h-8 px-3"
                                  >
                                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                                    Resumo
                                    {isExpanded ? (
                                      <ChevronUp className="h-3.5 w-3.5 ml-1" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5 ml-1" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30 hover:bg-muted/40">
                            <TableCell colSpan={8} className="p-4">
                              <div className="flex items-start gap-3">
                                <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-foreground">Resumo da Análise</p>
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    {client.summary}
                                  </p>
                                  {client.topics.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {client.topics.map((topic, index) => (
                                        <Badge key={index} variant="secondary" className="text-xs">
                                          {topic}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border">
            {filteredClients.map((client) => {
              const isExpanded = expandedRows.has(client.contactId);
              const isAnalyzing = analyzingIds.has(client.contactId);

              return (
                <Collapsible key={client.contactId} open={isExpanded}>
                  <div className="p-3 space-y-3">
                    {/* Header: Name + Phone */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{client.contactName}</p>
                        <p className="text-xs text-muted-foreground">{client.phoneNumber}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {client.lastContact 
                            ? format(parseISO(client.lastContact), "dd/MM", { locale: ptBR })
                            : '-'
                          }
                        </p>
                        <p className="text-xs font-medium">{client.conversationsCount} conv.</p>
                      </div>
                    </div>

                    {/* Status Badges Row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {getSentimentBadge(client.sentiment)}
                      {getSatisfactionBadge(client.satisfactionLevel)}
                      <div className="flex items-center gap-1 text-xs">
                        {getResolutionIcon(client.resolutionStatus)}
                        <span>{getResolutionLabel(client.resolutionStatus)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnalyze(client)}
                        disabled={isAnalyzing || !client.latestConversationId}
                        className="h-8 px-3 flex-1"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Analisando
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                            Avaliar
                          </>
                        )}
                      </Button>

                      {client.hasAnalysis && client.summary && (
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(client.contactId)}
                            className="h-8 px-3"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 ml-1" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 ml-1" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>

                    {/* Expanded Summary */}
                    <CollapsibleContent>
                      <div className="pt-3 border-t border-border mt-3">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <div className="space-y-1 min-w-0">
                            <p className="text-xs font-medium">Resumo</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {client.summary}
                            </p>
                            {client.topics.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {client.topics.map((topic, index) => (
                                  <Badge key={index} variant="secondary" className="text-[10px]">
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
