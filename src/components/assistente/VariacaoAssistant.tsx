import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ResponseChart, parseChartData, userRequestedChart } from '@/components/assistente/ResponseChart';
import {
  Send,
  Sparkles,
  User,
  Lightbulb,
  ArrowLeftRight,
  Loader2,
  RefreshCw,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Bot,
  Zap,
  ImagePlus,
  ShieldCheck,
  Search,
  AlertTriangle,
  ListChecks,
  Check,
  X,
  Plus,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolAction {
  action: 'add_inverter_sinal' | 'remove_inverter_sinal' | 'add_ativo_operacional' | 'remove_ativo_operacional';
  groups: string[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageBase64?: string;
  imagePreview?: string;
  toolAction?: ToolAction;
  toolActionApplied?: boolean;
}

interface VariacaoAssistantProps {
  variacaoData: any[];
  gruposInverterSinal: Set<string>;
  gruposAtivosOperacionais: Set<string>;
  onUpdateInverterSinal: (contas: Set<string>) => void;
  onUpdateAtivosOperacionais: (contas: Set<string>) => void;
}

const ACTION_LABELS: Record<string, { verb: string; list: string }> = {
  add_inverter_sinal: { verb: 'Adicionar', list: 'Inversão de Sinal' },
  remove_inverter_sinal: { verb: 'Remover', list: 'Inversão de Sinal' },
  add_ativo_operacional: { verb: 'Adicionar', list: 'Ativos Operacionais' },
  remove_ativo_operacional: { verb: 'Remover', list: 'Ativos Operacionais' },
};

const suggestedQuestions = [
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    question: "Quais grupos estão configurados com inversão de sinal?",
    description: "Validar configuração de sinais"
  },
  {
    icon: <ListChecks className="h-4 w-4" />,
    question: "Liste os grupos classificados como ativos operacionais",
    description: "Verificar ativos operacionais"
  },
  {
    icon: <Search className="h-4 w-4" />,
    question: "Identifique inconsistências na lógica de sinais da DFC",
    description: "Detectar inconsistências"
  },
  {
    icon: <AlertTriangle className="h-4 w-4" />,
    question: "Quais grupos deveriam inverter o sinal mas não estão configurados?",
    description: "Recomendar ajustes"
  },
];

// Streaming function
async function streamChat({
  messages,
  variacaoData,
  gruposInverterSinal,
  gruposAtivosOperacionais,
  onDelta,
  onToolAction,
  onDone,
  onError,
}: {
  messages: Array<{ role: string; content: string; imageBase64?: string }>;
  variacaoData: any[];
  gruposInverterSinal: string[];
  gruposAtivosOperacionais: string[];
  onDelta: (deltaText: string) => void;
  onToolAction: (action: ToolAction) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const CHAT_URL = `${supabaseUrl}/functions/v1/assistente-variacao`;
  
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ messages, variacaoData, gruposInverterSinal, gruposAtivosOperacionais }),
    });

    if (resp.status === 429) { onError("Limite de requisições excedido. Aguarde um momento."); return; }
    if (resp.status === 402) { onError("Créditos esgotados. Adicione créditos à sua conta."); return; }
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
        if (jsonStr === "[DONE]") { streamDone = true; break; }

        try {
          const parsed = JSON.parse(jsonStr);
          // Check for tool action
          if (parsed.tool_action) {
            onToolAction(parsed.tool_action);
            continue;
          }
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
          if (parsed.tool_action) { onToolAction(parsed.tool_action); continue; }
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

const ToolActionCard = ({
  action,
  onApply,
  onReject,
  applied,
}: {
  action: ToolAction;
  onApply: () => void;
  onReject: () => void;
  applied?: boolean;
}) => {
  const labels = ACTION_LABELS[action.action] || { verb: action.action, list: '?' };
  const isAdd = action.action.startsWith('add');

  return (
    <Card className={cn(
      "p-3 border-l-4 my-2",
      applied === true ? "border-l-emerald-500 bg-emerald-500/5" :
      applied === false ? "border-l-destructive bg-destructive/5 opacity-60" :
      isAdd ? "border-l-blue-500 bg-blue-500/5" : "border-l-orange-500 bg-orange-500/5"
    )}>
      <div className="flex items-start gap-2">
        {isAdd ? <Plus className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" /> : <Minus className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {labels.verb} em <span className="font-bold">{labels.list}</span>:
          </p>
          <div className="mt-1 space-y-0.5">
            {action.groups.map((group, i) => (
              <code key={i} className="block text-xs bg-muted px-1.5 py-0.5 rounded">{group}</code>
            ))}
          </div>
          {applied === undefined && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={onApply}>
                <Check className="h-3 w-3" /> Aplicar
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onReject}>
                <X className="h-3 w-3" /> Recusar
              </Button>
            </div>
          )}
          {applied === true && (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><Check className="h-3 w-3" /> Aplicado</p>
          )}
          {applied === false && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><X className="h-3 w-3" /> Recusado</p>
          )}
        </div>
      </div>
    </Card>
  );
};

const MessageBubble = ({ 
  message, 
  onCopy,
  onApplyAction,
  onRejectAction,
  allMessages
}: { 
  message: Message; 
  onCopy: (content: string) => void;
  onApplyAction?: () => void;
  onRejectAction?: () => void;
  allMessages?: Array<{ role: string; content: string }>;
}) => {
  const chartInfo = useMemo(() => {
    if (message.role !== 'assistant' || !message.content) {
      return { hasChart: false, chartData: [], chartType: 'bar' as const, chartTitle: '' };
    }
    const askedForChart = allMessages ? userRequestedChart(allMessages) : false;
    return parseChartData(message.content, undefined, askedForChart);
  }, [message.content, message.role, allMessages]);

  return (
    <div className={cn('flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300', message.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ring-1',
        message.role === 'user'
          ? 'bg-primary text-primary-foreground ring-primary/30'
          : 'bg-gradient-to-br from-blue-500 to-violet-600 text-white ring-blue-400/30 shadow-[0_0_18px_-4px_rgba(59,130,246,0.6)]'
      )}>
        {message.role === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn('flex flex-col max-w-[85%] gap-1', message.role === 'user' ? 'items-end' : 'items-start')}>
        {message.imagePreview && (
          <div className="mb-1">
            <img src={message.imagePreview} alt="Upload" className="max-w-[200px] max-h-[150px] rounded-lg border object-cover" />
          </div>
        )}
        <div className={cn(
          'px-4 py-3 rounded-2xl text-sm leading-relaxed',
          message.role === 'user'
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-slate-800/60 border border-white/5 backdrop-blur rounded-bl-sm prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
        )}>
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
                h3: ({ children }) => <h3 className="font-bold text-base mt-3 mb-1">{children}</h3>,
                h4: ({ children }) => <h4 className="font-semibold text-sm mt-2 mb-1">{children}</h4>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {message.toolAction && (
          <ToolActionCard
            action={message.toolAction}
            applied={message.toolActionApplied}
            onApply={onApplyAction || (() => {})}
            onReject={onRejectAction || (() => {})}
          />
        )}

        {message.role === 'assistant' && chartInfo.hasChart && (
          <div className="w-full mt-2">
            <ResponseChart data={chartInfo.chartData} type={chartInfo.chartType} title={chartInfo.chartTitle} />
          </div>
        )}

        {message.role === 'assistant' && (
          <div className="flex items-center gap-1 mt-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100" onClick={() => onCopy(message.content)}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100"><ThumbsUp className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100"><ThumbsDown className="h-3 w-3" /></Button>
          </div>
        )}
      </div>
    </div>
  );
};

export function VariacaoAssistant({ 
  variacaoData, 
  gruposInverterSinal, 
  gruposAtivosOperacionais,
  onUpdateInverterSinal,
  onUpdateAtivosOperacionais,
}: VariacaoAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ base64: string; preview: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 10MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPendingImage({ base64, preview: base64 });
      toast.success('Imagem anexada! Envie sua mensagem.');
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const applyToolAction = useCallback((messageId: string, action: ToolAction) => {
    if (action.action === 'add_inverter_sinal') {
      const updated = new Set(gruposInverterSinal);
      action.groups.forEach(g => updated.add(g));
      onUpdateInverterSinal(updated);
    } else if (action.action === 'remove_inverter_sinal') {
      const updated = new Set(gruposInverterSinal);
      action.groups.forEach(g => updated.delete(g));
      onUpdateInverterSinal(updated);
    } else if (action.action === 'add_ativo_operacional') {
      const updated = new Set(gruposAtivosOperacionais);
      action.groups.forEach(g => updated.add(g));
      onUpdateAtivosOperacionais(updated);
    } else if (action.action === 'remove_ativo_operacional') {
      const updated = new Set(gruposAtivosOperacionais);
      action.groups.forEach(g => updated.delete(g));
      onUpdateAtivosOperacionais(updated);
    }

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, toolActionApplied: true } : m));
    toast.success('Configuração atualizada! A DFC será recalculada.');
  }, [gruposInverterSinal, gruposAtivosOperacionais, onUpdateInverterSinal, onUpdateAtivosOperacionais]);

  const rejectToolAction = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, toolActionApplied: false } : m));
    toast.info('Ação recusada.');
  }, []);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      imageBase64: pendingImage?.base64,
      imagePreview: pendingImage?.preview,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setPendingImage(null);
    setIsLoading(true);

    const apiMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
      ...(m.imageBase64 ? { imageBase64: m.imageBase64 } : {}),
    }));

    let assistantContent = "";
    let toolActionReceived: ToolAction | null = null;
    
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);

    await streamChat({
      messages: apiMessages,
      variacaoData: variacaoData || [],
      gruposInverterSinal: Array.from(gruposInverterSinal),
      gruposAtivosOperacionais: Array.from(gruposAtivosOperacionais),
      onDelta: (chunk) => {
        assistantContent += chunk;
        setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: assistantContent } : m));
      },
      onToolAction: (action) => {
        toolActionReceived = action;
        setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, toolAction: action } : m));
      },
      onDone: () => {
        setIsLoading(false);
      },
      onError: (error) => {
        toast.error(error);
        setIsLoading(false);
        setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
      }
    });
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copiado!');
  };

  const clearChat = () => setMessages([]);

  const WelcomeState = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-2xl" />
        <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(59,130,246,0.7)] ring-1 ring-white/10">
          <Bot className="h-10 w-10 text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-background shadow-lg">
          <Zap className="h-3 w-3 text-white" />
        </div>
      </div>

      <div className="space-y-1.5 mb-5">
        <h3 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
          Validadora de Dados DFC
        </h3>
        <p className="text-sm text-slate-400 max-w-md leading-relaxed">
          Analise, valide e configure seu Demonstrativo de Fluxo de Caixa. Gerencie inversão de sinais e classificação de ativos/passivos diretamente pelo chat.
        </p>
      </div>

      <Card className="relative overflow-hidden p-3.5 border-white/5 bg-gradient-to-br from-blue-500/10 via-violet-500/5 to-transparent w-full max-w-sm mb-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
        <div className="flex items-center gap-2 text-blue-300">
          <div className="h-6 w-6 rounded-md bg-blue-500/20 flex items-center justify-center ring-1 ring-blue-400/20">
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold">Variação / DFC</span>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-left">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Registros</p>
            <p className="text-sm font-mono font-semibold text-slate-100">{variacaoData?.length || 0}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Inversões</p>
            <p className="text-sm font-mono font-semibold text-violet-300">{gruposInverterSinal.size}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Ativos op.</p>
            <p className="text-sm font-mono font-semibold text-emerald-300">{gruposAtivosOperacionais.size}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-2 w-full max-w-lg">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5 justify-center">
          <Lightbulb className="h-3 w-3 text-amber-400" />
          Sugestões
        </p>
        <div className="grid gap-2">
          {suggestedQuestions.map((item, index) => (
            <button
              key={index}
              onClick={() => handleSendMessage(item.question)}
              className="group flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-slate-900/40 hover:bg-slate-800/60 hover:border-blue-400/30 hover:shadow-[0_0_20px_-8px_rgba(59,130,246,0.5)] transition-all text-left"
            >
              <span className="h-7 w-7 rounded-md bg-blue-500/10 ring-1 ring-blue-400/20 flex items-center justify-center text-blue-300 group-hover:bg-blue-500/20 transition-colors">
                {item.icon}
              </span>
              <span className="text-xs text-slate-200 flex-1">{item.question}</span>
              <Send className="h-3 w-3 text-slate-600 group-hover:text-blue-300 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[640px] rounded-xl overflow-hidden border border-white/5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-slate-900/60 backdrop-blur">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center ring-1 ring-white/10 shadow-[0_0_15px_-3px_rgba(59,130,246,0.6)]">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-100 leading-tight">Validadora DFC</span>
            <span className="text-[10px] text-slate-500 leading-tight">Assistente analítico</span>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} className="h-7 text-xs text-slate-400 hover:text-slate-100 hover:bg-white/5">
            <RefreshCw className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Chat area */}
      {messages.length === 0 ? (
        <ScrollArea className="flex-1"><WelcomeState /></ScrollArea>
      ) : (
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onCopy={handleCopyMessage}
                onApplyAction={message.toolAction ? () => applyToolAction(message.id, message.toolAction!) : undefined}
                onRejectAction={message.toolAction ? () => rejectToolAction(message.id) : undefined}
                allMessages={messages.map(m => ({ role: m.role, content: m.content }))}
              />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center ring-1 ring-blue-400/30 shadow-[0_0_18px_-4px_rgba(59,130,246,0.6)]">
                  <Sparkles className="h-4 w-4 text-white animate-pulse" />
                </div>
                <div className="bg-slate-800/60 border border-white/5 backdrop-blur px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-[11px] text-slate-400 ml-2">Analisando…</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Pending image preview */}
      {pendingImage && (
        <div className="px-3 py-2 border-t border-white/5 bg-slate-900/60 flex items-center gap-2">
          <img src={pendingImage.preview} alt="Anexo" className="h-10 w-10 rounded object-cover border border-white/10" />
          <span className="text-xs text-slate-400 flex-1">Imagem anexada</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPendingImage(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/5 bg-slate-900/40 backdrop-blur p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }}
          className="flex gap-2 items-center rounded-xl border border-white/5 bg-slate-950/60 focus-within:border-blue-400/40 focus-within:shadow-[0_0_20px_-8px_rgba(59,130,246,0.6)] transition-all px-1.5 py-1"
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-slate-400 hover:text-blue-300 hover:bg-white/5"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Pergunte sobre a DFC ou peça alterações…"
            className="flex-1 h-9 text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !inputValue.trim()}
            className="h-8 w-8 shrink-0 bg-gradient-to-br from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 shadow-[0_0_15px_-3px_rgba(59,130,246,0.6)] disabled:opacity-40 disabled:shadow-none"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
