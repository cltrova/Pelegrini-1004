import { useEffect, useState } from 'react';
import { Bot, Check, Loader2, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

interface EstoqueAssistantSettingsProps {
  codEmpresaBi: string;
}

interface PromptSuggestion {
  suggested_prompt: string;
  explanation: string;
}

export function EstoqueAssistantSettings({ codEmpresaBi }: EstoqueAssistantSettingsProps) {
  const [prompt, setPrompt] = useState('');
  const [savedPrompt, setSavedPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [request, setRequest] = useState('');
  const [suggestion, setSuggestion] = useState<PromptSuggestion | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPrompt() {
      if (!codEmpresaBi) {
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('estoque_assistant_config')
          .select('custom_prompt')
          .eq('cod_empresa_bi', codEmpresaBi)
          .maybeSingle();

        if (active) {
          const value = data?.custom_prompt ?? '';
          setPrompt(value);
          setSavedPrompt(value);
        }
      } catch (error) {
        console.error('Erro ao carregar prompt:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadPrompt();
    return () => { active = false; };
  }, [codEmpresaBi]);

  const savePrompt = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('estoque_assistant_config')
        .select('id')
        .eq('cod_empresa_bi', codEmpresaBi)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('estoque_assistant_config')
          .update({ custom_prompt: prompt })
          .eq('cod_empresa_bi', codEmpresaBi);
      } else {
        await supabase
          .from('estoque_assistant_config')
          .insert({ cod_empresa_bi: codEmpresaBi, custom_prompt: prompt });
      }

      setSavedPrompt(prompt);
      toast.success('Configuração salva com sucesso');
    } catch (error) {
      console.error('Erro ao salvar prompt:', error);
      toast.error('Não foi possível salvar a configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const askForSuggestion = async () => {
    if (!request.trim() || isSuggesting) return;
    setIsSuggesting(true);
    setSuggestion(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistente-estoque-brain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData?.session?.access_token ?? ''}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ currentPrompt: prompt, userRequest: request.trim() }),
        },
      );

      if (!response.ok) throw new Error(`Erro: ${response.status}`);
      setSuggestion(await response.json());
    } catch (error) {
      console.error('Erro ao consultar assistente:', error);
      toast.error('Não foi possível gerar uma sugestão');
    } finally {
      setIsSuggesting(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const hasChanges = prompt !== savedPrompt;

  return (
    <section aria-labelledby="estoque-assistant-settings-title" className="space-y-6">
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="estoque-assistant-settings-title" className="flex items-center gap-2 text-xl font-semibold">
            <Bot className="h-5 w-5 text-primary" />
            Configuração do Assistente de Estoque
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina o comportamento usado no Chat e nos Insights da empresa selecionada.
          </p>
        </div>
        <Button size="sm" onClick={savePrompt} disabled={isSaving || !hasChanges} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : hasChanges ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {isSaving ? 'Salvando' : hasChanges ? 'Salvar' : 'Salvo'}
        </Button>
      </div>

      <div className="space-y-2">
        <label htmlFor="assistant-prompt" className="text-sm font-medium">Instruções personalizadas</label>
        <Textarea
          id="assistant-prompt"
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
          placeholder="Ex: Seja objetivo, priorize itens críticos e sugira ações baseadas no giro recente."
          className="min-h-52 resize-y font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">Estas instruções são adicionadas a todas as conversas e análises de estoque.</p>
      </div>

      <div className="space-y-3 border-t pt-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Assistente de configuração</h2>
          <p className="mt-1 text-xs text-muted-foreground">Descreva o ajuste desejado para receber uma sugestão de texto.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={request}
            onChange={event => setRequest(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') void askForSuggestion(); }}
            placeholder="Ex: quero respostas mais curtas e orientadas a compra"
            disabled={isSuggesting}
          />
          <Button variant="outline" onClick={askForSuggestion} disabled={isSuggesting || !request.trim()} className="gap-2 sm:shrink-0">
            {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Sugerir
          </Button>
        </div>

        {suggestion ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-4">
            <p className="text-sm">{suggestion.explanation}</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs">{suggestion.suggested_prompt}</pre>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setPrompt(suggestion.suggested_prompt); setSuggestion(null); setRequest(''); }}>Aplicar sugestão</Button>
              <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>Descartar</Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
