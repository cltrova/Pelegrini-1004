import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, MessageSquare, Settings, ShoppingCart, TrendingUp, Truck } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { ModuleDetailsDialog } from '@/components/common/ModuleDetailsDialog';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';
import { Button } from '@/components/ui/button';
import { PelegriniBrandMark, PelegriniOperationalCard, PelegriniPageHeader } from '@/components/pelegrini';
import { getPelegriniModuleIdentity, type PelegriniModuleKey } from '@/config/pelegriniIdentity';
import { pelegriniAdminEntry, pelegriniModules, type PelegriniHomeModule } from '@/config/pelegriniHome';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaSelecionada } from '@/contexts/EmpresaSelecionadaContext';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';

interface ModuleItem extends PelegriniHomeModule {
  icon: React.ComponentType<{ className?: string }>;
  disabled: boolean;
}

interface PendingModuleNavigation {
  path: string;
  moduleKey: PelegriniModuleKey;
}

const icons: Record<PelegriniHomeModule['accent'], ModuleItem['icon']> = { emerald: MessageSquare, purple: ShoppingCart, orange: Truck, blue: TrendingUp };
const modules: ModuleItem[] = pelegriniModules.map((module) => ({ ...module, icon: icons[module.accent], disabled: false }));

export default function HomeMobilePage() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, canAccessSettings, codEmpresa: codEmpresaUsuario } = useAuth();
  const { isMaster, hasModulo } = useEmpresaConfig();
  const { permissions, hasUserModuleAccess } = useUserModulePermissions();
  const { filialAtiva } = useFilialSelecionada();
  const { setEmpresaSelecionada } = useEmpresaSelecionada();
  const homeTheme = resolvePelegriniTheme(filialAtiva || 'transmissao');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedModuleForDetails, setSelectedModuleForDetails] = useState<ModuleItem | null>(null);
  const [pendingModuleNavigation, setPendingModuleNavigation] = useState<PendingModuleNavigation | null>(null);
  const codEmpresaParaFilial = isMaster ? '1004' : codEmpresaUsuario;

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
    if (module.disabled) return;
    if (!isAuthenticated || !hasFullAccess) { setSelectedModuleForDetails(module); setDetailsDialogOpen(true); return; }
    const targetPath = module.moduloKey === 'financeiro' ? getFinanceiroEntryPath() : module.path;
    if (isMaster) setEmpresaSelecionada('1004');
    setPendingModuleNavigation({ path: targetPath, moduleKey: module.moduloKey as PelegriniModuleKey });
  };

  return (
    <div
      className="min-h-screen min-w-0 max-w-full overflow-x-clip bg-background pb-6"
      data-pelegrini-theme={homeTheme.key}
      style={{
        '--pelegrini-primary': homeTheme.primary,
        '--pelegrini-secondary': homeTheme.secondary,
        '--pelegrini-accent': homeTheme.accent,
      } as CSSProperties}
    >
      <header className="sticky top-0 z-40 border-b border-border bg-background safe-area-top"><div className="flex min-w-0 items-center justify-between gap-2 px-4 py-2"><PelegriniBrandMark theme={homeTheme} compact /><div className="flex shrink-0 items-center gap-1"><div className="h-11 w-11 [&>button]:h-full [&>button]:w-full"><ThemeToggle /></div>{isAuthenticated ? <Button variant="ghost" size="icon" onClick={logout} className="h-11 w-11" aria-label="Sair"><LogOut className="h-4 w-4" /></Button> : <div className="min-h-11 [&>button]:min-h-11"><LoginDialog /></div>}</div></div></header>
      <main className="min-w-0 max-w-full space-y-5 px-4 py-4">
        <PelegriniPageHeader title="Módulos" eyebrow={homeTheme.shortName} />
        <section className="min-w-0 max-w-full" aria-labelledby="mobile-modules-title"><h2 id="mobile-modules-title" className="sr-only">Módulos disponíveis</h2><div className="grid min-w-0 w-full max-w-full gap-3" data-home-modules>{modules.filter((module) => !isAuthenticated || isMaster || module.disabled || (hasModulo(module.moduloKey) && hasUserModuleAccess(module.moduloKey))).map((module) => { const identity = getPelegriniModuleIdentity(module.moduloKey as PelegriniModuleKey); return <PelegriniOperationalCard className="home-module-card" key={module.title} title={module.title} label={identity.operationalLabel} description={identity.description} tags={identity.tags.slice(0, 2)} accent={identity.key} icon={module.icon} onClick={module.disabled ? undefined : () => handleModuleClick(module)} disabled={module.disabled} />; })}</div></section>
        {canAccessSettings && <section className="border-t border-border pt-3" aria-labelledby="mobile-admin-title"><button type="button" onClick={() => navigate(pelegriniAdminEntry.path)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><h2 id="mobile-admin-title" className="text-sm font-semibold">{pelegriniAdminEntry.title}</h2><Settings className="h-4 w-4" /></button></section>}
      </main>
      <ModuleDetailsDialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen} module={selectedModuleForDetails} />
      <FilialSelectorDialog open={pendingModuleNavigation !== null} onOpenChange={(open) => { if (!open) setPendingModuleNavigation(null); }} codEmpresa={codEmpresaParaFilial} required={false} onConfirm={() => { const targetPath = pendingModuleNavigation?.path; setPendingModuleNavigation(null); if (targetPath) navigate(targetPath); }} />
    </div>
  );
}
