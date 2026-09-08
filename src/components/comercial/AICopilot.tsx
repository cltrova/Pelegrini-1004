import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Loader2, X, MessageSquare, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import type { ComercialAIContext } from '@/utils/comercialAIContext';

interface Props {
  contexto: ComercialAIContext;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGESTOES = [
  'Por que o faturamento caiu?',
  'Qual vendedor merece atenção?',
  'Quais clientes estão em risco?',
  'O que eu preciso olhar hoje?',
  'Quais produtos mais crescem?',
  'Qual filial está em melhor performance?',
];

export function AICopilot({ contexto }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const txt = text.trim();
    if (!txt || loading) return;
    const next: Msg[] = [...messages, { role: 'user', content: txt }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('comercial-ai-chat', {
        body: { messages: next, contexto },
      });
      if (error) throw error;
      setMessages([...next, { role: 'assistant', content: data?.reply || 'Sem resposta.' }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: 'Erro ao consultar a IA. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-6 right-6 z-40 group"
          aria-label="Abrir copiloto IA"
        >
          <div className="relative h-14 w-14 rounded-full bg-primary flex items-center justify-center border border-primary/40 transition-colors duration-200 group-hover:bg-primary/90">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success ring-2 ring-background" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full text-xs font-semibold bg-card border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Perguntar à IA
          </span>
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l-border/60 bg-background">
        {/* Header */}
        <div className="relative px-5 py-4 border-b border-border/50 bg-card">
          <div className="relative flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold flex items-center gap-2">
                Copiloto Comercial
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-mono uppercase tracking-wider">IA</span>
              </h2>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Conectado aos seus dados em tempo real
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Olá! Sou seu copiloto comercial.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Analiso seu faturamento, vendedores, clientes, devoluções e tendências em tempo real.
                  Pergunte qualquer coisa sobre seu desempenho.
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 px-1">Sugestões</p>
                <div className="space-y-1.5">
                  {SUGESTOES.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs bg-card hover:bg-muted/60 border border-border/50 hover:border-primary/40 transition-colors duration-200 flex items-center gap-2 group"
                    >
                      <MessageSquare className="h-3 w-3 text-primary/60 group-hover:text-primary transition-colors" />
                      <span className="flex-1">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-2 animate-fade-in',
                m.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {m.role === 'assistant' && (
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border/50 rounded-bl-sm'
                )}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0 prose-headings:my-2">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{m.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 animate-fade-in">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="bg-card border border-border/50 rounded-lg rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border/50 p-3 bg-card">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="relative flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte ao copiloto..."
              disabled={loading}
              className="flex-1 h-10 px-3.5 rounded-lg bg-background border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-colors"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} className="h-10 w-10 rounded-lg shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Respostas baseadas nos dados do período selecionado
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
