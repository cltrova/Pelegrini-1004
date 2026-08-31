import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, MessageSquare, Settings, ShoppingCart, TrendingUp, Truck } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';
import { ModuleDetailsDialog } from '@/components/common/ModuleDetailsDialog';
import { Button } from '@/components/ui/button';
import { getPelegriniModuleIdentity, type PelegriniModuleKey } from '@/config/pelegriniIdentity';
import { pelegriniAdminEntry, pelegriniModules, type PelegriniHomeModule } from '@/config/pelegriniHome';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark, PelegriniOperationalCard } from '@/components/pelegrini';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaSelecionada } from '@/contexts/EmpresaSelecionadaContext';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import HomeMobilePage from './HomeMobilePage';

interface ModuleItem extends PelegriniHomeModule {
  icon: React.ComponentType<{ className?: string }>;
  disabled: boolean;
}

const modulePresentation: Record<PelegriniHomeModule['accent'], ModuleItem['icon']> = {
  emerald: MessageSquare,
  purple: ShoppingCart,
  orange: Truck,
  blue: TrendingUp,
};

const modules: ModuleItem[] = pelegriniModules.map((module) => ({
  ...module,
  icon: modulePresentation[module.accent],
  disabled: false,
}));

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, isVendedor, canAccessSettings, codEmpresa: codEmpresaUsuario } = useAuth();
  const isMobile = useIsMobile();
  const { hasModulo, isMaster } = useEmpresaConfig();
  const { permissions, hasUserModuleAccess } = useUserModulePermissions();
  const { filialAtiva } = useFilialSelecionada();
  const { setEmpresaSelecionada } = useEmpresaSelecionada();
  const homeTheme = resolvePelegriniTheme(filialAtiva || 'transmissao');
  const [filialDialogOpen, setFilialDialogOpen] = useState(false);
  const [filialTargetPath, setFilialTargetPath] = useState('');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedModuleForDetails, setSelectedModuleForDetails] = useState<ModuleItem | null>(null);
  const codEmpresaParaFilial = isMaster ? '1004' : codEmpresaUsuario;

  useEffect(() => {
    if (isAuthenticated && isVendedor) navigate('/whatsapp');
  }, [isAuthenticated, isVendedor, navigate]);

  useEffect(() => {
    if (!isAuthenticated || isVendedor) return;
    if (isMaster) setEmpresaSelecionada('1004');
    setFilialDialogOpen(true);
  }, [isAuthenticated, isMaster, isVendedor, setEmpresaSelecionada]);

  const getFinanceiroEntryPath = () => {
    if ((permissions?.modulo_resumo || isMaster) && hasModulo('resumo')) return '/financeiro/resumo';
    if ((permissions?.modulo_dre || isMaster) && hasModulo('dre')) return '/financeiro/dre';
    if ((permissions?.modulo_variacao || isMaster) && hasModulo('variacao')) return '/financeiro/variacao';
    return '/financeiro/resumo';
  };

  const handleModuleClick = (module: ModuleItem) => {
    const hasEmpresaAccess = module.moduloKey ? hasModulo(module.moduloKey) : true;
    const hasUserAccess = hasUserModuleAccess(module.moduloKey);
    const hasFullAccess = isMaster || (hasEmpresaAccess && hasUserAccess);
    if (!isAuthenticated || !hasFullAccess) {
      setSelectedModuleForDetails(module);
      setDetailsDialogOpen(true);
      return;
    }
    if (module.disabled) return;
    const targetPath = module.moduloKey === 'financeiro' ? getFinanceiroEntryPath() : module.path;
    if (!filialAtiva) {
      if (isMaster) setEmpresaSelecionada('1004');
      setFilialTargetPath(targetPath);
      setFilialDialogOpen(true);
      return;
    }
    navigate(targetPath);
  };

  if (isMobile) return <HomeMobilePage />;

  return (
    <div className="min-h-screen bg-background" data-pelegrini-theme={homeTheme.key}>
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <PelegriniBrandMark theme={homeTheme} className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle />
            {isAuthenticated ? <div className="flex items-center gap-2">
              {canAccessSettings && <Button variant="ghost" size="sm" onClick={() => navigate('/configuracoes')} className="gap-2 text-muted-foreground hover:text-foreground"><Settings className="h-4 w-4" /><span className="hidden lg:inline">Configuracoes</span></Button>}
              <span className="hidden text-sm text-muted-foreground xl:inline">{user?.email}</span>
              <Button variant="outline" size="sm" onClick={logout} className="gap-2"><LogOut className="h-4 w-4" /><span className="hidden md:inline">Sair</span></Button>
            </div> : <LoginDialog />}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        <section className="mb-5 border-b border-border pb-5">
          <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">Módulos</h1>
        </section>

        <div>
          <section aria-labelledby="home-modules-title">
            <h2 id="home-modules-title" className="sr-only">Módulos disponíveis</h2>
            <div className="grid gap-3 sm:grid-cols-2">{modules.filter((module) => !isAuthenticated || isMaster || module.disabled || (hasModulo(module.moduloKey) && hasUserModuleAccess(module.moduloKey))).map((module) => {
              const identity = getPelegriniModuleIdentity(module.moduloKey as PelegriniModuleKey);
              return <PelegriniOperationalCard className="home-module-card" key={module.title} title={module.title} label={identity.operationalLabel} description={identity.description} tags={identity.tags.slice(0, 2)} accent={identity.key} onClick={module.disabled ? undefined : () => handleModuleClick(module)} disabled={module.disabled} />;
            })}</div>
          </section>
        </div>

        {canAccessSettings && <section className="mt-5 border-t border-border pt-4" aria-labelledby="home-admin-title"><button type="button" onClick={() => navigate(pelegriniAdminEntry.path)} className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/40"><div><h2 id="home-admin-title" className="text-sm font-semibold text-foreground">Configurações</h2><p className="mt-0.5 text-xs text-muted-foreground">Empresas, usuários e endpoints</p></div><Settings className="h-4 w-4 text-muted-foreground" /></button></section>}
      </main>

      <ModuleDetailsDialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen} module={selectedModuleForDetails} />
      <FilialSelectorDialog open={filialDialogOpen} onOpenChange={setFilialDialogOpen} codEmpresa={codEmpresaParaFilial} required onConfirm={() => { setFilialDialogOpen(false); if (filialTargetPath) navigate(filialTargetPath); }} />
    </div>
  );
}
