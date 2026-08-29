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
import { getPelegriniBranchAvailability, pelegriniAdminEntry, pelegriniModules, type PelegriniHomeModule } from '@/config/pelegriniHome';
import { PELEGRINI_THEMES, resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark, PelegriniBranchPanel, PelegriniBranchSwitcher, PelegriniOperationalCard } from '@/components/pelegrini';
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
  const { isAuthenticated, user, logout, isVendedor, canAccessSettings, codEmpresa: codEmpresaUsuario, profile } = useAuth();
  const isMobile = useIsMobile();
  const { hasModulo, isMaster } = useEmpresaConfig();
  const { permissions, hasUserModuleAccess } = useUserModulePermissions();
  const { clearFilial, codEmpresaContexto, filialAtiva, setFilialAtivaForEmpresa } = useFilialSelecionada();
  const homeTheme = resolvePelegriniTheme(filialAtiva || 'transmissao');
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
  const branchAvailability = getPelegriniBranchAvailability({
    codEmpresa: codEmpresaContexto,
    isMaster,
    filiaisPermitidas: profile?.filiais_permitidas,
    filialPadrao: profile?.filial_id,
  });

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
    <div className="min-h-screen bg-background" data-pelegrini-theme={homeTheme.key}>
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <PelegriniBrandMark theme={homeTheme} className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-3">
            <PelegriniBranchSwitcher className="hidden lg:inline-grid" variant="header" />
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
        <section className="mb-5 flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">Central de gestão CT/CCH</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-foreground sm:text-3xl">Escolha a operação e acesse o módulo</h1>
          </div>
          <p className="max-w-lg text-sm leading-5 text-muted-foreground">Indicadores comerciais, estoque, financeiro e atendimento organizados por filial.</p>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.6fr)]">
          <section aria-labelledby="home-branches-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Contexto</p>
                <h2 id="home-branches-title" className="mt-1 text-lg font-semibold text-foreground">Filial ativa</h2>
              </div>
              <span className="pelegrini-technical-chip">{homeTheme.shortName}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {branchThemes.map((theme) => {
                const identity = getPelegriniIdentity(theme.key);
                const disabled = !branchAvailability[theme.key];
                const unavailableDescription = codEmpresaContexto
                  ? `${identity.selectorDescription} Acesso a esta filial nao esta liberado.`
                  : `${identity.selectorDescription} Selecione uma empresa para liberar as filiais.`;

                return (
                  <PelegriniBranchPanel
                    key={theme.key}
                    theme={theme}
                    active={filialAtiva === theme.key}
                    indicators={identity.microIndicators.slice(0, 2)}
                    description={disabled ? unavailableDescription : identity.selectorDescription}
                    onSelect={disabled ? undefined : () => handleBranchSelect(theme.key)}
                    disabled={disabled}
                  />
                );
              })}
            </div>
          </section>

          <section aria-labelledby="home-modules-title">
            <div className="mb-3 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-muted-foreground">Acesso direto</p><h2 id="home-modules-title" className="mt-1 text-lg font-semibold text-foreground">Módulos da operação</h2></div><span className="text-xs text-muted-foreground">{modules.length} disponíveis</span></div>
            <div className="grid gap-3 sm:grid-cols-2">{modules.filter((module) => !isAuthenticated || isMaster || module.disabled || (hasModulo(module.moduloKey) && hasUserModuleAccess(module.moduloKey))).map((module) => {
              const identity = getPelegriniModuleIdentity(module.moduloKey as PelegriniModuleKey);
              return <PelegriniOperationalCard className="home-module-card" key={module.title} title={module.title} label={identity.operationalLabel} description={identity.description} tags={identity.tags.slice(0, 2)} accent={identity.key} onClick={module.disabled ? undefined : () => handleModuleClick(module)} disabled={module.disabled} />;
            })}</div>
          </section>
        </div>

        {canAccessSettings && <section className="mt-5 border-t border-border pt-4" aria-labelledby="home-admin-title"><button type="button" onClick={() => navigate(pelegriniAdminEntry.path)} className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/40"><div><h2 id="home-admin-title" className="text-sm font-semibold text-foreground">Configurações</h2><p className="mt-0.5 text-xs text-muted-foreground">Empresas, usuários e endpoints</p></div><Settings className="h-4 w-4 text-muted-foreground" /></button></section>}
      </main>

      <ModuleDetailsDialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen} module={selectedModuleForDetails} />
      <EmpresaSelectorDialog open={empresaSelectorOpen} onOpenChange={setEmpresaSelectorOpen} targetPath={selectedModulePath} moduloKey={selectedModuloKey} />
      <FilialSelectorDialog open={filialDialogOpen} onOpenChange={setFilialDialogOpen} codEmpresa={codEmpresaParaFilial} required onConfirm={() => { setFilialDialogOpen(false); navigate(filialTargetPath); }} />
      <footer className="border-t border-border"><div className="mx-auto max-w-7xl px-6 py-4 text-xs text-muted-foreground">{homeIdentity.footerLine}</div></footer>
    </div>
  );
}
