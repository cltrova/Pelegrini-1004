import { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ComercialSidebar } from './ComercialSidebar';
import { ComercialMobileLayout } from './ComercialMobileLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { Button } from '@/components/ui/button';
import { Loader2, Building2, Lock } from 'lucide-react';
import { getFilialAccessState } from '@/utils/filialAccess';
import { useAuth } from '@/contexts/AuthContext';
import { PelegriniModuleShell } from '@/components/pelegrini';

export function ComercialLayout() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { filialAtiva, codEmpresaContexto, clearFilial, setFilialAtivaForEmpresa, empresaPossuiFiliaisAtiva } = useFilialSelecionada();
  const { isMaster, profile } = useAuth() as any;
  const mountClearedRef = useRef(false);
  const filialAccess = getFilialAccessState({
    codEmpresa: codEmpresaContexto,
    isMaster,
    filiaisPermitidas: profile?.filiais_permitidas as string[] | null | undefined,
    filialPadrao: profile?.filial_id as string | null | undefined,
  });
  const filiais = filialAccess.items;

  // Apenas limpa a filial ao SAIR do módulo (a seleção é feita na home antes de entrar).
  useEffect(() => {
    mountClearedRef.current = true;
    return () => {
      if (empresaPossuiFiliaisAtiva) clearFilial();
      mountClearedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codEmpresaContexto, empresaPossuiFiliaisAtiva]);

  // Bloqueio: se entrar sem filial selecionada (ex.: deep-link), abre o modal e bloqueia o conteúdo.
  const bloquearConteudo = empresaPossuiFiliaisAtiva && !filialAtiva;

  const placeholder = (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6 animate-in fade-in duration-300">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner">
        <Building2 className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Selecione uma filial para continuar</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Os dados do módulo Comercial são exclusivos por filial. Escolha uma unidade no painel ao lado.
        </p>
      </div>
      <div className="grid w-full max-w-md gap-2">
        {filiais.map((filial) => (
          <Button
            key={filial.id}
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3 text-left"
            disabled={filial.blocked}
            onClick={() => setFilialAtivaForEmpresa(codEmpresaContexto, filial.id)}
          >
            {filial.blocked ? (
              <Lock className="h-4 w-4 text-amber-500" />
            ) : (
              <Building2 className="h-4 w-4 text-primary" />
            )}
            <span className="font-medium">{filial.nome}</span>
            {filial.blocked && <span className="ml-auto text-xs text-amber-500">Bloqueada</span>}
          </Button>
        ))}
      </div>
      {!filialAccess.hasAnyAccess && (
        <p className="text-xs text-amber-500 max-w-sm">
          Nenhuma filial foi liberada para seu usuário. Peça ao master para ajustar seu acesso em Configurações.
        </p>
      )}
      <Button variant="ghost" size="sm" onClick={() => navigate('/')}>Voltar aos módulos</Button>
      {filiais.length === 0 && <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />}
    </div>
  );

  // No mobile, usar layout específico estilo app
  if (isMobile) {
    return (
      <>
        {bloquearConteudo ? (
          <div className="min-h-screen bg-background">{placeholder}</div>
        ) : (
          <ComercialMobileLayout />
        )}
      </>
    );
  }

  // Desktop: layout com sidebar
  return (
    <PelegriniModuleShell sidebar={<ComercialSidebar />} moduleKey="comercial">
      {bloquearConteudo ? placeholder : <Outlet />}
    </PelegriniModuleShell>
  );
}

