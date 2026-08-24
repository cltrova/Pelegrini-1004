import { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';

export function FilialBadge() {
  const { empresaPossuiFiliaisAtiva, filialNome, codEmpresaContexto } = useFilialSelecionada();
  const [open, setOpen] = useState(false);

  if (!empresaPossuiFiliaisAtiva) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 h-8 text-xs"
      >
        <Building2 className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">{filialNome ?? 'Selecionar filial'}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </Button>
      <FilialSelectorDialog
        open={open}
        onOpenChange={setOpen}
        codEmpresa={codEmpresaContexto}
      />
    </>
  );
}
