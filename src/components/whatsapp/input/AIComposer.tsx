import { useState } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  Expand, 
  Briefcase, 
  Heart, 
  CheckCircle2, 
  Languages,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AIComposerProps {
  text: string;
  onTextTransform: (newText: string) => void;
  disabled?: boolean;
}

type AIAction = 'rewrite' | 'expand' | 'formalize' | 'friendly' | 'grammar' | 'translate';

export function AIComposer({ text, onTextTransform, disabled }: AIComposerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<AIAction | null>(null);

  const actions = [
    { type: 'rewrite' as const, icon: RefreshCw, label: 'Reescrever', description: 'Reformula o texto mantendo o sentido' },
    { type: 'expand' as const, icon: Expand, label: 'Expandir', description: 'Adiciona mais detalhes' },
    { type: 'formalize' as const, icon: Briefcase, label: 'Formalizar', description: 'Torna mais profissional' },
    { type: 'friendly' as const, icon: Heart, label: 'Deixar amigável', description: 'Torna mais caloroso' },
    { type: 'grammar' as const, icon: CheckCircle2, label: 'Corrigir gramática', description: 'Corrige erros gramaticais' },
    { type: 'translate' as const, icon: Languages, label: 'Traduzir para inglês', description: 'Traduz o texto' },
  ];

  const handleAction = async (action: AIAction) => {
    if (!text.trim()) {
      toast.error('Digite uma mensagem primeiro');
      return;
    }

    setIsProcessing(true);
    setProcessingAction(action);

    try {
      const { data, error } = await supabase.functions.invoke('ai-compose', {
        body: { text: text.trim(), action }
      });

      if (error) {
        console.error('AI Compose error:', error);
        throw new Error(error.message || 'Erro ao processar texto');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.transformedText) {
        onTextTransform(data.transformedText);
        toast.success('Texto transformado!');
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (error) {
      console.error('AI Compose failed:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar texto');
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          disabled={disabled || isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Compositor IA (OpenAI)
          </p>
        </div>
        <DropdownMenuSeparator />
        {actions.map((action) => (
          <DropdownMenuItem 
            key={action.type}
            onClick={() => handleAction(action.type)}
            disabled={!text.trim() || isProcessing}
            className="cursor-pointer flex flex-col items-start py-2"
          >
            <div className="flex items-center gap-2">
              {processingAction === action.type ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <action.icon className="h-4 w-4" />
              )}
              <span>{action.label}</span>
            </div>
            <span className="text-xs text-muted-foreground ml-6">
              {action.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
