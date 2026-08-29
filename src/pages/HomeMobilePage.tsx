import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, MessageSquare, Settings, ShoppingCart, TrendingUp, Truck } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { ModuleDetailsDialog } from '@/components/common/ModuleDetailsDialog';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';
import { EmpresaSelectorDialog } from '@/components/common/EmpresaSelectorDialog';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { PelegriniBrandMark, PelegriniBranchPanel, PelegriniBranchSwitcher, PelegriniOperationalCard } from '@/components/pelegrini';
import { empresaPossuiFiliais, getFiliaisDaEmpresa } from '@/config/filiaisEmpresa';
import { getPelegriniIdentity, getPelegriniModuleIdentity, type PelegriniModuleKey } from '@/config/pelegriniIdentity';
import { getPelegriniBranchAvailability, pelegriniAdminEntry, pelegriniModules, type PelegriniHomeModule } from '@/config/pelegriniHome';
import { PELEGRINI_THEMES, resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';
import { useUserModulePermissions, type UserModuleKey } from '@/hooks/useUserModulePermissions';

interface ModuleItem extends PelegriniHomeModule {
  icon: React.ComponentType<{ className?: string }>;
  disabled: boolean;
}

const icons: Record<PelegriniHomeModule['accent'], ModuleItem['icon']> = { emerald: MessageSquare, purple: ShoppingCart, orange: Truck, blue: TrendingUp };
const modules: ModuleItem[] = pelegriniModules.map((module) => ({ ...module, icon: icons[module.accent], disabled: false }));

export default function HomeMobilePage() {
  const navigate = useNavigate();
  const branchThemes = [PELEGRINI_THEMES.transmissao, PELEGRINI_THEMES.chevrolet];
  const { isAuthenticated, logout, canAccessSettings, codEmpresa: codEmpresaUsuario, profile } = useAuth();
  const { isMaster, hasModulo } = useEmpresaConfig();
  const { permissions, hasUserModuleAccess } = useUserModulePermissions();
  const { clearFilial, codEmpresaContexto, filialAtiva, setFilialAtivaForEmpresa } = useFilialSelecionada();
  const homeTheme = resolvePelegriniTheme(filialAtiva || 'transmissao');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedModuleForDetails, setSelectedModuleForDetails] = useState<ModuleItem | null>(null);
  const [filialDialogOpen, setFilialDialogOpen] = useState(false);
  const [filialTargetPath, setFilialTargetPath] = useState('');
  const [empresaSelectorOpen, setEmpresaSelectorOpen] = useState(false);
  const [selectedModulePath, setSelectedModulePath] = useState('');
  const [selectedModuloKey, setSelectedModuloKey] = useState<UserModuleKey | undefined>();
  const codEmpresaParaFilial = isMaster ? null : codEmpresaUsuario;
  const branchAvailability = getPelegriniBranchAvailability({
    codEmpresa: codEmpresaContexto,
    isMaster,
    filiaisPermitidas: profile?.filiais_permitidas,
    filialPadrao: profile?.filial_id,
  });

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
    if (isMaster) { setSelectedModulePath(module.moduloKey === 'financeiro' ? module.path : targetPath); setSelectedModuloKey(module.moduloKey); setEmpresaSelectorOpen(true); return; }
    if (module.moduloKey === 'comercial' && empresaPossuiFiliais(codEmpresaParaFilial) && getFiliaisDaEmpresa(codEmpresaParaFilial).length > 1) { clearFilial(); setFilialTargetPath(targetPath); setFilialDialogOpen(true); return; }
    navigate(targetPath);
  };

  const handleBranchSelect = (filialId: string) => {
    setFilialAtivaForEmpresa(codEmpresaContexto, filialId);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-background safe-area-top"><div className="flex items-center justify-between gap-3 px-4 py-3"><PelegriniBrandMark theme={homeTheme} compact /><div className="flex shrink-0 items-center gap-2"><ThemeToggle />{isAuthenticated ? <div className="flex items-center gap-1">{canAccessSettings && <Button variant="ghost" size="icon" onClick={() => navigate('/configuracoes')} className="h-9 w-9"><Settings className="h-4 w-4" /></Button>}<Button variant="ghost" size="icon" onClick={logout} className="h-9 w-9"><LogOut className="h-4 w-4" /></Button></div> : <LoginDialog />}</div></div><div className="px-4 pb-3"><PelegriniBranchSwitcher className="w-full" variant="header" /></div></header>
      <main className="space-y-5 px-4 py-4">
        <section className="border-b border-border pb-4"><p className="text-xs font-semibold uppercase text-primary">Central CT/CCH</p><h1 className="mt-1 text-xl font-bold leading-tight text-foreground">Acesse sua operação</h1><p className="mt-1 text-sm text-muted-foreground">Escolha a filial e o módulo.</p></section>
        <section aria-labelledby="mobile-branches-title"><div className="mb-3 flex items-center justify-between gap-3"><h2 id="mobile-branches-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Filiais</h2><span className="text-xs text-muted-foreground">Contexto da operacao</span></div><div className="grid gap-3">{branchThemes.map((theme) => { const identity = getPelegriniIdentity(theme.key); const disabled = !branchAvailability[theme.key]; const unavailableDescription = codEmpresaContexto ? `${identity.selectorDescription} Acesso a esta filial nao esta liberado.` : `${identity.selectorDescription} Selecione uma empresa para liberar as filiais.`; return <PelegriniBranchPanel key={theme.key} theme={theme} active={filialAtiva === theme.key} indicators={identity.microIndicators} description={disabled ? unavailableDescription : identity.selectorDescription} onSelect={disabled ? undefined : () => handleBranchSelect(theme.key)} disabled={disabled} />; })}</div></section>
        <section aria-labelledby="mobile-modules-title"><div className="mb-3 flex items-center justify-between gap-3"><h2 id="mobile-modules-title" className="text-sm font-semibold uppercase text-muted-foreground">Módulos</h2><span className="text-xs text-muted-foreground">Acesso rápido</span></div><div className="grid gap-3">{modules.filter((module) => !isAuthenticated || isMaster || module.disabled || (hasModulo(module.moduloKey) && hasUserModuleAccess(module.moduloKey))).map((module) => { const identity = getPelegriniModuleIdentity(module.moduloKey as PelegriniModuleKey); return <PelegriniOperationalCard className="home-module-card" key={module.title} title={module.title} label={identity.operationalLabel} description={identity.description} tags={identity.tags.slice(0, 2)} accent={identity.key} onClick={module.disabled ? undefined : () => handleModuleClick(module)} disabled={module.disabled} />; })}</div></section>
        {canAccessSettings && <section className="border-t border-border pt-5" aria-labelledby="mobile-admin-title"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Administracao</p><button type="button" onClick={() => navigate(pelegriniAdminEntry.path)} className="mt-3 w-full border border-border bg-card p-4 text-left shadow-sm"><h2 id="mobile-admin-title" className="text-base font-semibold text-foreground">{pelegriniAdminEntry.title}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{pelegriniAdminEntry.description}</p></button></section>}
      </main>
      <ModuleDetailsDialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen} module={selectedModuleForDetails} />
      <FilialSelectorDialog open={filialDialogOpen} onOpenChange={setFilialDialogOpen} codEmpresa={codEmpresaParaFilial} required onConfirm={() => { setFilialDialogOpen(false); navigate(filialTargetPath); }} />
      <EmpresaSelectorDialog open={empresaSelectorOpen} onOpenChange={setEmpresaSelectorOpen} targetPath={selectedModulePath} moduloKey={selectedModuloKey} />
      <MobileBottomNav />
    </div>
  );
}
