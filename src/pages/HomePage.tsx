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
import { PelegriniBrandMark, PelegriniOperationalCard, PelegriniPageHeader } from '@/components/pelegrini';
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

interface PendingModuleNavigation {
  path: string;
  moduleKey: PelegriniModuleKey;
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
  const [pendingModuleNavigation, setPendingModuleNavigation] = useState<PendingModuleNavigation | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedModuleForDetails, setSelectedModuleForDetails] = useState<ModuleItem | null>(null);
  const codEmpresaParaFilial = isMaster ? '1004' : codEmpresaUsuario;

  useEffect(() => {
    if (isAuthenticated && isVendedor) navigate('/whatsapp');
  }, [isAuthenticated, isVendedor, navigate]);

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
    if (isMaster) setEmpresaSelecionada('1004');
    setPendingModuleNavigation({ path: targetPath, moduleKey: module.moduloKey as PelegriniModuleKey });
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
              <span className="hidden text-sm text-muted-foreground xl:inline">{user?.email}</span>
              <Button variant="outline" size="sm" onClick={logout} className="gap-2"><LogOut className="h-4 w-4" /><span className="hidden md:inline">Sair</span></Button>
            </div> : <LoginDialog />}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        <PelegriniPageHeader title="Módulos" eyebrow={homeTheme.shortName} />

        <div className="mt-4 min-w-0">
          <section aria-labelledby="home-modules-title">
            <h2 id="home-modules-title" className="sr-only">Módulos disponíveis</h2>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2" data-home-modules>{modules.filter((module) => !isAuthenticated || isMaster || module.disabled || (hasModulo(module.moduloKey) && hasUserModuleAccess(module.moduloKey))).map((module) => {
              const identity = getPelegriniModuleIdentity(module.moduloKey as PelegriniModuleKey);
              return <PelegriniOperationalCard className="home-module-card" key={module.title} title={module.title} label={identity.operationalLabel} description={identity.description} tags={identity.tags.slice(0, 2)} accent={identity.key} icon={module.icon} onClick={module.disabled ? undefined : () => handleModuleClick(module)} disabled={module.disabled} />;
            })}</div>
          </section>
        </div>

        {canAccessSettings && <section className="mt-5 border-t border-border pt-3" aria-labelledby="home-admin-title"><button type="button" onClick={() => navigate(pelegriniAdminEntry.path)} className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-3 text-left text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><h2 id="home-admin-title" className="text-sm font-semibold">{pelegriniAdminEntry.title}</h2><Settings className="h-4 w-4" /></button></section>}
      </main>

      <ModuleDetailsDialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen} module={selectedModuleForDetails} />
      <FilialSelectorDialog open={pendingModuleNavigation !== null} onOpenChange={(open) => { if (!open) setPendingModuleNavigation(null); }} codEmpresa={codEmpresaParaFilial} required={false} onConfirm={() => { const targetPath = pendingModuleNavigation?.path; setPendingModuleNavigation(null); if (targetPath) navigate(targetPath); }} />
    </div>
  );
}
