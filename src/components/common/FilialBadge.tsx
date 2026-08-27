import { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';
import { getFilialPorId } from '@/config/filiaisEmpresa';

export function FilialBadge() {
  const { empresaPossuiFiliaisAtiva, filialNome, codEmpresaContexto, filialAtiva } = useFilialSelecionada();
  const [open, setOpen] = useState(false);
  const filialConfig = getFilialPorId(codEmpresaContexto, filialAtiva);

  if (!empresaPossuiFiliaisAtiva) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 h-8 text-xs"
      >
        {filialConfig?.logoSrc ? (
          <img
            src={filialConfig.logoSrc}
            alt=""
            className="h-5 w-5 rounded-[4px] object-contain bg-background"
          />
        ) : (
          <Building2 className="h-3.5 w-3.5 text-primary" />
        )}
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
