import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, Check, Wrench, Car, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFilialAccessState } from '@/utils/filialAccess';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useAuth } from '@/contexts/AuthContext';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';

interface FilialSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codEmpresa: string | null | undefined;
  onConfirm?: (filialId: string) => void;
  /** Quando true, a filial é obrigatória para acessar os dados, mas o usuário ainda pode voltar/fechar. */
  required?: boolean;
}

const ICON_BY_ID: Record<string, typeof Building2> = {
  transmissao: Wrench,
  chevrolet: Car,
};

export function FilialSelectorDialog({
  open,
  onOpenChange,
  codEmpresa,
  onConfirm,
  required = false,
}: FilialSelectorDialogProps) {
  const { filialAtiva, setFilialAtivaForEmpresa } = useFilialSelecionada();
  const { isMaster, profile } = useAuth() as any;
  const filialAccess = getFilialAccessState({
    codEmpresa,
    isMaster,
    filiaisPermitidas: profile?.filiais_permitidas as string[] | null | undefined,
    filialPadrao: profile?.filial_id as string | null | undefined,
  });
  const filiais = filialAccess.items;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const activeIsAvailable = filialAtiva && filialAccess.available.some((filial) => filial.id === filialAtiva);
      setSelectedId(activeIsAvailable ? filialAtiva : null);
    }
    else setSelectedId(null);
  }, [open, filialAtiva, codEmpresa, isMaster, profile?.filial_id, profile?.filiais_permitidas]);

  if (filiais.length === 0) return null;

  const handleConfirm = () => {
    if (!selectedId) return;
    if (!filialAccess.available.some((filial) => filial.id === selectedId)) return;
    setFilialAtivaForEmpresa(codEmpresa, selectedId);
    if (onConfirm) {
      onConfirm(selectedId);
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Selecionar Filial
          </DialogTitle>
          <DialogDescription>
            Escolha a filial para ajustar visual, filtros e indicadores do painel.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {filiais.map((f) => {
            const Icon = ICON_BY_ID[f.id] ?? Building2;
            const branchTheme = resolvePelegriniTheme(f.id);
            const active = selectedId === f.id;
            const blocked = f.blocked;
            return (
              <button
                key={f.id}
                onClick={() => {
                  if (!blocked) setSelectedId(f.id);
                }}
                disabled={blocked}
                className={cn(
                  'group relative w-full p-4 rounded-lg border text-left transition-all duration-200 flex items-center gap-4 overflow-hidden',
                  !blocked && 'hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/40 hover:shadow-lg hover:shadow-primary/10',
                  active ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-md shadow-primary/15' : 'border-border bg-card',
                  blocked && 'opacity-65 cursor-not-allowed bg-muted/30 border-dashed',
                )}
              >
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 w-1 transition-colors',
                    active ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/50',
                  )}
                />
                <div className={cn('h-14 w-20 rounded-lg border flex items-center justify-center overflow-hidden transition-all duration-200', active ? 'border-primary/30 bg-primary/10' : 'border-border bg-background group-hover:border-primary/30')}>
                  {f.logoSrc ? (
                    <img
                      src={f.logoSrc}
                      alt={f.logoAlt}
                      className="max-h-11 max-w-[4.25rem] object-contain transition-transform duration-200 group-hover:scale-110"
                    />
                  ) : (
                    <Icon className={cn('h-6 w-6', active ? 'text-primary' : 'text-muted-foreground')} />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium flex items-center gap-2">
                    {f.nome}
                    {active && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                        Ativa
                      </span>
                    )}
                    {blocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-500">
                        <Lock className="h-3 w-3" />
                        Bloqueada
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {blocked
                      ? 'Acesso pendente de liberação pelo master em Configurações.'
                      : 'Dados exclusivos desta filial'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {branchTheme.trustSignals.slice(0, 3).map((signal) => (
                      <span key={signal} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
                {blocked && (
                  <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                )}
                {active && (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          {!filialAccess.hasAnyAccess && (
            <p className="mr-auto max-w-[280px] text-xs text-amber-500">
              Nenhuma filial liberada. Peça ao usuário master para ajustar seu acesso em Configurações.
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {required ? 'Voltar' : 'Cancelar'}
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>Acessar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
