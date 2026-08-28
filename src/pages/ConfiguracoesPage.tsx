import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  Users,
  FileText,
  Lock,
  ChevronLeft,
  Building2,
  Plug,
  ArrowRight,
  Crown,
  Layers,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { RequireRole } from '@/components/auth/RequireRole';
import { useEmpresas } from '@/hooks/useEmpresaConfig';
import { supabase } from '@/integrations/supabase/client';
import { isLocalPreviewEnabled } from '@/config/localPreview';
import { cn } from '@/lib/utils';
import { PelegriniPageSurface } from '@/components/pelegrini';

// ===== Hooks de métricas =====
function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      if (isLocalPreviewEnabled()) {
        return {
          usuarios: 1,
          masters: 1,
        };
      }

      const [usersRes, mastersRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'master'),
      ]);
      return {
        usuarios: usersRes.count ?? 0,
        masters: mastersRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

// ===== KPI Card =====
function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'primary',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'primary' | 'success' | 'warning' | 'neutral';
}) {
  const accentMap = {
    primary: 'border-primary/20 bg-primary/10 text-primary',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    neutral: 'border-border/60 bg-muted/50 text-muted-foreground',
  } as const;
  return (
    <div className="pelegrini-kpi-card group relative overflow-hidden border border-border/60 bg-card p-5 transition-all hover:border-border">
      <span className="pelegrini-kpi-card-rail" aria-hidden="true" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {hint && (
            <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        <div
          className={cn(
            'h-10 w-10 rounded-lg border flex items-center justify-center shrink-0',
            accentMap[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ===== Active Module Card =====
function ActiveModuleCard({
  icon: Icon,
  title,
  description,
  metric,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  metric: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'pelegrini-data-panel group relative overflow-hidden border border-border/60 bg-card text-left p-6',
        'transition-all duration-300',
        'hover:border-primary/40 hover:shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.35)] hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        disabled && 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:border-border/60 hover:shadow-none',
      )}
    >
      <div className="relative">
        <div className="flex items-start justify-between mb-5">
          <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider font-medium border-emerald-500/30 text-emerald-400 bg-emerald-500/5 gap-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Ativo
          </Badge>
        </div>
        <h3 className="font-semibold text-foreground text-base tracking-tight mb-1.5">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          {description}
        </p>
        <div className="flex items-center justify-between pt-4 border-t border-border/60">
          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium tabular-nums">{metric}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all">
            Gerenciar
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </button>
  );
}

// ===== Soon Card =====
function SoonCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-xl border border-dashed border-border/50 bg-card/30 p-4 opacity-70">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className="font-medium text-foreground/90 text-sm tracking-tight truncate">
              {title}
            </h4>
            <Badge
              variant="outline"
              className="text-[9px] uppercase tracking-wider font-medium border-border/60 text-muted-foreground px-1.5 py-0 shrink-0"
            >
              Em breve
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfiguracoesPageContent() {
  const navigate = useNavigate();
  const { isMaster } = useAuth();
  const { data: empresas = [] } = useEmpresas();
  const { data: stats } = useAdminStats();

  const totalEmpresas = empresas.length;
  const empresasAtivas = empresas.filter((e: any) => e.ativa !== false).length;
  const totalUsuarios = stats?.usuarios ?? 0;
  const totalMasters = stats?.masters ?? 0;

  return (
    <PelegriniPageSurface moduleKey="financeiro" className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Settings className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground text-[15px] leading-tight">
                Administração
              </h1>
              <p className="text-xs text-muted-foreground">Centro de controle da plataforma</p>
            </div>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sistema operacional
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Hero */}
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <Settings className="h-7 w-7 text-primary" />
            Administração
          </h2>
          <p className="text-muted-foreground max-w-2xl text-[15px] leading-relaxed">
            Gerencie empresas, usuários, permissões e configurações globais da plataforma em um único centro de governança.
            {!isMaster && ' Alguns módulos requerem perfil master.'}
          </p>
        </div>

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Empresas"
            value={totalEmpresas}
            hint={`${empresasAtivas} ativas`}
            icon={Building2}
            accent="primary"
          />
          <KpiCard
            label="Usuários"
            value={totalUsuarios}
            hint="Cadastrados no sistema"
            icon={Users}
            accent="success"
          />
          <KpiCard
            label="Administradores"
            value={totalMasters}
            hint="Perfil master"
            icon={Crown}
            accent="warning"
          />
          <KpiCard
            label="Módulos ativos"
            value="2"
            hint="Disponíveis para uso"
            icon={Layers}
            accent="neutral"
          />
        </section>

        {/* Active Modules */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-[0.15em]">
                Disponíveis
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Módulos ativos e prontos para uso
              </p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">2 módulos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ActiveModuleCard
              icon={Building2}
              title="Gestão de Empresas"
              description="Gerencie clientes, módulos, endpoints e configurações corporativas por tenant."
              metric={`${totalEmpresas} empresas cadastradas`}
              onClick={() => navigate('/configuracoes/empresas')}
              disabled={!isMaster}
            />
            <ActiveModuleCard
              icon={Users}
              title="Usuários e Permissões"
              description="Controle usuários, funções, papéis e níveis de acesso ao sistema."
              metric={`${totalUsuarios} usuários ativos`}
              onClick={() => navigate('/configuracoes/usuarios')}
              disabled={!isMaster}
            />
          </div>
        </section>

        {/* Footer hint */}
        <div className="pt-2 text-center text-xs text-muted-foreground">
          <Lock className="inline h-3 w-3 mr-1.5 -mt-0.5" />
          Apenas usuários com perfil master podem acessar esta área
        </div>
      </div>
    </PelegriniPageSurface>
  );
}

export default function ConfiguracoesPage() {
  return (
    <RequireRole allowedRoles={['master']}>
      <ConfiguracoesPageContent />
    </RequireRole>
  );
}
