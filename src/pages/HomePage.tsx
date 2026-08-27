import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, MessageSquare, Settings, ShoppingCart, TrendingUp, Truck } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { EmpresaSelectorDialog } from '@/components/common/EmpresaSelectorDialog';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';
import { ModuleDetailsDialog } from '@/components/common/ModuleDetailsDialog';
import { Button } from '@/components/ui/button';
import { empresaPossuiFiliais, getFiliaisDaEmpresa } from '@/config/filiaisEmpresa';
import { getPelegriniIdentity, getPelegriniModuleIdentity, type PelegriniModuleKey } from '@/config/pelegriniIdentity';
import { pelegriniAdminEntry, pelegriniModules, type PelegriniHomeModule } from '@/config/pelegriniHome';
import { PELEGRINI_THEMES, resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark, PelegriniBranchPanel, PelegriniMotionBackdrop, PelegriniOperationalCard } from '@/components/pelegrini';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserModulePermissions, type UserModuleKey } from '@/hooks/useUserModulePermissions';
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
  const { clearFilial, codEmpresaContexto, filialAtiva, setFilialAtivaForEmpresa } = useFilialSelecionada();
  const homeTheme = resolvePelegriniTheme(filialAtiva);
  const homeIdentity = getPelegriniIdentity(homeTheme.key);
  const branchThemes = [PELEGRINI_THEMES.transmissao, PELEGRINI_THEMES.chevrolet];
  const [empresaSelectorOpen, setEmpresaSelectorOpen] = useState(false);
  const [selectedModulePath, setSelectedModulePath] = useState('');
  const [selectedModuloKey, setSelectedModuloKey] = useState<UserModuleKey | undefined>();
  const [filialDialogOpen, setFilialDialogOpen] = useState(false);
  const [filialTargetPath, setFilialTargetPath] = useState('');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedModuleForDetails, setSelectedModuleForDetails] = useState<ModuleItem | null>(null);
  const codEmpresaParaFilial = isMaster ? null : codEmpresaUsuario;

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
    if (isMaster) {
      setSelectedModulePath(module.moduloKey === 'financeiro' ? module.path : targetPath);
      setSelectedModuloKey(module.moduloKey);
      setEmpresaSelectorOpen(true);
      return;
    }
    if (module.moduloKey === 'comercial' && empresaPossuiFiliais(codEmpresaParaFilial) && getFiliaisDaEmpresa(codEmpresaParaFilial).length > 1) {
      clearFilial();
      setFilialTargetPath(targetPath);
      setFilialDialogOpen(true);
      return;
    }
    navigate(targetPath);
  };

  const handleBranchSelect = (filialId: string) => {
    setFilialAtivaForEmpresa(codEmpresaContexto, filialId);
  };

  if (isMobile) return <HomeMobilePage />;

  return (
    <div className="min-h-screen bg-background">
      <PelegriniMotionBackdrop theme={homeTheme} intensity="soft" />
      <header className="sticky top-0 z-50 border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <PelegriniBrandMark theme={homeTheme} />
          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle />
            {isAuthenticated ? <div className="flex items-center gap-2">
              {canAccessSettings && <Button variant="ghost" size="sm" onClick={() => navigate('/configuracoes')} className="gap-2 text-muted-foreground hover:text-foreground"><Settings className="h-4 w-4" /><span className="hidden lg:inline">Configuracoes</span></Button>}
              <span className="hidden text-sm text-muted-foreground md:inline">{user?.email}</span>
              <Button variant="outline" size="sm" onClick={logout} className="gap-2"><LogOut className="h-4 w-4" /><span className="hidden md:inline">Sair</span></Button>
            </div> : <LoginDialog />}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-6 py-6">
        <section className="pelegrini-command-board relative mb-6 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm">
          <PelegriniMotionBackdrop theme={homeTheme} intensity="strong" className="opacity-30" />
          <div className="relative grid gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{homeIdentity.eyebrow}</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight text-foreground">{homeIdentity.heroTitle}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{homeIdentity.operatingLine}</p>
              <div className="mt-5 flex flex-wrap gap-2">{homeIdentity.microIndicators.map((indicator) => <span key={indicator} className="border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground">{indicator}</span>)}</div>
            </div>
            <div className="grid gap-3">
              {branchThemes.map((theme) => {
                const identity = getPelegriniIdentity(theme.key);

                return (
                  <PelegriniBranchPanel
                    key={theme.key}
                    theme={theme}
                    active={filialAtiva === theme.key}
                    indicators={identity.microIndicators}
                    description={identity.selectorDescription}
                    onSelect={() => handleBranchSelect(theme.key)}
                  />
                );
              })}
            </div>
          </div>
        </section>

        <section aria-labelledby="home-modules-title">
          <div className="mb-3 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Acesso operacional</p><h2 id="home-modules-title" className="mt-1 text-xl font-semibold text-foreground">Modulos da operacao</h2></div><span className="text-sm text-muted-foreground">{modules.length} modulos</span></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{modules.filter((module) => !isAuthenticated || isMaster || module.disabled || (hasModulo(module.moduloKey) && hasUserModuleAccess(module.moduloKey))).map((module) => {
            const identity = getPelegriniModuleIdentity(module.moduloKey as PelegriniModuleKey);
            return <PelegriniOperationalCard key={module.title} title={module.title} label={identity.operationalLabel} description={identity.description} tags={identity.tags} accent={identity.key} onClick={() => handleModuleClick(module)} className={module.disabled ? 'cursor-not-allowed opacity-50' : undefined} />;
          })}</div>
        </section>

        {canAccessSettings && <section className="mt-6 border-t border-border pt-5" aria-labelledby="home-admin-title"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Administracao</p><button type="button" onClick={() => navigate(pelegriniAdminEntry.path)} className="mt-3 flex w-full items-center justify-between gap-4 border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40"><div><h2 id="home-admin-title" className="text-base font-semibold text-foreground">{pelegriniAdminEntry.title}</h2><p className="mt-1 text-sm text-muted-foreground">{pelegriniAdminEntry.description}</p></div><span className="hidden flex-wrap justify-end gap-2 sm:flex">{pelegriniAdminEntry.features.map((feature) => <span key={feature} className="border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">{feature}</span>)}</span></button></section>}
      </main>

      <ModuleDetailsDialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen} module={selectedModuleForDetails} />
      <EmpresaSelectorDialog open={empresaSelectorOpen} onOpenChange={setEmpresaSelectorOpen} targetPath={selectedModulePath} moduloKey={selectedModuloKey} />
      <FilialSelectorDialog open={filialDialogOpen} onOpenChange={setFilialDialogOpen} codEmpresa={codEmpresaParaFilial} required onConfirm={() => { setFilialDialogOpen(false); navigate(filialTargetPath); }} />
      <footer className="border-t border-border"><div className="mx-auto max-w-7xl px-6 py-4 text-xs text-muted-foreground">{homeIdentity.footerLine}</div></footer>
    </div>
  );
}
