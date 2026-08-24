import { useState } from 'react';
import { 
  ArrowLeft, 
  X, 
  ChevronDown,
  Smile,
  Frown,
  Meh,
  RefreshCw,
  Pin,
  Plus,
  Trash2,
  Loader2,
  Star,
  ThumbsUp,
  ThumbsDown,
  Clock,
  MessageSquare,
  Target,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useWhatsappConversation, useWhatsappNotes, useAddNote, useAnalyzeSentiment } from '@/hooks/useWhatsappData';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConversationAnalysisResult } from '@/types/whatsapp';

interface ChatDetailsProps {
  conversationId: string;
  onBack?: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export function ChatDetails({ conversationId, onBack, onClose, isMobile }: ChatDetailsProps) {
  const [newNote, setNewNote] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    report: true,
    sentiment: true,
    quality: false,
    metrics: false,
    context: false,
    topics: true,
    notes: true,
  });
  const [analysisResult, setAnalysisResult] = useState<ConversationAnalysisResult | null>(null);
  
  const { toast } = useToast();
  const { data: conversation, isLoading: isLoadingConversation } = useWhatsappConversation(conversationId);
  const { data: notes, isLoading: isLoadingNotes } = useWhatsappNotes(conversationId);
  const addNote = useAddNote();
  const analyzeSentiment = useAnalyzeSentiment();
  
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      await addNote.mutateAsync({
        conversationId,
        content: newNote.trim()
      });
      setNewNote('');
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleAnalyzeSentiment = async () => {
    try {
      const result = await analyzeSentiment.mutateAsync(conversationId);
      setAnalysisResult(result);
      // Open all report sections
      setOpenSections(prev => ({
        ...prev,
        report: true,
        sentiment: true,
        quality: true,
        metrics: true,
        context: true,
      }));
      toast({
        title: 'Relatório gerado com sucesso!',
        description: result.summary || `${result.messagesAnalyzed} mensagens analisadas`,
      });
    } catch (error) {
      console.error('Failed to analyze sentiment:', error);
      toast({
        title: 'Erro na análise',
        description: 'Não foi possível gerar o relatório. Tente novamente.',
        variant: 'destructive',
      });
    }
  };
  
  const contact = conversation?.contact;
  const name = contact?.name || contact?.push_name || contact?.phone_number || 'Desconhecido';

  // Use analysis result if available, otherwise use conversation data
  const sentiment = analysisResult?.sentiment || conversation?.sentiment;
  const confidence = analysisResult?.confidence || conversation?.sentiment_score;
  const topics = analysisResult?.topics || conversation?.topics;
  
  const SentimentIcon = () => {
    switch (sentiment) {
      case 'positive':
        return <Smile className="h-5 w-5 text-green-500" />;
      case 'negative':
        return <Frown className="h-5 w-5 text-red-500" />;
      default:
        return <Meh className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getSentimentLabel = (s?: string) => {
    switch (s) {
      case 'positive': return 'Positivo';
      case 'negative': return 'Negativo';
      case 'neutral': return 'Neutro';
      default: return 'Não analisado';
    }
  };

  const getSatisfactionLabel = (level?: string) => {
    switch (level) {
      case 'very_satisfied': return 'Muito Satisfeito';
      case 'satisfied': return 'Satisfeito';
      case 'neutral': return 'Neutro';
      case 'dissatisfied': return 'Insatisfeito';
      case 'very_dissatisfied': return 'Muito Insatisfeito';
      default: return 'Não avaliado';
    }
  };

  const getSatisfactionColor = (level?: string) => {
    switch (level) {
      case 'very_satisfied': return 'text-green-600';
      case 'satisfied': return 'text-green-500';
      case 'neutral': return 'text-yellow-500';
      case 'dissatisfied': return 'text-orange-500';
      case 'very_dissatisfied': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getEvolutionIcon = (evolution?: string) => {
    switch (evolution) {
      case 'improved': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'worsened': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEvolutionLabel = (evolution?: string) => {
    switch (evolution) {
      case 'improved': return 'Melhorou';
      case 'worsened': return 'Piorou';
      default: return 'Estável';
    }
  };

  const getToneLabel = (tone?: string) => {
    switch (tone) {
      case 'professional': return 'Profissional';
      case 'friendly': return 'Amigável';
      case 'cold': return 'Frio';
      case 'rude': return 'Rude';
      default: return '-';
    }
  };

  const getEmpathyLabel = (empathy?: string) => {
    switch (empathy) {
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return '-';
    }
  };

  const getResponseTimeLabel = (time?: string) => {
    switch (time) {
      case 'fast': return 'Rápido';
      case 'moderate': return 'Moderado';
      case 'slow': return 'Lento';
      default: return '-';
    }
  };

  const getConversationTypeLabel = (type?: string) => {
    switch (type) {
      case 'support': return 'Suporte';
      case 'sales': return 'Vendas';
      case 'complaint': return 'Reclamação';
      case 'inquiry': return 'Consulta';
      case 'feedback': return 'Feedback';
      case 'other': return 'Outro';
      default: return '-';
    }
  };

  const getUrgencyBadge = (urgency?: string) => {
    switch (urgency) {
      case 'high': return <Badge variant="destructive" className="text-xs">Alta</Badge>;
      case 'medium': return <Badge variant="secondary" className="text-xs">Média</Badge>;
      case 'low': return <Badge variant="outline" className="text-xs">Baixa</Badge>;
      default: return null;
    }
  };

  const getResolutionIcon = (status?: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partially_resolved': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unresolved': return <X className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getResolutionLabel = (status?: string) => {
    switch (status) {
      case 'resolved': return 'Resolvido';
      case 'partially_resolved': return 'Parcialmente';
      case 'unresolved': return 'Não Resolvido';
      case 'pending': return 'Pendente';
      default: return '-';
    }
  };

  const hasAnalysis = analysisResult !== null;
  
  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        {isMobile && onBack ? (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : null}
        
        <h3 className="font-semibold">Detalhes</h3>
        
        {!isMobile && onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Contact info */}
          {isLoadingConversation ? (
            <div className="text-center space-y-2">
              <Skeleton className="h-16 w-16 rounded-full mx-auto" />
              <Skeleton className="h-5 w-32 mx-auto" />
              <Skeleton className="h-4 w-24 mx-auto" />
            </div>
          ) : (
            <div className="text-center pb-4 border-b border-border">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl text-white font-semibold">
                  {name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <h4 className="font-semibold text-lg">{name}</h4>
              <p className="text-sm text-muted-foreground">{contact?.phone_number}</p>
            </div>
          )}

          {/* Generate Report Button */}
          <Button 
            className="w-full gap-2"
            onClick={handleAnalyzeSentiment}
            disabled={analyzeSentiment.isPending}
          >
            {analyzeSentiment.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {analyzeSentiment.isPending ? 'Gerando Relatório...' : 'Gerar Relatório Completo'}
          </Button>

          {/* Summary */}
          {analysisResult?.summary && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium mb-1">Resumo</p>
              <p className="text-sm text-muted-foreground">{analysisResult.summary}</p>
            </div>
          )}

          {/* Satisfaction Score */}
          {hasAnalysis && analysisResult?.satisfactionScore && (
            <Collapsible open={openSections.report} onOpenChange={() => toggleSection('report')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0 h-auto py-2">
                  <span className="font-medium flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    Satisfação do Cliente
                  </span>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    openSections.report && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="py-3 px-4 rounded-lg bg-muted/50 space-y-4">
                  {/* Score visual */}
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-1">
                      {analysisResult.satisfactionScore}<span className="text-lg text-muted-foreground">/10</span>
                    </div>
                    <p className={cn("font-medium", getSatisfactionColor(analysisResult.satisfactionLevel))}>
                      {getSatisfactionLabel(analysisResult.satisfactionLevel)}
                    </p>
                  </div>
                  
                  {/* Progress bar */}
                  <Progress value={analysisResult.satisfactionScore * 10} className="h-2" />

                  {/* Indicators */}
                  {analysisResult.satisfactionIndicators?.length ? (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-2">Indicadores:</p>
                      <div className="flex flex-wrap gap-1">
                        {analysisResult.satisfactionIndicators.map((indicator, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {indicator}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {/* Sentiment Section */}
          <Collapsible open={openSections.sentiment} onOpenChange={() => toggleSection('sentiment')}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-0 h-auto py-2">
                <span className="font-medium">Sentimento</span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  openSections.sentiment && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="py-3 px-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SentimentIcon />
                    <div>
                      <p className="font-medium">{getSentimentLabel(sentiment)}</p>
                      {confidence && (
                        <p className="text-xs text-muted-foreground">
                          Confiança: {Math.round(Number(confidence) * 100)}%
                        </p>
                      )}
                    </div>
                  </div>
                  {hasAnalysis && (
                    <div className="flex items-center gap-1 text-xs">
                      {getEvolutionIcon(analysisResult?.sentimentEvolution)}
                      <span className="text-muted-foreground">
                        {getEvolutionLabel(analysisResult?.sentimentEvolution)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Service Quality Section */}
          {hasAnalysis && (
            <Collapsible open={openSections.quality} onOpenChange={() => toggleSection('quality')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0 h-auto py-2">
                  <span className="font-medium flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4" />
                    Qualidade do Atendimento
                  </span>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    openSections.quality && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="py-3 px-4 rounded-lg bg-muted/50 space-y-3">
                  {/* Rating */}
                  {analysisResult?.serviceQualityRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Avaliação</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{analysisResult.serviceQualityRating}/10</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Tone */}
                  <div className="flex items-center justify-between text-sm">
                    <span>Tom do Atendente</span>
                    <span className="font-medium">{getToneLabel(analysisResult?.agentTone)}</span>
                  </div>

                  {/* Empathy */}
                  <div className="flex items-center justify-between text-sm">
                    <span>Empatia</span>
                    <span className="font-medium">{getEmpathyLabel(analysisResult?.empathyLevel)}</span>
                  </div>

                  {/* Solution provided */}
                  <div className="flex items-center justify-between text-sm">
                    <span>Solução Oferecida</span>
                    {analysisResult?.solutionProvided ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </div>

                  {/* First contact resolution */}
                  <div className="flex items-center justify-between text-sm">
                    <span>Resolução 1º Contato</span>
                    {analysisResult?.firstContactResolution ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Response Metrics Section */}
          {hasAnalysis && (
            <Collapsible open={openSections.metrics} onOpenChange={() => toggleSection('metrics')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0 h-auto py-2">
                  <span className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Métricas de Resposta
                  </span>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    openSections.metrics && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="py-3 px-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Tempo de Resposta</span>
                    <Badge variant={
                      analysisResult?.responseTimeEstimate === 'fast' ? 'default' :
                      analysisResult?.responseTimeEstimate === 'slow' ? 'destructive' : 'secondary'
                    } className="text-xs">
                      {getResponseTimeLabel(analysisResult?.responseTimeEstimate)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span>Fluxo da Conversa</span>
                    <span className="font-medium">
                      {analysisResult?.conversationFlow === 'smooth' ? 'Fluido' :
                       analysisResult?.conversationFlow === 'interrupted' ? 'Interrompido' :
                       analysisResult?.conversationFlow === 'confusing' ? 'Confuso' : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span>Clareza das Mensagens</span>
                    <span className="font-medium">
                      {analysisResult?.messageClarity === 'clear' ? 'Clara' :
                       analysisResult?.messageClarity === 'moderate' ? 'Moderada' :
                       analysisResult?.messageClarity === 'unclear' ? 'Confusa' : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span>Mensagens Analisadas</span>
                    <Badge variant="outline" className="text-xs">
                      {analysisResult?.messagesAnalyzed || 0}
                    </Badge>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Context Section */}
          {hasAnalysis && (
            <Collapsible open={openSections.context} onOpenChange={() => toggleSection('context')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0 h-auto py-2">
                  <span className="font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Contexto
                  </span>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    openSections.context && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="py-3 px-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Tipo</span>
                    <Badge className="text-xs">
                      {getConversationTypeLabel(analysisResult?.conversationType)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span>Urgência</span>
                    {getUrgencyBadge(analysisResult?.urgencyLevel)}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span>Complexidade</span>
                    <span className="font-medium">
                      {analysisResult?.complexity === 'simple' ? 'Simples' :
                       analysisResult?.complexity === 'moderate' ? 'Moderada' :
                       analysisResult?.complexity === 'complex' ? 'Complexa' : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span>Status</span>
                    <div className="flex items-center gap-1">
                      {getResolutionIcon(analysisResult?.resolutionStatus)}
                      <span className="font-medium">
                        {getResolutionLabel(analysisResult?.resolutionStatus)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Intent */}
                  {analysisResult?.customerIntent && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">Intenção do Cliente:</p>
                      <p className="text-sm">{analysisResult.customerIntent}</p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Key Moments */}
          {hasAnalysis && analysisResult?.keyMoments?.length ? (
            <div className="py-3 px-4 rounded-lg bg-muted/50 space-y-2">
              <p className="font-medium text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Momentos-Chave
              </p>
              <div className="space-y-2">
                {analysisResult.keyMoments.map((moment, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {moment.type === 'positive' ? (
                      <ThumbsUp className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <ThumbsDown className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="text-muted-foreground">{moment.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Recommendations */}
          {hasAnalysis && analysisResult?.recommendations?.length ? (
            <div className="py-3 px-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
              <p className="font-medium text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Lightbulb className="h-4 w-4" />
                Recomendações
              </p>
              <ul className="space-y-1">
                {analysisResult.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          
          {/* Topics Section */}
          <Collapsible open={openSections.topics} onOpenChange={() => toggleSection('topics')}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-0 h-auto py-2">
                <span className="font-medium">Tópicos</span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  openSections.topics && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="py-3 space-y-2">
                {topics?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {topics.map((topic, i) => (
                      <Badge 
                        key={i} 
                        variant={i === 0 ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {topic}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum tópico identificado
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Notes Section */}
          <Collapsible open={openSections.notes} onOpenChange={() => toggleSection('notes')}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-0 h-auto py-2">
                <span className="font-medium">Notas</span>
                <div className="flex items-center gap-2">
                  {notes?.length ? (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {notes.length}
                    </Badge>
                  ) : null}
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    openSections.notes && "rotate-180"
                  )} />
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="py-3 space-y-3">
                {/* Add note form */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Adicionar uma nota..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[80px] text-sm"
                  />
                  <Button 
                    size="sm" 
                    className="w-full gap-2"
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addNote.isPending}
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar nota
                  </Button>
                </div>
                
                {/* Notes list */}
                {isLoadingNotes ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : notes?.length ? (
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div 
                        key={note.id} 
                        className={cn(
                          "p-3 rounded-lg bg-muted/50 text-sm",
                          note.is_pinned && "border border-primary/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {note.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                            <span>{note.author?.nome || 'Usuário'}</span>
                            <span>•</span>
                            <span>
                              {format(new Date(note.created_at), "d MMM, HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma nota adicionada
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
