import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, MessageSquare, Settings, ShoppingCart, TrendingUp, Truck } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { ModuleDetailsDialog } from '@/components/common/ModuleDetailsDialog';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { PelegriniBrandMark, PelegriniOperationalCard } from '@/components/pelegrini';
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
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-background safe-area-top"><div className="flex items-center justify-between gap-3 px-4 py-3"><PelegriniBrandMark theme={homeTheme} compact /><div className="flex shrink-0 items-center gap-2"><ThemeToggle />{isAuthenticated ? <div className="flex items-center gap-1">{canAccessSettings && <Button variant="ghost" size="icon" onClick={() => navigate('/configuracoes')} className="h-9 w-9"><Settings className="h-4 w-4" /></Button>}<Button variant="ghost" size="icon" onClick={logout} className="h-9 w-9"><LogOut className="h-4 w-4" /></Button></div> : <LoginDialog />}</div></div></header>
      <main className="space-y-5 px-4 py-4">
        <section className="border-b border-border pb-4"><h1 className="text-xl font-bold leading-tight text-foreground">Módulos</h1></section>
        <section aria-labelledby="mobile-modules-title"><h2 id="mobile-modules-title" className="sr-only">Módulos disponíveis</h2><div className="grid gap-3">{modules.filter((module) => !isAuthenticated || isMaster || module.disabled || (hasModulo(module.moduloKey) && hasUserModuleAccess(module.moduloKey))).map((module) => { const identity = getPelegriniModuleIdentity(module.moduloKey as PelegriniModuleKey); return <PelegriniOperationalCard className="home-module-card" key={module.title} title={module.title} label={identity.operationalLabel} description={identity.description} tags={identity.tags.slice(0, 2)} accent={identity.key} onClick={module.disabled ? undefined : () => handleModuleClick(module)} disabled={module.disabled} />; })}</div></section>
        {canAccessSettings && <section className="border-t border-border pt-5" aria-labelledby="mobile-admin-title"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Administracao</p><button type="button" onClick={() => navigate(pelegriniAdminEntry.path)} className="mt-3 w-full border border-border bg-card p-4 text-left shadow-sm"><h2 id="mobile-admin-title" className="text-base font-semibold text-foreground">{pelegriniAdminEntry.title}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{pelegriniAdminEntry.description}</p></button></section>}
      </main>
      <ModuleDetailsDialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen} module={selectedModuleForDetails} />
      <FilialSelectorDialog open={pendingModuleNavigation !== null} onOpenChange={(open) => { if (!open) setPendingModuleNavigation(null); }} codEmpresa={codEmpresaParaFilial} required={false} onConfirm={() => { const targetPath = pendingModuleNavigation?.path; setPendingModuleNavigation(null); if (targetPath) navigate(targetPath); }} />
      <MobileBottomNav />
    </div>
  );
}
