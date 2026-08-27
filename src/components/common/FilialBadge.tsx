import { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';
import { getFilialPorId } from '@/config/filiaisEmpresa';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';

export function FilialBadge() {
  const { empresaPossuiFiliaisAtiva, filialNome, codEmpresaContexto, filialAtiva } = useFilialSelecionada();
  const [open, setOpen] = useState(false);
  const filialConfig = getFilialPorId(codEmpresaContexto, filialAtiva);
  const theme = resolvePelegriniTheme(filialAtiva);

  if (!empresaPossuiFiliaisAtiva) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        style={{
          '--pelegrini-accent': theme.accent,
        } as React.CSSProperties}
        className="gap-2 h-8 text-xs border-primary/20 bg-card/70 hover:border-primary/40 hover:shadow-md"
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
