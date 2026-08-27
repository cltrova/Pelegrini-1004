import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  ShoppingCart, 
  Truck, 
  Settings, 
  Lock, 
  ArrowRight, 
  Sparkles,
  Activity,
  Layers,
  Zap,
  LogOut,
  Info,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { EmpresaSelectorDialog } from '@/components/common/EmpresaSelectorDialog';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';
import { empresaPossuiFiliais, getFiliaisDaEmpresa } from '@/config/filiaisEmpresa';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { ModuleDetailsDialog } from '@/components/common/ModuleDetailsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';
import { useUserModulePermissions, type UserModuleKey } from '@/hooks/useUserModulePermissions';
import { pelegriniAdminEntry, pelegriniBrand, pelegriniModules, type PelegriniHomeModule } from '@/config/pelegriniHome';
import { PELEGRINI_THEMES, resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark, PelegriniBranchBadge, PelegriniMotionBackdrop } from '@/components/pelegrini';
import HomeMobilePage from './HomeMobilePage';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  features: string[];
  disabled?: boolean;
  locked?: boolean;
  noAccess?: boolean;
  index: number;
  moduloKey?: UserModuleKey;
  onMasterClick?: (path: string, moduloKey?: UserModuleKey) => void;
  isMaster?: boolean;
  onShowDetails?: () => void;
  onInterceptClick?: (path: string, moduloKey?: UserModuleKey) => boolean;
}

const modulePresentation: Record<
  PelegriniHomeModule['accent'],
  Pick<ModuleCardProps, 'icon'>
> = {
  emerald: {
    icon: MessageSquare,
  },
  purple: {
    icon: ShoppingCart,
  },
  orange: {
    icon: Truck,
  },
  blue: {
    icon: TrendingUp,
  },
};

const modules: Omit<ModuleCardProps, 'index' | 'noAccess' | 'onMasterClick' | 'isMaster' | 'onShowDetails' | 'locked'>[] =
  pelegriniModules.map((module) => ({
    ...module,
    ...modulePresentation[module.accent],
    disabled: false,
  }));

function ModuleCard({ 
  title, 
  description, 
  icon: Icon, 
  path, 
  features,
  disabled,
  locked,
  noAccess,
  index,
  moduloKey,
  onMasterClick,
  isMaster,
  onShowDetails,
  onInterceptClick,
}: ModuleCardProps) {
  const navigate = useNavigate();
  
  // Bloqueia interação se módulo está desabilitado (Em breve)
  const isDisabledModule = disabled;
  // Se não tem acesso OU é visitante, mostra o dialog de detalhes ao clicar
  const shouldShowDetails = locked || noAccess;

  const handleClick = () => {
    // Se não autenticado (locked) OU não tem acesso, abre o dialog de detalhes
    if (shouldShowDetails && onShowDetails) {
      onShowDetails();
      return;
    }
    
    // Se módulo desabilitado ("Em breve"), não faz nada
    if (isDisabledModule) return;
    
    // Se for master e módulo tem chave de módulo, abre seletor de empresa
    if (isMaster && moduloKey && onMasterClick) {
      onMasterClick(path, moduloKey);
      return;
    }

    // Intercepta para módulos que precisam de seleção extra (ex: filial Comercial)
    if (onInterceptClick && onInterceptClick(path, moduloKey)) return;

    navigate(path);
  };

  // Determina o estado do badge
  const getBadge = () => {
    if (locked) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-white/10 backdrop-blur-sm text-primary text-xs font-semibold shadow-sm">
          <Info className="h-3 w-3" />
          Saiba mais
        </div>
      );
    }
    if (isDisabledModule) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 backdrop-blur-sm text-muted-foreground text-xs font-medium">
          <Lock className="h-3 w-3" />
          Em breve
        </div>
      );
    }
    if (noAccess) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-white/10 backdrop-blur-sm text-amber-600 dark:text-amber-400 text-xs font-semibold shadow-sm">
          <Info className="h-3 w-3" />
          Saiba mais
        </div>
      );
    }
    return null;
  };

  // Accent color por módulo inspirado nas identidades das filiais.
  const accentMap: Record<string, { border: string; text: string; glow: string; rgb: string }> = {
    WhatsApp: { border: 'hover:border-cyan-500/40', text: 'text-cyan-400', glow: 'group-hover:shadow-cyan-500/20', rgb: '34,199,232' },
    Comercial: { border: 'hover:border-blue-500/40', text: 'text-blue-400', glow: 'group-hover:shadow-blue-500/20', rgb: '3,78,153' },
    Operacional: { border: 'hover:border-sky-500/40', text: 'text-sky-400', glow: 'group-hover:shadow-sky-500/20', rgb: '73,210,255' },
    Financeiro: { border: 'hover:border-emerald-500/40', text: 'text-emerald-400', glow: 'group-hover:shadow-emerald-500/20', rgb: '16,185,129' },
  };
  const accent = accentMap[title] ?? accentMap['Financeiro'];

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <button
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      disabled={isDisabledModule}
      className={cn(
        'group relative w-full text-left animate-fade-in',
        isDisabledModule && 'cursor-not-allowed'
      )}
      style={{ animationDelay: `${index * 100}ms` } as React.CSSProperties}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl p-6 h-full transition-all duration-500',
          'bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl',
          'border border-border/60 dark:border-white/10',
          !isDisabledModule && `hover:-translate-y-1 hover:shadow-2xl ${accent.border} ${accent.glow}`,
          isDisabledModule && 'opacity-60'
        )}
        style={{
          // Spotlight do cursor
          backgroundImage: !isDisabledModule
            ? `radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgba(${accent.rgb}, 0.10), transparent 40%)`
            : undefined,
        }}
      >
        {/* Border-beam sutil no hover */}
        {!isDisabledModule && (
          <div
            className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, rgba(${accent.rgb},0.35), transparent 40%, transparent 60%, rgba(${accent.rgb},0.15))`,
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '1px',
            } as React.CSSProperties}
          />
        )}

        {/* Badge de status */}
        <div className="absolute top-4 right-4 z-10">
          {getBadge()}
        </div>

        {/* Icon com acento da filial */}
        <div className="relative mb-5">
          <div
            className={cn(
              'h-14 w-14 rounded-2xl border border-current/15 bg-foreground/5 flex items-center justify-center transition-all duration-500 shadow-lg',
              accent.text,
              !isDisabledModule && !noAccess && 'group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-2xl'
            )}
            style={{ boxShadow: !isDisabledModule ? `0 10px 30px -10px rgba(${accent.rgb},0.5)` : undefined }}
          >
            <Icon className="h-7 w-7" />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight flex items-center gap-2">
          {title}
          {!isDisabledModule && !noAccess && (
            <Sparkles className={cn('h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity', accent.text)} />
          )}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-2 min-h-[2.5rem]">
          {description}
        </p>

        {/* Features chips */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {features.map((feature) => (
            <span
              key={feature}
              className="text-[10px] px-2 py-1 rounded-md bg-foreground/5 dark:bg-white/5 border border-border/40 dark:border-white/10 text-muted-foreground font-medium uppercase tracking-wider"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* CTA */}
        {!isDisabledModule && (
          <div className={cn(
            'flex items-center gap-2 text-sm font-semibold transition-all',
            noAccess ? 'text-amber-500 dark:text-amber-400' : accent.text,
            'group-hover:gap-3'
          )}>
            <span>{noAccess ? 'Ver detalhes' : 'Acessar módulo'}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        )}
      </div>
    </button>
  );
}


export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, isVendedor, isMaster: authIsMaster, canAccessSettings } = useAuth();
  const isMobile = useIsMobile();
  const { hasModulo, isLoading: isLoadingEmpresa, isMaster } = useEmpresaConfig();
  const { 
    permissions,
    hasUserModuleAccess,
    isLoading: isLoadingPermissions
  } = useUserModulePermissions();
  const homeTheme = resolvePelegriniTheme(null);
  const branchThemes = [PELEGRINI_THEMES.transmissao, PELEGRINI_THEMES.chevrolet];
  
  // Estado para o seletor de empresa (master)
  const [empresaSelectorOpen, setEmpresaSelectorOpen] = useState(false);
  const [selectedModulePath, setSelectedModulePath] = useState('');
  const [selectedModuloKey, setSelectedModuloKey] = useState<UserModuleKey | undefined>();

  // Estado para o seletor de filial (módulos com filiais, ex.: Comercial 1004)
  const { codEmpresa: codEmpresaUsuario } = useAuth();
  const { clearFilial } = useFilialSelecionada();
  const [filialDialogOpen, setFilialDialogOpen] = useState(false);
  const [filialTargetPath, setFilialTargetPath] = useState<string>('');
  const codEmpresaParaFilial = isMaster ? null : codEmpresaUsuario;
  
  // Estado para o dialog de detalhes do módulo
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedModuleForDetails, setSelectedModuleForDetails] = useState<typeof modules[0] | null>(null);

  // Redirecionar vendedor para WhatsApp automaticamente
  useEffect(() => {
    if (isAuthenticated && isVendedor) {
      navigate('/whatsapp');
    }
  }, [isAuthenticated, isVendedor, navigate]);

  // Handler para quando master clica em um módulo
  const handleMasterModuleClick = (path: string, moduloKey?: UserModuleKey) => {
    setSelectedModulePath(path);
    setSelectedModuloKey(moduloKey);
    setEmpresaSelectorOpen(true);
  };

  // Intercepta clique para módulos com seleção de filial (não master)
  const handleInterceptClick = (path: string, moduloKey?: UserModuleKey): boolean => {
    if (
      moduloKey === 'comercial'
      && empresaPossuiFiliais(codEmpresaParaFilial)
      && getFiliaisDaEmpresa(codEmpresaParaFilial).length > 1
    ) {
      clearFilial();
      setFilialTargetPath(path);
      setFilialDialogOpen(true);
      return true;
    }
    return false;
  };

  const getFinanceiroEntryPath = () => {
    if ((permissions?.modulo_resumo || isMaster) && hasModulo('resumo')) return '/financeiro/resumo';
    if ((permissions?.modulo_dre || isMaster) && hasModulo('dre')) return '/financeiro/dre';
    if ((permissions?.modulo_variacao || isMaster) && hasModulo('variacao')) return '/financeiro/variacao';
    return '/financeiro/resumo';
  };

  // Handler para mostrar detalhes do módulo
  const handleShowModuleDetails = (module: typeof modules[0]) => {
    setSelectedModuleForDetails(module);
    setDetailsDialogOpen(true);
  };

  // Calcula estatísticas para os totalizadores
  const getModuleStats = () => {
    const activeCount = modules.filter(m => !m.disabled).length;
    const comingSoonCount = modules.filter(m => m.disabled).length;
    return { activeCount, comingSoonCount, totalCount: modules.length };
  };

  const stats = getModuleStats();

  // Mobile version
  if (isMobile) {
    return <HomeMobilePage />;
  }

  // Desktop version
  return (
    <div
      className="min-h-screen relative overflow-hidden bg-background"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(73,210,255,0.14), transparent 30%), radial-gradient(circle at top right, rgba(3,78,153,0.16), transparent 28%), hsl(var(--background))',
      }}
    >
      <PelegriniMotionBackdrop theme={homeTheme} />

      {/* Header */}
      <header className="relative border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="animate-fade-in">
              <PelegriniBrandMark theme={homeTheme} />
            </div>
            
            <div className="flex items-center gap-3 animate-fade-in">
              <ThemeToggle />
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-medium text-success">Online</span>
              </div>
              
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  {/* Botão Configurações no header para quem tem acesso */}
                  {canAccessSettings && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigate('/configuracoes')}
                      className="gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <Settings className="h-4 w-4" />
                      <span className="hidden lg:inline">Configurações</span>
                    </Button>
                  )}
                  <span className="text-sm text-muted-foreground hidden md:inline">
                    {user?.email}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={logout}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden md:inline">Sair</span>
                  </Button>
                </div>
              ) : (
                <LoginDialog />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative max-w-7xl mx-auto px-6 py-6">
        <section className="relative mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-6 shadow-xl shadow-primary/5 backdrop-blur-xl">
          <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {pelegriniBrand.eyebrow}
              </div>
              <h2 className="max-w-3xl text-3xl font-bold leading-tight text-foreground">
                {pelegriniBrand.headline}
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Uma central executiva para acompanhar Casa da Transmissão e Casa do Chevrolet sem perder velocidade de decisão.
              </p>
            </div>
            <div className="grid gap-3">
              {branchThemes.map((theme) => (
                <PelegriniBranchBadge key={theme.key} theme={theme} />
              ))}
            </div>
          </div>
        </section>

        {/* Linha combinada: stats + título */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 animate-fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { icon: Layers, label: 'Módulos', value: String(stats.totalCount), color: 'text-primary' },
              { icon: Activity, label: 'Ativos', value: String(stats.activeCount), color: 'text-success' },
              { icon: Sparkles, label: 'Em breve', value: String(stats.comingSoonCount), color: 'text-warning' },
              { icon: Zap, label: 'v1.0', value: '', color: 'text-accent' },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-lg px-3 py-1.5 flex items-center gap-2">
                <stat.icon className={cn('h-3.5 w-3.5', stat.color)} />
                {stat.value && <span className={cn('text-sm font-bold', stat.color)}>{stat.value}</span>}
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Módulos Disponíveis
          </span>
        </div>

        {/* Modules grid - 4 em linha no desktop, compacto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules
            .filter((module) => {
              // Visitante ou master: mostra todos os módulos
              if (!isAuthenticated || isMaster) return true;
              
              // Módulos desabilitados ("Em breve"): sempre mostrar
              if (module.disabled) return true;
              
              // Usuário autenticado: só mostra módulos que ele tem acesso
              const hasEmpresaAccess = module.moduloKey ? hasModulo(module.moduloKey) : true;
              const hasUserAccess = module.moduloKey ? hasUserModuleAccess(module.moduloKey) : true;
              return hasEmpresaAccess && hasUserAccess;
            })
            .map((module, index) => {
            // Determina se o usuário tem acesso ao módulo
            const hasEmpresaAccess = module.moduloKey ? hasModulo(module.moduloKey) : true;
            const hasUserAccess = module.moduloKey ? hasUserModuleAccess(module.moduloKey) : true;
            const hasFullAccess = isMaster || (hasEmpresaAccess && hasUserAccess);
            const modulePath = module.moduloKey === 'financeiro'
              ? (isMaster ? module.path : getFinanceiroEntryPath())
              : module.path;
            
            // noAccess: logado mas sem permissão para o módulo
            const noAccess = isAuthenticated && !module.disabled && !hasFullAccess;
            
            return (
              <ModuleCard
                key={module.title} 
                {...module} 
                path={modulePath}
                index={index}
                locked={!isAuthenticated}
                noAccess={noAccess}
                isMaster={isMaster}
                onMasterClick={handleMasterModuleClick}
                onInterceptClick={handleInterceptClick}
                onShowDetails={() => handleShowModuleDetails(module)}
              />
            );
          })}
        </div>

        {canAccessSettings && (
          <div className="mt-5 animate-fade-in">
            <button
              type="button"
              onClick={() => navigate(pelegriniAdminEntry.path)}
              className={cn(
                'group w-full rounded-2xl border border-border/60 bg-card/40 p-5 text-left',
                'transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10'
              )}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Administracao
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">
                      {pelegriniAdminEntry.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pelegriniAdminEntry.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex flex-wrap gap-1.5">
                    {pelegriniAdminEntry.features.map((feature) => (
                      <span
                        key={feature}
                        className="rounded-md border border-border/50 bg-background/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary transition-all group-hover:gap-3">
                    Configurar
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Dialog de detalhes do módulo */}
        <ModuleDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          module={selectedModuleForDetails}
        />

        {/* Seletor de empresa para master */}
        <EmpresaSelectorDialog
          open={empresaSelectorOpen}
          onOpenChange={setEmpresaSelectorOpen}
          targetPath={selectedModulePath}
          moduloKey={selectedModuloKey}
        />

        {/* Seletor de filial (módulo Comercial para empresas com filiais) */}
        <FilialSelectorDialog
          open={filialDialogOpen}
          onOpenChange={setFilialDialogOpen}
          codEmpresa={codEmpresaParaFilial}
          required
          onConfirm={() => {
            setFilialDialogOpen(false);
            navigate(filialTargetPath);
          }}
        />
      </main>

      {/* Footer compacto */}
      <footer className="relative border-t border-border/50 mt-6">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              © 2026 {pelegriniBrand.footer}
            </p>
            <div className="flex items-center gap-6">
              <span className="text-xs text-muted-foreground">{pelegriniBrand.version}</span>
              <div className="h-4 w-px bg-border" />
              <span className="text-xs text-muted-foreground">Powered by React</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
