import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, Lock } from 'lucide-react';
import { getFilialAccessState } from '@/utils/filialAccess';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useAuth } from '@/contexts/AuthContext';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { getPelegriniIdentity } from '@/config/pelegriniIdentity';
import { PelegriniBranchPanel } from '@/components/pelegrini';

interface FilialSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codEmpresa: string | null | undefined;
  onConfirm?: (filialId: string) => void;
  /** Quando true, a filial é obrigatória para acessar os dados, mas o usuário ainda pode voltar/fechar. */
  required?: boolean;
}

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

        <div className="grid gap-3 py-2 sm:grid-cols-2">
          {filiais.map((f) => {
            const branchTheme = resolvePelegriniTheme(f.id);
            const branchIdentity = getPelegriniIdentity(branchTheme.key);
            const active = selectedId === f.id;
            const blocked = f.blocked;

            return (
              <div key={f.id} className="min-w-0">
                <PelegriniBranchPanel
                  theme={branchTheme}
                  active={active}
                  indicators={branchIdentity.microIndicators}
                  description={blocked ? 'Acesso pendente de liberação pelo master em Configurações.' : branchIdentity.selectorDescription}
                  onSelect={() => {
                    if (!blocked) setSelectedId(f.id);
                  }}
                  disabled={blocked}
                  className={blocked ? 'border-dashed bg-muted/30' : undefined}
                />
                {blocked && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    Bloqueada: acesso pendente de liberação pelo master em Configurações.
                  </p>
                )}
              </div>
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
