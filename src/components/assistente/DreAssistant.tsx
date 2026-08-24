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
  BarChart3,
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
  ArrowUpRight,
  CornerDownLeft,
  Command,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolAction {
  action: 'add' | 'remove';
  list: 'fixas' | 'variaveis';
  codes: string[];
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

interface DreAssistantProps {
  dreData: any[];
  indicators: Array<{ label: string; value: number }>;
  contasDespVar: Set<string>;
  contasDespFixas: Set<string>;
  onUpdateDespVar: (contas: Set<string>) => void;
  onUpdateDespFixas: (contas: Set<string>) => void;
}

const suggestedQuestions = [
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    question: "Verifique quais contas estão classificadas como despesas fixas",
    description: "Validar despesas fixas"
  },
  {
    icon: <ListChecks className="h-4 w-4" />,
    question: "Liste as contas de despesas variáveis e seus valores",
    description: "Validar despesas variáveis"
  },
  {
    icon: <Search className="h-4 w-4" />,
    question: "Identifique contas com valores zerados ou inconsistentes",
    description: "Detectar inconsistências"
  },
  {
    icon: <AlertTriangle className="h-4 w-4" />,
    question: "Existem contas duplicadas entre despesas fixas e variáveis?",
    description: "Verificar duplicidades"
  },
];

// Stream chat function with tool action support
async function streamChat({
  messages,
  dreData,
  onDelta,
  onToolAction,
  onDone,
  onError,
}: {
  messages: Array<{ role: string; content: string; imageBase64?: string }>;
  dreData: any[];
  onDelta: (deltaText: string) => void;
  onToolAction: (action: ToolAction) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const CHAT_URL = `${supabaseUrl}/functions/v1/assistente-dre`;
  
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ messages, dreData }),
    });

    if (resp.status === 429) {
      onError("Limite de requisições excedido. Aguarde um momento.");
      return;
    }
    if (resp.status === 402) {
      onError("Créditos esgotados. Adicione créditos à sua conta.");
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
        if (jsonStr === "[DONE]") { streamDone = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          // Check for tool action event
          if (parsed.tool_action) {
            onToolAction(parsed.tool_action as ToolAction);
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
          if (parsed.tool_action) {
            onToolAction(parsed.tool_action as ToolAction);
            continue;
          }
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

// Tool action confirmation card
function ToolActionCard({ 
  action, 
  onApply, 
  onReject, 
  applied 
}: { 
  action: ToolAction; 
  onApply: () => void; 
  onReject: () => void; 
  applied?: boolean;
}) {
  const isAdd = action.action === 'add';
  const listLabel = action.list === 'fixas' ? 'Despesas Fixas' : 'Despesas Variáveis';
  const actionLabel = isAdd ? 'Adicionar' : 'Remover';
  
  return (
    <Card className={cn(
      "p-3 border-l-4 my-2",
      applied === true ? "border-l-emerald-500 bg-emerald-500/5" :
      applied === false ? "border-l-muted bg-muted/30 opacity-60" :
      isAdd ? "border-l-blue-500 bg-blue-500/5" : "border-l-amber-500 bg-amber-500/5"
    )}>
      <div className="flex items-start gap-2">
        <div className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
          applied === true ? "bg-emerald-500/20 text-emerald-600" :
          isAdd ? "bg-blue-500/20 text-blue-600" : "bg-amber-500/20 text-amber-600"
        )}>
          {applied === true ? <Check className="h-3 w-3" /> : isAdd ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {applied === true ? '✅ Aplicado: ' : applied === false ? '❌ Recusado: ' : ''}
            {actionLabel} {action.codes.length} conta(s) em <span className="font-semibold">{listLabel}</span>
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {action.codes.map(code => (
              <span key={code} className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">{code}</span>
            ))}
          </div>
          {applied === undefined && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={onApply}>
                <Check className="h-3 w-3" />
                Aplicar
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onReject}>
                <X className="h-3 w-3" />
                Recusar
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

const MessageBubble = ({ 
  message, onCopy, dreData, allMessages, onApplyAction, onRejectAction
}: { 
  message: Message; 
  onCopy: (content: string) => void;
  dreData?: any[];
  allMessages?: Array<{ role: string; content: string }>;
  onApplyAction?: (messageId: string) => void;
  onRejectAction?: (messageId: string) => void;
}) => {
  const chartInfo = useMemo(() => {
    if (message.role !== 'assistant' || !message.content) {
      return { hasChart: false, chartData: [], chartType: 'bar' as const, chartTitle: '' };
    }
    const askedForChart = allMessages ? userRequestedChart(allMessages) : false;
    return parseChartData(message.content, dreData, askedForChart);
  }, [message.content, message.role, dreData, allMessages]);

  return (
    <div className={cn('flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300', message.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn('flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center', message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white')}>
        {message.role === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn('flex flex-col max-w-[85%] gap-1', message.role === 'user' ? 'items-end' : 'items-start')}>
        {/* Image preview for user messages */}
        {message.role === 'user' && message.imagePreview && (
          <div className="rounded-lg overflow-hidden border border-border mb-1 max-w-[200px]">
            <img src={message.imagePreview} alt="Imagem enviada" className="w-full h-auto" />
          </div>
        )}
        {/* Tool action card */}
        {message.role === 'assistant' && message.toolAction && (
          <ToolActionCard 
            action={message.toolAction}
            applied={message.toolActionApplied}
            onApply={() => onApplyAction?.(message.id)}
            onReject={() => onRejectAction?.(message.id)}
          />
        )}
        {message.content && (
          <div className={cn('px-4 py-3 rounded-2xl text-sm leading-relaxed', message.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0')}>
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
                  table: ({ children }) => <table className="w-full text-xs border-collapse my-2">{children}</table>,
                  th: ({ children }) => <th className="border border-border px-2 py-1 bg-muted font-semibold text-left">{children}</th>,
                  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
        {message.role === 'assistant' && chartInfo.hasChart && (
          <div className="w-full mt-2">
            <ResponseChart data={chartInfo.chartData} type={chartInfo.chartType} title={chartInfo.chartTitle} />
          </div>
        )}
        {message.role === 'assistant' && message.content && (
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

export function DreAssistant({ dreData, indicators, contasDespVar, contasDespFixas, onUpdateDespVar, onUpdateDespFixas }: DreAssistantProps) {
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPendingImage({ base64, preview: base64 });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleApplyAction = useCallback((messageId: string) => {
    setMessages(prev => {
      const msg = prev.find(m => m.id === messageId);
      if (!msg?.toolAction) return prev;
      
      const { action, list, codes } = msg.toolAction;
      
      if (list === 'fixas') {
        const updated = new Set(contasDespFixas);
        codes.forEach(c => action === 'add' ? updated.add(c) : updated.delete(c));
        onUpdateDespFixas(updated);
      } else {
        const updated = new Set(contasDespVar);
        codes.forEach(c => action === 'add' ? updated.add(c) : updated.delete(c));
        onUpdateDespVar(updated);
      }
      
      toast.success(`${codes.length} conta(s) ${action === 'add' ? 'adicionada(s)' : 'removida(s)'} com sucesso!`);
      return prev.map(m => m.id === messageId ? { ...m, toolActionApplied: true } : m);
    });
  }, [contasDespFixas, contasDespVar, onUpdateDespFixas, onUpdateDespVar]);

  const handleRejectAction = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, toolActionApplied: false } : m));
    toast.info('Ação recusada.');
  }, []);

  const handleSendMessage = async (content: string) => {
    if ((!content.trim() && !pendingImage) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim() || (pendingImage ? 'Analise esta imagem:' : ''),
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
    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);

    await streamChat({
      messages: apiMessages,
      dreData: dreData || [],
      onDelta: (chunk) => {
        assistantContent += chunk;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
      },
      onToolAction: (toolAction) => {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, toolAction } : m));
      },
      onDone: () => setIsLoading(false),
      onError: (error) => {
        toast.error(error);
        setIsLoading(false);
        setMessages(prev => prev.filter(m => m.id !== assistantId));
      }
    });
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copiado!');
  };

  const clearChat = () => {
    setMessages([]);
    setPendingImage(null);
  };

  const WelcomeState = () => (
    <div className="relative flex flex-col items-center justify-center h-full p-6 text-center overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-40 w-40 rounded-full bg-cyan-500/[0.07] blur-3xl" />
        <div className="absolute top-10 right-1/4 h-32 w-32 rounded-full bg-violet-500/[0.06] blur-3xl" />
      </div>

      {/* Hero orb */}
      <div className="relative animate-fade-in">
        {/* Rings */}
        <div className="absolute inset-0 -m-6 rounded-full border border-blue-500/20 animate-[pulse_3s_ease-in-out_infinite]" />
        <div className="absolute inset-0 -m-3 rounded-full border border-blue-400/25" />
        {/* Rotating conic */}
        <div
          className="absolute inset-0 -m-1 rounded-full opacity-70"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, hsl(217 91% 60% / 0.6) 90deg, transparent 180deg, hsl(199 89% 55% / 0.4) 270deg, transparent 360deg)',
            animation: 'spin 6s linear infinite',
            WebkitMask: 'radial-gradient(circle, transparent 60%, black 62%)',
            mask: 'radial-gradient(circle, transparent 60%, black 62%)',
          }}
        />
        <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 flex items-center justify-center shadow-[0_10px_40px_-8px_hsl(217_91%_60%/0.55),inset_0_1px_0_0_hsl(0_0%_100%/0.2)]">
          <ShieldCheck className="h-9 w-9 text-white drop-shadow-md" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center border-2 border-background shadow-[0_0_12px_0_hsl(158_64%_52%/0.6)] animate-[pulse_2s_ease-in-out_infinite]">
          <Zap className="h-3 w-3 text-white" />
        </div>
      </div>

      <div className="relative mt-6 space-y-1.5 animate-fade-in">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Online
        </div>
        <h3 className="text-xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
          Validadora de Dados DRE
        </h3>
        <p className="text-[13px] text-muted-foreground max-w-sm leading-relaxed">
          Verifique classificações, ajuste listas de despesas e analise dados críticos. Envie prints de tabelas para comparação.
        </p>
      </div>

      {/* Card DRE premium */}
      <button
        type="button"
        className="group relative mt-6 w-full max-w-sm text-left rounded-2xl p-4 border border-blue-500/25 bg-gradient-to-br from-blue-500/[0.08] via-blue-500/[0.04] to-transparent hover:from-blue-500/[0.14] hover:via-blue-500/[0.07] hover:border-blue-400/40 transition-all shadow-[0_1px_0_0_hsl(217_91%_60%/0.15)_inset,0_10px_30px_-15px_hsl(217_91%_60%/0.4)] hover:-translate-y-0.5 hover:shadow-[0_1px_0_0_hsl(217_91%_60%/0.25)_inset,0_18px_40px_-18px_hsl(217_91%_60%/0.55)] animate-fade-in"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 shadow-[0_0_16px_-4px_hsl(217_91%_60%/0.5)]">
              <BarChart3 className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-foreground">DRE</span>
                <span className="text-[9.5px] font-semibold uppercase tracking-wider text-blue-400/80 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">Ativo</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Dataset conectado</p>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-blue-400/60 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-blue-500/15">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">Registros</div>
            <div className="text-[15px] font-bold text-foreground tabular-nums mt-0.5">{dreData?.length || 0}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">Fixas</div>
            <div className="text-[15px] font-bold text-emerald-400 tabular-nums mt-0.5">{contasDespFixas.size}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">Variáveis</div>
            <div className="text-[15px] font-bold text-violet-300 tabular-nums mt-0.5">{contasDespVar.size}</div>
          </div>
        </div>
      </button>

      {/* Sugestões */}
      <div className="relative mt-6 w-full max-w-sm space-y-2 animate-fade-in">
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-center justify-center h-5 w-5 rounded-md bg-amber-500/15 border border-amber-500/25">
            <Lightbulb className="h-3 w-3 text-amber-400" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sugestões inteligentes</span>
          <span className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent" />
        </div>
        <div className="grid gap-1.5">
          {suggestedQuestions.map((item, index) => (
            <button
              key={index}
              onClick={() => handleSendMessage(item.question)}
              className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-card/60 hover:bg-card hover:border-blue-500/40 transition-all text-left overflow-hidden hover:-translate-y-px hover:shadow-[0_6px_20px_-10px_hsl(217_91%_60%/0.4)]"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-blue-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20 group-hover:border-blue-400/40 group-hover:scale-105 transition-all flex-shrink-0">
                {item.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12.5px] font-medium text-foreground/90 leading-snug">{item.question}</span>
                <span className="block text-[10.5px] text-muted-foreground/80 mt-0.5">{item.description}</span>
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col h-[640px] rounded-2xl overflow-hidden border border-border/60 bg-gradient-to-b from-card via-card to-card/70 shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_18px_50px_-24px_rgba(0,0,0,0.55)]">
      {/* Header premium */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-border/60 bg-gradient-to-r from-blue-500/[0.06] via-transparent to-transparent backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_16px_-2px_hsl(217_91%_60%/0.55),inset_0_1px_0_0_hsl(0_0%_100%/0.2)]">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-card shadow-[0_0_8px_0_hsl(158_64%_52%/0.7)] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold tracking-tight text-foreground">Validadora de Dados DRE</span>
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-blue-400/90 px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">Copilot</span>
            </div>
            <span className="text-[10.5px] text-muted-foreground">Assistente analítico em tempo real</span>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} className="h-7 text-[11px] gap-1.5 hover:bg-blue-500/10 hover:text-blue-400 transition-colors">
            <RefreshCw className="h-3 w-3" />
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
                dreData={dreData} 
                allMessages={messages.map(m => ({ role: m.role, content: m.content }))}
                onApplyAction={handleApplyAction}
                onRejectAction={handleRejectAction}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
              <div className="flex gap-3 animate-fade-in">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_16px_-2px_hsl(217_91%_60%/0.55)]">
                  <Sparkles className="h-4 w-4 text-white animate-pulse" />
                </div>
                <div className="bg-muted/60 border border-border/50 backdrop-blur-sm px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-[11px] text-muted-foreground ml-1">Analisando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Pending image preview */}
      {pendingImage && (
        <div className="px-4 pt-3 flex items-center gap-2 animate-fade-in">
          <div className="relative">
            <img src={pendingImage.preview} alt="Preview" className="h-14 w-14 rounded-xl object-cover border border-blue-500/30 shadow-[0_0_16px_-4px_hsl(217_91%_60%/0.4)]" />
            <button 
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[11px] font-bold shadow-md hover:scale-110 transition-transform"
            >
              ×
            </button>
          </div>
          <span className="text-[11.5px] text-muted-foreground">Imagem anexada — pronta para envio</span>
        </div>
      )}

      {/* Input — command bar */}
      <div className="relative border-t border-border/60 bg-gradient-to-b from-transparent to-blue-500/[0.03] p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }}
          className={cn(
            'group/composer relative flex items-center gap-1.5 rounded-2xl border border-border/60 bg-background/60 backdrop-blur-md pl-2 pr-1.5 py-1.5 transition-all',
            'shadow-[0_1px_0_0_hsl(var(--border)/0.3)_inset]',
            'focus-within:border-blue-500/50 focus-within:bg-background/80 focus-within:shadow-[0_0_0_3px_hsl(217_91%_60%/0.12),0_1px_0_0_hsl(var(--border)/0.3)_inset]',
            isLoading && 'opacity-70'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Anexar imagem"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Pergunte sobre contas, classificações, valores..."
            className="flex-1 h-8 text-[13px] border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70 px-1"
            disabled={isLoading}
          />
          <div className="hidden sm:flex items-center gap-0.5 text-[10px] text-muted-foreground/60 mr-1.5 opacity-0 group-focus-within/composer:opacity-100 transition-opacity">
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 font-mono text-[9.5px]">
              <CornerDownLeft className="h-2.5 w-2.5" />
              Enviar
            </kbd>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || (!inputValue.trim() && !pendingImage)}
            className={cn(
              'h-8 w-8 p-0 flex-shrink-0 rounded-lg transition-all',
              'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-600 text-white',
              'shadow-[0_4px_16px_-4px_hsl(217_91%_60%/0.6),inset_0_1px_0_0_hsl(0_0%_100%/0.15)]',
              'hover:shadow-[0_6px_20px_-4px_hsl(217_91%_60%/0.75),inset_0_1px_0_0_hsl(0_0%_100%/0.2)] hover:-translate-y-px',
              'disabled:opacity-50 disabled:shadow-none disabled:translate-y-0'
            )}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
            <Command className="h-2.5 w-2.5" />
            Copilot financeiro • respostas geradas por IA
          </span>
        </div>
      </div>
    </div>
  );
}
