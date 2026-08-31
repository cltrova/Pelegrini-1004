import { ThemeToggle } from '@/components/common/ThemeToggle';
import { PelegriniBrandMark } from '@/components/pelegrini';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';

interface ComercialMobileHeaderProps {
  title?: string;
  subtitle?: string;
}

export function ComercialMobileHeader({ title = 'Comercial' }: ComercialMobileHeaderProps) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva || codEmpresaAtiva);

  return (
    <header className="safe-area-top sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg">
      <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-2.5">
        <PelegriniBrandMark
          theme={theme}
          showTagline={false}
          className="min-w-0 flex-1"
        />
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">{title}</span>
          <div className="h-11 w-11 shrink-0 [&>button]:h-full [&>button]:w-full">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
