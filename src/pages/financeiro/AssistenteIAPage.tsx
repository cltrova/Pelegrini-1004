import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Header } from '@/components/layout/Header';
import { MobileHeader, MobilePageContainer } from '@/components/layout/MobileHeader';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDreData, extractFilterOptions, calculateIndicators, calculateGroupSummary, filterDreData } from '@/hooks/useDreData';
import { useVariacaoData } from '@/hooks/useVariacaoData';
import { formatCurrency } from '@/utils/formatters';
import { toast } from 'sonner';
import { ResponseChart, parseChartData, userRequestedChart } from '@/components/assistente/ResponseChart';
import {
  Send,
  Bot,
  User,
  Sparkles,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Lightbulb,
  BarChart3,
  ArrowLeftRight,
  Loader2,
  RefreshCw,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  dataContext?: {
    type: 'dre' | 'variacao' | 'comparativo';
    highlight?: string;
  };
}

interface SuggestedQuestion {
  category: 'analise' | 'comparativo' | 'detalhamento' | 'tendencia';
  icon: React.ReactNode;
  question: string;
  description: string;
}

const suggestedQuestions: SuggestedQuestion[] = [
  {
    category: 'analise',
    icon: <BarChart3 className="h-4 w-4" />,
    question: "Qual foi o resultado líquido do exercício em 2025?",
    description: "Análise do resultado final"
  },
  {
    category: 'comparativo',
    icon: <ArrowLeftRight className="h-4 w-4" />,
    question: "Compare os custos entre janeiro e fevereiro de 2025",
    description: "Comparativo mensal"
  },
  {
    category: 'detalhamento',
    icon: <Target className="h-4 w-4" />,
    question: "Me explique a composição do Resultado Líquido Ajustado na variação",
    description: "Detalhamento de cálculos"
  },
  {
    category: 'tendencia',
    icon: <TrendingUp className="h-4 w-4" />,
    question: "Identifique onde está meu maior aumento de custo nos últimos meses",
    description: "Análise de tendência"
  },
  {
    category: 'analise',
    icon: <AlertTriangle className="h-4 w-4" />,
    question: "Quais contas tiveram maior variação negativa?",
    description: "Pontos de atenção"
  },
  {
    category: 'detalhamento',
    icon: <HelpCircle className="h-4 w-4" />,
    question: "Como é calculada a coluna de variação percentual na DFC?",
    description: "Entendimento de fórmulas"
  },
];

const categoryColors: Record<string, string> = {
  analise: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  comparativo: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  detalhamento: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  tendencia: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const categoryLabels: Record<string, string> = {
  analise: 'Análise',
  comparativo: 'Comparativo',
  detalhamento: 'Detalhamento',
  tendencia: 'Tendência',
};

// Função para streaming do chat com a Edge Function
async function streamChat({
  messages,
  dreData,
  variacaoData,
  onDelta,
  onDone,
  onError,
}: {
  messages: Array<{ role: string; content: string }>;
  dreData: any[];
  variacaoData: any[];
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  const supabaseUrl = "https://jegjihccrjqakqdodcrj.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZ2ppaGNjcmpxYWtxZG9kY3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NzIwOTcsImV4cCI6MjA4MzM0ODA5N30.CeZN5HoBEk65AC8avP4jWukboE9fSpWuUJOymUrTres";
  const CHAT_URL = `${supabaseUrl}/functions/v1/assistente-financeiro`;
  
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ messages, dreData, variacaoData }),
    });

    if (resp.status === 429) {
      onError("Limite de requisições excedido. Aguarde um momento.");
      return;
    }
    
    if (resp.status === 402) {
      onError("Créditos esgotados. Por favor, adicione créditos à sua conta.");
      return;
    }

    if (!resp.ok || !resp.body) {
      const errorData = await resp.json().catch(() => ({ error: "Erro ao conectar com o assistente" }));
      onError(errorData.error || "Erro ao conectar com o assistente");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (error) {
    console.error("Stream error:", error);
    onError("Erro de conexão. Tente novamente.");
  }
}

// Componente de mensagem (fora do componente principal para evitar re-renders)
const MessageBubble = ({ 
  message, 
  onCopy, 
  onSendMessage,
  dreData,
  allMessages
}: { 
  message: Message; 
  onCopy: (content: string) => void;
  onSendMessage: (content: string) => void;
  dreData?: any[];
  allMessages?: Array<{ role: string; content: string }>;
}) => {
  // Parse chart data from assistant responses - só se o usuário pediu gráfico
  const chartInfo = useMemo(() => {
    if (message.role !== 'assistant' || !message.content) {
      return { hasChart: false, chartData: [], chartType: 'bar' as const, chartTitle: '' };
    }
    
    // Verifica se o usuário pediu um gráfico nas mensagens recentes
    const askedForChart = allMessages ? userRequestedChart(allMessages) : false;
    
    return parseChartData(message.content, dreData, askedForChart);
  }, [message.content, message.role, dreData, allMessages]);

  return (
    <div
      className={cn(
        'flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
          message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
        )}
      >
        {message.role === 'user' ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>
      <div
        className={cn(
          'flex flex-col max-w-[85%] gap-1',
          message.role === 'user' ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed',
            message.role === 'user'
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted rounded-bl-sm prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
          )}
        >
          {message.role === 'user' ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                h1: ({ children }) => <h3 className="font-bold text-base mt-3 mb-1">{children}</h3>,
                h2: ({ children }) => <h3 className="font-bold text-base mt-3 mb-1">{children}</h3>,
                h3: ({ children }) => <h4 className="font-semibold text-sm mt-2 mb-1">{children}</h4>,
                h4: ({ children }) => <h5 className="font-semibold text-sm mt-2 mb-1">{children}</h5>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        
        {/* Renderizar gráfico se houver dados */}
        {message.role === 'assistant' && chartInfo.hasChart && (
          <div className="w-full mt-2">
            <ResponseChart 
              data={chartInfo.chartData} 
              type={chartInfo.chartType} 
              title={chartInfo.chartTitle}
            />
          </div>
        )}
        
        {message.role === 'assistant' && (
          <div className="flex items-center gap-1 mt-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-50 hover:opacity-100"
              onClick={() => onCopy(message.content)}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-50 hover:opacity-100"
            >
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-50 hover:opacity-100"
            >
              <ThumbsDown className="h-3 w-3" />
            </Button>
          </div>
        )}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onSendMessage(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function AssistenteIAPage() {
  // O assistente não possui filtros próprios: libera a carga de dados do módulo Financeiro
  const { markSearched } = useFinanceiroSearch();
  useEffect(() => { markSearched(); }, [markSearched]);

  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: dreData } = useDreData();
  const { data: variacaoData } = useVariacaoData();

  // Filtrar dados para o ano mais recente (mesmo padrão do dashboard)
  const filteredDreData = useMemo(() => {
    if (!dreData || dreData.length === 0) return [];
    
    // Extrair ano mais recente disponível
    const anos = [...new Set(dreData.map(r => r.ano_mes?.substring(0, 4)))].filter(Boolean).sort().reverse();
    const anoMaisRecente = anos[0];
    
    if (!anoMaisRecente) return dreData;
    
    return filterDreData(dreData, { anos: [anoMaisRecente] });
  }, [dreData]);

  // Usar dados FILTRADOS para indicadores (igual ao dashboard)
  const dreIndicators = useMemo(() => {
    if (!filteredDreData || filteredDreData.length === 0) return [];
    return calculateIndicators(filteredDreData);
  }, [filteredDreData]);

  const filteredSuggestions = activeCategory
    ? suggestedQuestions.filter(q => q.category === activeCategory)
    : suggestedQuestions;

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Preparar mensagens para a API (sem campos extras)
    const apiMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content
    }));

    let assistantContent = "";
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    // Adicionar mensagem vazia do assistente
    setMessages(prev => [...prev, assistantMessage]);

    await streamChat({
      messages: apiMessages,
      dreData: filteredDreData || [],  // Enviar dados já filtrados
      variacaoData: variacaoData || [],
      onDelta: (chunk) => {
        assistantContent += chunk;
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessage.id 
              ? { ...m, content: assistantContent }
              : m
          )
        );
      },
      onDone: () => {
        setIsLoading(false);
      },
      onError: (error) => {
        toast.error(error);
        setIsLoading(false);
        // Remover mensagem vazia do assistente
        setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
      }
    });
  };

  const handleSuggestionClick = (question: string) => {
    handleSendMessage(question);
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const clearChat = () => {
    setMessages([]);
  };


  // Estado inicial / Welcome
  const WelcomeState = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
      <div className="relative">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
          <Bot className="h-10 w-10 text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-background">
          <Zap className="h-3 w-3 text-white" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Assistente Financeiro</h2>
        <p className="text-muted-foreground max-w-md">
          Olá! Sou seu assistente especializado em análise de DRE e Variação (DFC). 
          Posso ajudar a interpretar dados, explicar cálculos e identificar tendências.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        <Card className="p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <div className="flex items-center gap-2 text-blue-500">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">DRE</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {dreData?.length || 0} registros disponíveis
          </p>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <div className="flex items-center gap-2 text-purple-500">
            <ArrowLeftRight className="h-4 w-4" />
            <span className="text-sm font-medium">Variação</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {variacaoData?.length || 0} registros disponíveis
          </p>
        </Card>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap justify-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer transition-all",
            !activeCategory && "bg-primary/10 border-primary"
          )}
          onClick={() => setActiveCategory(null)}
        >
          Todas
        </Badge>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <Badge
            key={key}
            variant="outline"
            className={cn(
              "cursor-pointer transition-all",
              activeCategory === key
                ? categoryColors[key]
                : "hover:bg-muted"
            )}
            onClick={() => setActiveCategory(activeCategory === key ? null : key)}
          >
            {label}
          </Badge>
        ))}
      </div>

      {/* Suggested questions */}
      <div className="grid gap-2 w-full max-w-lg">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Sugestões para começar:
        </p>
        <div className="grid gap-2">
          {filteredSuggestions.slice(0, 4).map((item, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(item.question)}
              className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-accent hover:border-accent transition-all text-left group"
            >
              <div className={cn(
                "flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center",
                categoryColors[item.category]
              )}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium group-hover:text-primary transition-colors">
                  {item.question}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Render do input de chat inline
  const renderChatInput = () => (
    <div className="border-t border-border bg-background/95 backdrop-blur p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputValue);
        }}
        className="flex gap-2 max-w-3xl mx-auto"
      >
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Pergunte sobre DRE, Variação, cálculos..."
          className="flex-1"
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !inputValue.trim()}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        O assistente analisa dados de DRE e Variação para fornecer insights financeiros.
      </p>
    </div>
  );

  // Mobile version
  if (isMobile) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <MobileHeader
          title="Assistente"
          subtitle="Análise Financeira"
          showBack
          actions={
            messages.length > 0 ? (
              <Button variant="ghost" size="icon" onClick={clearChat} className="h-9 w-9">
                <RefreshCw className="h-4 w-4" />
              </Button>
            ) : undefined
          }
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {messages.length === 0 ? (
            <ScrollArea className="flex-1">
              <WelcomeState />
            </ScrollArea>
          ) : (
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4 pb-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} onCopy={handleCopyMessage} onSendMessage={handleSendMessage} dreData={filteredDreData} allMessages={messages.map(m => ({ role: m.role, content: m.content }))} />
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white animate-pulse" />
                    </div>
                    <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          {renderChatInput()}
        </div>

        <MobileBottomNav />
      </div>
    );
  }

  // Desktop version
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        actions={
          messages.length > 0 ? (
            <Button variant="outline" size="sm" onClick={clearChat}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Nova conversa
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {messages.length === 0 ? (
            <ScrollArea className="flex-1">
              <WelcomeState />
            </ScrollArea>
          ) : (
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="max-w-3xl mx-auto space-y-4 pb-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} onCopy={handleCopyMessage} onSendMessage={handleSendMessage} dreData={filteredDreData} allMessages={messages.map(m => ({ role: m.role, content: m.content }))} />
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white animate-pulse" />
                    </div>
                    <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          {renderChatInput()}
        </div>

        {/* Context sidebar - only on desktop */}
        <aside className="hidden lg:flex w-80 border-l border-border flex-col bg-muted/30">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Contexto dos Dados
            </h3>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* DRE Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    DRE Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dreIndicators.slice(0, 3).map((indicator, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground truncate">{indicator.label}</span>
                      <span className={cn(
                        "font-medium",
                        indicator.value >= 0 ? "text-emerald-500" : "text-red-500"
                      )}>
                        {formatCurrency(indicator.value)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick actions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-500" />
                    Perguntas Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {suggestedQuestions.slice(0, 4).map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(q.question)}
                      className="w-full text-left text-xs p-2 rounded-lg hover:bg-accent transition-colors whitespace-normal leading-relaxed"
                    >
                      {q.question}
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Capabilities */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Capacidades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-emerald-500" />
                      Análise de DRE e DFC
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-emerald-500" />
                      Comparativos entre períodos
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-emerald-500" />
                      Explicação de cálculos
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-emerald-500" />
                      Identificação de tendências
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-emerald-500" />
                      Alertas de variações
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
