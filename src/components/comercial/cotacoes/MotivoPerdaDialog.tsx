import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  MOTIVOS_PERDA,
  useSalvarMotivoPerda10041,
  validarMotivoPerda,
  type MotivoPerda,
  type MotivoPerdaRegistro,
} from '@/hooks/useMotivosPerda';
import type { CotacaoComercial } from '@/types/cotacoesComerciais';

interface MotivoPerdaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacao: CotacaoComercial | null;
  registro: MotivoPerdaRegistro | null;
}

const motivoOptions: readonly { value: MotivoPerda; label: string }[] = [
  { value: 'preco', label: 'Preço' },
  { value: 'prazo_entrega', label: 'Prazo de entrega' },
  { value: 'condicao_pagamento', label: 'Condição de pagamento' },
  { value: 'concorrencia', label: 'Concorrência' },
  { value: 'indisponibilidade_produto', label: 'Indisponibilidade de produto' },
  { value: 'cliente_desistiu', label: 'Cliente desistiu' },
  { value: 'cotacao_vencida', label: 'Cotação vencida' },
  { value: 'outro', label: 'Outro' },
];

function motivoInicial(registro: MotivoPerdaRegistro | null): MotivoPerda {
  return MOTIVOS_PERDA.includes(registro?.motivo as MotivoPerda)
    ? registro!.motivo as MotivoPerda
    : 'preco';
}

export function MotivoPerdaDialog({ open, onOpenChange, cotacao, registro }: MotivoPerdaDialogProps) {
  const [motivo, setMotivo] = useState<MotivoPerda>(() => motivoInicial(registro));
  const [observacao, setObservacao] = useState(registro?.observacao ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const salvarMotivo = useSalvarMotivoPerda10041();

  useEffect(() => {
    if (!open) return;
    setMotivo(motivoInicial(registro));
    setObservacao(registro?.observacao ?? '');
    setFormError(null);
  }, [cotacao?.idCotacao, open, registro]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!salvarMotivo.isPending) onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    if (!cotacao) return;

    const validacao = validarMotivoPerda({ motivo, observacao });
    if (!validacao.valido) {
      setFormError(validacao.erro);
      return;
    }

    setFormError(null);
    try {
      await salvarMotivo.mutateAsync({
        idCotacao: cotacao.idCotacao,
        motivo,
        observacao,
      });
      toast.success(registro ? 'Motivo atualizado com sucesso.' : 'Motivo registrado com sucesso.');
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar o motivo da perda.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{registro ? 'Editar motivo da perda' : 'Registrar motivo da perda'}</DialogTitle>
          <DialogDescription>
            Cotação {cotacao?.numeroCotacao ?? '--'} de {cotacao?.nomeCliente || 'cliente não informado'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="motivo-perda">Motivo da perda</Label>
            <Select value={motivo} onValueChange={(value: MotivoPerda) => {
              setMotivo(value);
              setFormError(null);
            }} disabled={salvarMotivo.isPending}>
              <SelectTrigger id="motivo-perda" aria-label="Motivo da perda">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {motivoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo-observacao">Observação</Label>
            <Textarea
              id="motivo-observacao"
              value={observacao}
              onChange={(event) => {
                setObservacao(event.target.value);
                setFormError(null);
              }}
              disabled={salvarMotivo.isPending}
              rows={4}
              placeholder="Contexto adicional sobre a perda"
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">{formError}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={salvarMotivo.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={salvarMotivo.isPending || !cotacao} aria-label={salvarMotivo.isPending ? 'Salvando motivo' : 'Salvar motivo'}>
            {salvarMotivo.isPending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {salvarMotivo.isPending ? 'Salvando...' : 'Salvar motivo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
