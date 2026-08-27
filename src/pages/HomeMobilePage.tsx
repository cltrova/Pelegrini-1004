import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  ShoppingCart, 
  Truck, 
  Settings, 
  Lock, 
  ChevronRight, 
  BarChart3, 
  LogOut,
  User,
  Info,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { ModuleDetailsDialog } from '@/components/common/ModuleDetailsDialog';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';
import { EmpresaSelectorDialog } from '@/components/common/EmpresaSelectorDialog';
import { empresaPossuiFiliais, getFiliaisDaEmpresa } from '@/config/filiaisEmpresa';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';
import { useUserModulePermissions, type UserModuleKey } from '@/hooks/useUserModulePermissions';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { PelegriniBrandMark, PelegriniBranchBadge, PelegriniMotionBackdrop } from '@/components/pelegrini';
import { pelegriniAdminEntry, pelegriniBrand, pelegriniModules } from '@/config/pelegriniHome';
import { PELEGRINI_THEMES, resolvePelegriniTheme } from '@/config/pelegriniTheme';

interface ModuleItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color: string;
  bgColor: string;
  disabled?: boolean;
  features: string[];
  moduloKey?: UserModuleKey;
}

// 4 módulos principais (sem Configurações)
const modules: ModuleItem[] = [
  {
    title: pelegriniModules[0].title,
    description: pelegriniModules[0].description,
    icon: MessageSquare,
    path: pelegriniModules[0].path,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    disabled: false,
    features: pelegriniModules[0].features,
    moduloKey: 'whatsapp',
  },
  {
    title: pelegriniModules[1].title,
    description: pelegriniModules[1].description,
    icon: ShoppingCart,
    path: pelegriniModules[1].path,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    disabled: false,
    features: pelegriniModules[1].features,
    moduloKey: 'comercial',
  },
  {
    title: pelegriniModules[2].title,
    description: pelegriniModules[2].description,
    icon: Truck,
    path: pelegriniModules[2].path,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    disabled: true,
    features: pelegriniModules[2].features,
  },
  {
    title: pelegriniModules[3].title,
    description: pelegriniModules[3].description,
    icon: TrendingUp,
    path: pelegriniModules[3].path,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    disabled: false,
    features: pelegriniModules[3].features,
    moduloKey: 'financeiro',
  },
];

function MobileModuleCard({ 
  module, 
  locked,
  noAccess,
  onClick 
}: { 
  module: ModuleItem; 
  locked: boolean;
  noAccess: boolean;
  onClick: () => void;
}) {
  // Desabilita clique apenas se módulo está "Em breve"
  const isClickDisabled = module.disabled;

  // Determina o badge a exibir
  const getBadge = () => {
    if (locked) {
      // Visitante: sempre mostra "Saiba mais"
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary flex items-center gap-1">
          <Info className="h-2.5 w-2.5" />
          Saiba mais
        </span>
      );
    }
    if (module.disabled) {
      // Módulo "Em breve"
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
          <Lock className="h-2.5 w-2.5" />
          Em breve
        </span>
      );
    }
    if (noAccess) {
      // Logado mas sem acesso
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning flex items-center gap-1">
          <Info className="h-2.5 w-2.5" />
          Saiba mais
        </span>
      );
    }
    return null;
  };

  return (
    <button
      onClick={onClick}
      disabled={isClickDisabled}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 transition-all duration-200 active:scale-[0.98]',
        isClickDisabled && 'opacity-50'
      )}
    >
      <div className={cn(
        'h-12 w-12 rounded-xl flex items-center justify-center shrink-0',
        module.bgColor
      )}>
        <module.icon className={cn('h-6 w-6', module.color)} />
      </div>
      
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">{module.title}</h3>
          {getBadge()}
        </div>
        <p className="text-sm text-muted-foreground truncate">{module.description}</p>
      </div>
      
      {!isClickDisabled && (
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      )}
    </button>
  );
}

export default function HomeMobilePage() {
  const navigate = useNavigate();
  const homeTheme = resolvePelegriniTheme(null);
  const branchThemes = [PELEGRINI_THEMES.transmissao, PELEGRINI_THEMES.chevrolet];
  const { isAuthenticated, user, logout, canAccessSettings, codEmpresa: codEmpresaUsuario } = useAuth();
  const { isMaster, hasModulo } = useEmpresaConfig();
  const { 
    permissions,
    hasUserModuleAccess,
  } = useUserModulePermissions();
  const { clearFilial } = useFilialSelecionada();

  // Estado para o dialog de detalhes do módulo
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedModuleForDetails, setSelectedModuleForDetails] = useState<ModuleItem | null>(null);

  // Seletor de filial (Comercial 1004 etc.)
  const [filialDialogOpen, setFilialDialogOpen] = useState(false);
  const [filialTargetPath, setFilialTargetPath] = useState<string>('');
  const codEmpresaParaFilial = isMaster ? null : codEmpresaUsuario;

  // Seletor de empresa (master) — mesmo fluxo do desktop
  const [empresaSelectorOpen, setEmpresaSelectorOpen] = useState(false);
  const [selectedModulePath, setSelectedModulePath] = useState('');
  const [selectedModuloKey, setSelectedModuloKey] = useState<UserModuleKey | undefined>();

  const getFinanceiroEntryPath = () => {
    if ((permissions?.modulo_resumo || isMaster) && hasModulo('resumo')) return '/financeiro/resumo';
    if ((permissions?.modulo_dre || isMaster) && hasModulo('dre')) return '/financeiro/dre';
    if ((permissions?.modulo_variacao || isMaster) && hasModulo('variacao')) return '/financeiro/variacao';
    return '/financeiro/resumo';
  };

  // Calcula estatísticas
  const getModuleStats = () => {
    const activeCount = modules.filter(m => !m.disabled).length;
    const comingSoonCount = modules.filter(m => m.disabled).length;
    return { activeCount, comingSoonCount, totalCount: modules.length };
  };

  const stats = getModuleStats();

  const handleModuleClick = (module: ModuleItem) => {
    // Determina se o usuário tem acesso ao módulo
    const hasEmpresaAccess = module.moduloKey ? hasModulo(module.moduloKey) : true;
    const hasUserAccess = hasUserModuleAccess(module.moduloKey);
    const hasFullAccess = isMaster || (hasEmpresaAccess && hasUserAccess);
    const noAccess = isAuthenticated && !module.disabled && !hasFullAccess;
    
    // Se não autenticado OU sem acesso, abre dialog de detalhes
    if (!isAuthenticated || noAccess) {
      setSelectedModuleForDetails(module);
      setDetailsDialogOpen(true);
      return;
    }
    
    // Se módulo desabilitado, não faz nada
    if (module.disabled) return;
    
    const targetPath = module.moduloKey === 'financeiro' ? getFinanceiroEntryPath() : module.path;

    // Master: sempre escolher a empresa antes de entrar no módulo (igual ao desktop)
    if (isMaster) {
      setSelectedModulePath(module.moduloKey === 'financeiro' ? module.path : targetPath);
      setSelectedModuloKey(module.moduloKey);
      setEmpresaSelectorOpen(true);
      return;
    }


    // Comercial: empresas com filiais devem escolher antes de entrar
    if (
      module.moduloKey === 'comercial'
      && empresaPossuiFiliais(codEmpresaParaFilial)
      && getFiliaisDaEmpresa(codEmpresaParaFilial).length > 1
    ) {
      clearFilial();
      setFilialTargetPath(targetPath);
      setFilialDialogOpen(true);
      return;
    }

    navigate(targetPath);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg safe-area-top">
        <div className="relative overflow-hidden border-b border-border/60 bg-card/80 px-4 py-4 backdrop-blur-xl">
          <PelegriniMotionBackdrop theme={homeTheme} intensity="soft" />
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <PelegriniBrandMark theme={homeTheme} />
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
                {isAuthenticated ? (
                  <div className="flex items-center gap-1">
                    {/* Botão Configurações para quem tem acesso */}
                    {canAccessSettings && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/configuracoes')}
                        className="h-9 w-9"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={logout}
                      className="h-9 w-9"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <LoginDialog />
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {branchThemes.map((theme) => (
                <PelegriniBranchBadge key={theme.key} theme={theme} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Welcome section */}
        <div className="animate-slide-up">
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-5 border border-primary/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bem-vindo</p>
                <p className="font-semibold text-foreground">
                  {isAuthenticated ? user?.email?.split('@')[0] : 'Visitante'}
                </p>
              </div>
            </div>
            {!isAuthenticated && (
              <p className="text-sm text-muted-foreground">
                Faça login para acessar todos os módulos do sistema.
              </p>
            )}
          </div>
        </div>

        {/* Status pills - valores dinâmicos */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 shrink-0">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-success">Sistema Online</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted shrink-0">
            <span className="text-xs text-muted-foreground">{stats.activeCount} ativos</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted shrink-0">
            <span className="text-xs text-muted-foreground">{stats.comingSoonCount} em breve</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted shrink-0">
            <span className="text-xs text-muted-foreground">{pelegriniBrand.version}</span>
          </div>
        </div>

        {/* Modules section - todos os 4 módulos */}
        <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Módulos
          </h2>
          <div className="space-y-3">
            {modules
              .filter((module) => {
                // Visitante ou master: mostra todos os módulos
                if (!isAuthenticated || isMaster) return true;
                
                // Módulos desabilitados ("Em breve"): sempre mostrar
                if (module.disabled) return true;
                
                // Usuário autenticado: só mostra módulos que ele tem acesso
                const hasEmpresaAccess = module.moduloKey ? hasModulo(module.moduloKey) : true;
                const hasUserAccess = hasUserModuleAccess(module.moduloKey);
                return hasEmpresaAccess && hasUserAccess;
              })
              .map((module, index) => {
              // Determina se o usuário tem acesso ao módulo
              const hasEmpresaAccess = module.moduloKey ? hasModulo(module.moduloKey) : true;
              const hasUserAccess = hasUserModuleAccess(module.moduloKey);
              const hasFullAccess = isMaster || (hasEmpresaAccess && hasUserAccess);
              const noAccess = isAuthenticated && !module.disabled && !hasFullAccess;
              
              return (
                <div 
                  key={module.title} 
                  className="animate-slide-up"
                  style={{ animationDelay: `${0.1 * (index + 3)}s` }}
                >
                  <MobileModuleCard
                    module={module}
                    locked={!isAuthenticated}
                    noAccess={noAccess}
                    onClick={() => handleModuleClick(module)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Removed Quick access section */}
        {canAccessSettings && (
          <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.35s' }}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Administracao
            </h2>
            <button
              type="button"
              onClick={() => navigate(pelegriniAdminEntry.path)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <h3 className="font-semibold text-foreground">{pelegriniAdminEntry.title}</h3>
                <p className="text-sm text-muted-foreground truncate">{pelegriniAdminEntry.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </button>
          </div>
        )}
      </main>

      {/* Dialog de detalhes do módulo */}
      <ModuleDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        module={selectedModuleForDetails}
      />

      {/* Seletor de filial (Comercial 1004 etc.) */}
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

      {/* Seletor de empresa (master) */}
      <EmpresaSelectorDialog
        open={empresaSelectorOpen}
        onOpenChange={setEmpresaSelectorOpen}
        targetPath={selectedModulePath}
        moduloKey={selectedModuloKey}
      />

      <MobileBottomNav />
    </div>
  );
}
