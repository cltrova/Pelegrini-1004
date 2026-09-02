import { useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  LogOut,
  MapPin,
  MessageSquare,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { ModuleDetailsDialog } from '@/components/common/ModuleDetailsDialog';
import { Button } from '@/components/ui/button';
import { getPelegriniModuleIdentity, type PelegriniModuleKey } from '@/config/pelegriniIdentity';
import { getPelegriniVisibleModules, pelegriniAdminEntry, type PelegriniHomeModule } from '@/config/pelegriniHome';
import { PELEGRINI_THEMES } from '@/config/pelegriniTheme';
import { getFilialAccessState } from '@/utils/filialAccess';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaSelecionada } from '@/contexts/EmpresaSelecionadaContext';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';

type HomeBranch = 'transmissao' | 'chevrolet';

interface ModuleItem extends PelegriniHomeModule {
  icon: ComponentType<{ className?: string }>;
  disabled: boolean;
}

interface PelegriniHomeExperienceProps {
  mobile?: boolean;
}

const moduleIcons: Record<PelegriniHomeModule['accent'], ModuleItem['icon']> = {
  emerald: MessageSquare,
  purple: ShoppingCart,
  orange: Truck,
  blue: TrendingUp,
};

const modules: ModuleItem[] = getPelegriniVisibleModules().map((module) => ({
  ...module,
  icon: moduleIcons[module.accent],
  disabled: false,
}));

const branchPresentation: Record<HomeBranch, {
  name: string;
  subtitle: string;
  logo: string;
  blueprint: string;
  eyebrow: string;
  title: string;
  description: string;
  metaOne: string;
  metaTwo: string;
  photos: string[];
}> = {
  chevrolet: {
    name: 'Casa do Chevrolet',
    subtitle: 'Peças originais, agilidade e confiança desde 1992',
    logo: '/brand/casa-chevrolet-wordmark.png',
    blueprint: '/brand/home/blueprint-chevrolet.png',
    eyebrow: 'Central Casa do Chevrolet',
    title: 'Sua operação Chevrolet em um só lugar',
    description: 'Atendimento, pedidos, estoque e resultados conectados com a agilidade de quem entende de peças originais.',
    metaOne: 'Peças originais',
    metaTwo: 'Desde 1992',
    photos: [
      '/brand/home/chevrolet-fachada.jpg',
      '/brand/home/chevrolet-balcao-pecas.png',
      '/brand/home/chevrolet-componentes.png',
    ],
  },
  transmissao: {
    name: 'Casa da Transmissão',
    subtitle: 'Câmbio, diferencial e motor com especialização técnica',
    logo: '/brand/home/transmissao-transparent.png',
    blueprint: '/brand/home/blueprint-transmissao.png',
    eyebrow: 'Central Casa da Transmissão',
    title: 'Precisão técnica para mover toda a operação',
    description: 'Atendimento, pedidos, estoque e resultados conectados à experiência em transmissão, motor e veículos pesados.',
    metaOne: 'Distribuidora ZF',
    metaTwo: 'Especialização técnica',
    photos: [
      '/brand/home/transmissao-fachada.png',
      '/brand/home/transmissao-cambio-pesado.png',
      '/brand/home/transmissao-estoque-tecnico.png',
    ],
  },
};

function LayeredBrandLogo({ branch, className = '' }: { branch: HomeBranch; className?: string }) {
  const presentation = branchPresentation[branch];
  return (
    <span className={`pelegrini-home-logo-stack ${branch} ${className}`}>
      <img
        src={presentation.logo}
        alt={presentation.name}
        className={branch === 'chevrolet' ? 'pelegrini-chevrolet-logo' : undefined}
      />
    </span>
  );
}

function TechnicalBackdrop({ focusedBranch }: { focusedBranch: HomeBranch | null }) {
  return (
    <div className="pelegrini-home-backdrop" data-focus={focusedBranch ?? undefined} aria-hidden="true">
      {(Object.keys(branchPresentation) as HomeBranch[]).map((branch) => (
        <div className={`pelegrini-home-blueprint ${branch}`} key={branch}>
          <img src={branchPresentation[branch].blueprint} alt="" />
        </div>
      ))}
      <svg className="pelegrini-home-links" viewBox="0 0 1000 620" preserveAspectRatio="none">
        <g className="link-left"><path d="M92 180 L210 180 L300 270 L438 270" /><path d="M115 432 L248 432 L330 355 L462 355" /><circle cx="92" cy="180" r="3" /><circle cx="438" cy="270" r="3" /></g>
        <g className="link-right"><path d="M908 165 L790 165 L710 255 L570 255" /><path d="M890 448 L760 448 L682 370 L545 370" /><circle cx="908" cy="165" r="3" /><circle cx="570" cy="255" r="3" /></g>
      </svg>
      <span className="pelegrini-home-cursor-glow" />
      <span className="pelegrini-home-grain" />
    </div>
  );
}

export function PelegriniHomeExperience({ mobile = false }: PelegriniHomeExperienceProps) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, logout, isVendedor, canAccessSettings, codEmpresa: codEmpresaUsuario, profile } = useAuth();
  const { hasModulo, isMaster } = useEmpresaConfig();
  const { permissions, hasUserModuleAccess } = useUserModulePermissions();
  const { setFilialAtivaForEmpresa } = useFilialSelecionada();
  const { setEmpresaSelecionada } = useEmpresaSelecionada();
  const [selectedBranch, setSelectedBranch] = useState<HomeBranch | null>(null);
  const [focusedBranch, setFocusedBranch] = useState<HomeBranch | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedModuleForDetails, setSelectedModuleForDetails] = useState<ModuleItem | null>(null);
  const codEmpresaParaFilial = isMaster ? '1004' : codEmpresaUsuario;
  const theme = selectedBranch ? PELEGRINI_THEMES[selectedBranch] : PELEGRINI_THEMES.pelegrini;

  const filialAccess = useMemo(() => getFilialAccessState({
    codEmpresa: codEmpresaParaFilial,
    isMaster,
    filiaisPermitidas: profile?.filiais_permitidas,
    filialPadrao: profile?.filial_id,
  }), [codEmpresaParaFilial, isMaster, profile?.filial_id, profile?.filiais_permitidas]);

  const visibleModules = modules.filter((module) => (
    !isAuthenticated || isMaster || module.disabled || (hasModulo(module.moduloKey) && hasUserModuleAccess(module.moduloKey))
  ));

  useEffect(() => {
    if (isAuthenticated && isVendedor) navigate('/whatsapp');
  }, [isAuthenticated, isVendedor, navigate]);

  useEffect(() => {
    if (!selectedBranch) return undefined;
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % branchPresentation[selectedBranch].photos.length);
    }, 5600);
    return () => window.clearInterval(timer);
  }, [selectedBranch]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    const trackPointer = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      const ambientX = ((event.clientX / window.innerWidth) - 0.5) * 10;
      const ambientY = ((event.clientY / window.innerHeight) - 0.5) * 8;
      root.style.setProperty('--home-ambient-x', `${ambientX}px`);
      root.style.setProperty('--home-ambient-y', `${ambientY}px`);
      root.style.setProperty('--home-ambient-x-reverse', `${ambientX * -0.5}px`);
      root.style.setProperty('--home-ambient-y-reverse', `${ambientY * -0.5}px`);
    };
    const animate = () => {
      currentX += (targetX - currentX) * 0.085;
      currentY += (targetY - currentY) * 0.085;
      root.style.setProperty('--home-glow-x', `${currentX}px`);
      root.style.setProperty('--home-glow-y', `${currentY}px`);
      frame = window.requestAnimationFrame(animate);
    };

    window.addEventListener('pointermove', trackPointer, { passive: true });
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('pointermove', trackPointer);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const getFinanceiroEntryPath = () => {
    if ((permissions?.modulo_resumo || isMaster) && hasModulo('resumo')) return '/financeiro/resumo';
    if ((permissions?.modulo_dre || isMaster) && hasModulo('dre')) return '/financeiro/dre';
    if ((permissions?.modulo_variacao || isMaster) && hasModulo('variacao')) return '/financeiro/variacao';
    return '/financeiro/resumo';
  };

  const chooseBranch = (branch: HomeBranch) => {
    if (!filialAccess.available.some((filial) => filial.id === branch)) return;
    if (isMaster) setEmpresaSelecionada('1004');
    setFilialAtivaForEmpresa(codEmpresaParaFilial, branch);
    setSlideIndex(0);
    setFocusedBranch(null);
    setSelectedBranch(branch);
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
    navigate(module.moduloKey === 'financeiro' ? getFinanceiroEntryPath() : module.path);
  };

  const rootStyle = {
    '--pelegrini-primary': theme.primary,
    '--pelegrini-secondary': theme.secondary,
    '--pelegrini-accent': theme.accent,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className="pelegrini-home min-h-screen overflow-x-clip bg-background"
      data-branch={selectedBranch ?? 'group'}
      data-mobile={mobile ? 'true' : 'false'}
      data-pelegrini-theme={theme.key}
      data-view={selectedBranch ? 'modules' : 'selection'}
      style={rootStyle}
    >
      {!selectedBranch && <TechnicalBackdrop focusedBranch={focusedBranch} />}

      <header className="pelegrini-home-header">
        <div className="pelegrini-home-header-inner">
          <div className="pelegrini-home-brand">
            {selectedBranch ? <LayeredBrandLogo branch={selectedBranch} className="header-logo" /> : <img src="/brand/home/grupo-pelegrini.png" alt="Grupo Pelegrini" className="pelegrini-home-group-logo" />}
            <div className="min-w-0">
              <p>{selectedBranch ? branchPresentation[selectedBranch].name : 'Grupo Pelegrini'}</p>
              <span>{selectedBranch ? branchPresentation[selectedBranch].subtitle : 'Central de operações das filiais'}</span>
            </div>
          </div>
          <div className="pelegrini-home-header-actions">
            {canAccessSettings && (
              <button type="button" className="pelegrini-home-icon-button" aria-label="Configuracoes" title="Configurações" onClick={() => navigate(pelegriniAdminEntry.path)}>
                <Settings />
              </button>
            )}
            <ThemeToggle />
            {isAuthenticated ? (
              <div className="pelegrini-home-account">
                <span>{user?.email}</span>
                <Button variant="outline" size={mobile ? 'icon' : 'sm'} onClick={logout} aria-label="Sair" className="gap-2">
                  <LogOut className="h-4 w-4" />{!mobile && <span>Sair</span>}
                </Button>
              </div>
            ) : <LoginDialog />}
          </div>
        </div>
      </header>

      {!selectedBranch ? (
        <main className="pelegrini-home-selection">
          <h1>Escolha a filial</h1>
          <section className="pelegrini-home-branch-grid" aria-label="Filiais disponíveis">
            {(filialAccess.items.filter((item) => item.id === 'chevrolet' || item.id === 'transmissao') as Array<typeof filialAccess.items[number] & { id: HomeBranch }>).map((filial) => (
              <button
                key={filial.id}
                type="button"
                className="pelegrini-home-branch-card"
                disabled={filial.blocked}
                onClick={() => chooseBranch(filial.id)}
                onPointerEnter={() => setFocusedBranch(filial.id)}
                onPointerLeave={() => setFocusedBranch(null)}
                onFocus={() => setFocusedBranch(filial.id)}
                onBlur={() => setFocusedBranch(null)}
              >
                <span className="pelegrini-home-branch-logo-stage"><LayeredBrandLogo branch={filial.id} /></span>
                <span className="pelegrini-home-branch-name">{branchPresentation[filial.id].name}<ArrowRight /></span>
                {filial.blocked && <span className="sr-only">Acesso não liberado</span>}
              </button>
            ))}
          </section>
        </main>
      ) : (
        <main className="pelegrini-home-modules-shell">
          <div className="pelegrini-home-modules-toolbar">
            <button type="button" className="pelegrini-home-back-button" onClick={() => setSelectedBranch(null)}><ArrowLeft />Trocar filial</button>
            <span>Filial selecionada: {branchPresentation[selectedBranch].name}</span>
          </div>

          <section className="pelegrini-home-carousel" aria-label={`Imagens da ${branchPresentation[selectedBranch].name}`}>
            <div className="pelegrini-home-carousel-copy">
              <span>{branchPresentation[selectedBranch].eyebrow}</span>
              <h1>{branchPresentation[selectedBranch].title}</h1>
              <p>{branchPresentation[selectedBranch].description}</p>
              <div className="pelegrini-home-carousel-meta">
                <span><ShieldCheck />{branchPresentation[selectedBranch].metaOne}</span>
                <span><Clock3 />{branchPresentation[selectedBranch].metaTwo}</span>
                <span><MapPin />Uberlândia · MG</span>
              </div>
            </div>
            <div className="pelegrini-home-carousel-photos">
              {branchPresentation[selectedBranch].photos.map((photo, index) => (
                <img key={photo} src={photo} alt="" aria-hidden="true" data-active={index === slideIndex ? 'true' : 'false'} />
              ))}
              <div className="pelegrini-home-carousel-dots" aria-hidden="true">
                {branchPresentation[selectedBranch].photos.map((photo, index) => <span key={photo} data-active={index === slideIndex ? 'true' : 'false'} />)}
              </div>
            </div>
          </section>

          <section className="pelegrini-home-modules" aria-labelledby="home-modules-title">
            <h2 id="home-modules-title">Módulos</h2>
            <div className="pelegrini-home-module-grid" data-home-modules>
              {visibleModules.map((module) => {
                const identity = getPelegriniModuleIdentity(module.moduloKey as PelegriniModuleKey);
                const Icon = module.icon;
                return (
                  <button key={module.title} type="button" className="pelegrini-home-module-card" onClick={() => handleModuleClick(module)} disabled={module.disabled}>
                    <span className="pelegrini-home-module-icon"><Icon /></span>
                    <ArrowRight className="pelegrini-home-module-arrow" />
                    <span className="pelegrini-home-module-title">{module.title}</span>
                    <strong>{identity.operationalLabel}</strong>
                    <p>{module.description}</p>
                    <span className="pelegrini-home-module-tags">{identity.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </main>
      )}

      <ModuleDetailsDialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen} module={selectedModuleForDetails} />
    </div>
  );
}
