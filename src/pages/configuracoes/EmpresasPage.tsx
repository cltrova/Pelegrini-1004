import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Plus,
  Building2,
  ShieldAlert,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Settings2,
  Plug,
  ChevronDown,
  Check,
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Layers,
  Activity,
} from 'lucide-react';
import { useEmpresas, useEmpresaMutations, Empresa } from '@/hooks/useEmpresaConfig';
import { useAuth } from '@/contexts/AuthContext';
import { EmpresaFormDialog } from '@/components/configuracoes/EmpresaFormDialog';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { PelegriniPageSurface } from '@/components/pelegrini';

const MODULES = [
  { key: 'dre', label: 'DRE', icon: BarChart3 },
  { key: 'variacao', label: 'Variação', icon: TrendingUp },
  { key: 'comercial', label: 'Comercial', icon: ShoppingCart },
  { key: 'operacional', label: 'Operacional', icon: Layers },
  { key: 'resumo', label: 'Resumo', icon: Activity },
] as const;

function getModulesEnabled(e: Empresa) {
  return [
    e.modulo_dre && 'dre',
    e.modulo_variacao && 'variacao',
    e.modulo_comercial && 'comercial',
    e.modulo_operacional && 'operacional',
    e.modulo_resumo && 'resumo',
  ].filter(Boolean) as string[];
}

function getStatus(e: Empresa): 'ativa' | 'inativa' | 'pendente' {
  if (!e.ativo) return 'inativa';
  const hasEndpoint = e.usar_vps_intermediaria
    ? !!e.vps_cliente_identificador
    : !!e.endpoint_url;
  const hasModule = getModulesEnabled(e).length > 0;
  if (!hasEndpoint || !hasModule) return 'pendente';
  return 'ativa';
}

function StatusPill({ status }: { status: 'ativa' | 'inativa' | 'pendente' }) {
  const map = {
    ativa: { dot: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Ativa', pulse: true },
    inativa: { dot: 'bg-rose-500', text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', label: 'Inativa', pulse: false },
    pendente: { dot: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Pendente', pulse: true },
  }[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors', map.bg, map.text)}>
      <span className="relative flex h-1.5 w-1.5">
        {map.pulse && <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', map.dot)} />}
        <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', map.dot)} />
      </span>
      {map.label}
    </span>
  );
}

export default function EmpresasPage() {
  const navigate = useNavigate();
  const { isMaster, isAuthenticated } = useAuth();
  const { data: empresas, isLoading, error, refetch } = useEmpresas();
  const { deleteEmpresa } = useEmpresaMutations();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Empresa | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativa' | 'inativa' | 'pendente'>('all');
  const [moduleFilter, setModuleFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'recent'>('name');

  const handleEdit = (e: Empresa) => { setSelectedEmpresa(e); setDialogOpen(true); };
  const handleNew = () => { setSelectedEmpresa(null); setDialogOpen(true); };
  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setSelectedEmpresa(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmpresa(deleteTarget.id);
      toast({ title: 'Empresa excluída', description: `${deleteTarget.nome} foi excluída.` });
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message || 'Falha na exclusão.', variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const lista = empresas || [];

  const filtered = useMemo(() => {
    let arr = [...lista];
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(e => e.nome.toLowerCase().includes(q) || e.cod_empresa_bi.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') arr = arr.filter(e => getStatus(e) === statusFilter);
    if (moduleFilter.length > 0) {
      arr = arr.filter(e => {
        const en = getModulesEnabled(e);
        return moduleFilter.every(m => en.includes(m));
      });
    }
    arr.sort((a, b) => {
      if (sortBy === 'name') return a.nome.localeCompare(b.nome);
      if (sortBy === 'code') return a.cod_empresa_bi.localeCompare(b.cod_empresa_bi);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return arr;
  }, [lista, search, statusFilter, moduleFilter, sortBy]);

  const toggleModule = (m: string) =>
    setModuleFilter(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]));

  const handleDuplicate = (e: Empresa) => {
    toast({ title: 'Duplicar empresa', description: `Em breve: duplicar "${e.nome}".` });
  };
  const handleTestConnection = (e: Empresa) => {
    toast({ title: 'Testando conexão', description: `Verificando endpoint de ${e.nome}...` });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Você precisa estar autenticado.</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!isMaster) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Apenas usuários master podem acessar a gestão de empresas.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const sortLabel = sortBy === 'name' ? 'Nome' : sortBy === 'code' ? 'Código' : 'Recente';
  const statusLabel = statusFilter === 'all' ? 'Todos' : statusFilter === 'ativa' ? 'Ativa' : statusFilter === 'inativa' ? 'Inativa' : 'Pendente';

  return (
    <PelegriniPageSurface moduleKey="financeiro" className="min-h-screen">
      <div className="relative max-w-[1200px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 animate-fade-in">
          <div className="min-w-0">
            <button
              onClick={() => navigate('/configuracoes')}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 group"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Voltar
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestão de Empresas</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm text-[11px] font-medium text-muted-foreground tabular-nums">
                <Building2 className="h-3 w-3 text-primary" />
                {lista.length} {lista.length === 1 ? 'empresa' : 'empresas'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">
              Gerencie empresas, endpoints e módulos disponíveis.
            </p>
          </div>
          <Button onClick={handleNew} className="gap-2 shrink-0 shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all">
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Button>
        </div>


        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa ou código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 bg-card/50 border-border/60"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-card/50 border-border/60">
                Status: <span className="font-medium text-foreground">{statusLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ativa">Ativa</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="inativa">Inativa</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="pendente">Pendente</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-card/50 border-border/60">
                Módulos
                {moduleFilter.length > 0 && (
                  <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold inline-flex items-center justify-center">
                    {moduleFilter.length}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Filtrar por módulo
              </DropdownMenuLabel>
              {MODULES.map(m => (
                <DropdownMenuCheckboxItem
                  key={m.key}
                  checked={moduleFilter.includes(m.key)}
                  onCheckedChange={() => toggleModule(m.key)}
                >
                  {m.label}
                </DropdownMenuCheckboxItem>
              ))}
              {moduleFilter.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setModuleFilter([])} className="text-xs text-muted-foreground">
                    Limpar filtros
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-card/50 border-border/60">
                Ordenar: <span className="font-medium text-foreground">{sortLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <DropdownMenuRadioItem value="name">Nome (A–Z)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="code">Código</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="recent">Atualização recente</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Lista */}
        {isLoading ? (
          <LoadingState message="Carregando empresas..." />
        ) : error ? (
          <ErrorState message="Não foi possível carregar as empresas." onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 py-20 px-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-muted/40 border border-border flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {lista.length === 0 ? 'Nenhuma empresa cadastrada' : 'Nenhum resultado'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
              {lista.length === 0
                ? 'Comece adicionando a primeira empresa.'
                : 'Ajuste os filtros para encontrar empresas.'}
            </p>
            {lista.length === 0 && (
              <Button onClick={handleNew} size="sm" className="mt-5 gap-2">
                <Plus className="h-4 w-4" /> Nova Empresa
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden shadow-xl shadow-black/5 animate-fade-in">
            {/* Header */}
            <div className="hidden md:grid grid-cols-[1.4fr_1.4fr_1.6fr_0.8fr_60px] gap-4 px-5 py-3 border-b border-border/60 bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div>Empresa</div>
              <div>Endpoint</div>
              <div>Módulos</div>
              <div>Status</div>
              <div className="text-right">Ações</div>
            </div>

            <ul className="divide-y divide-border/60">
              {filtered.map((empresa, idx) => {
                const status = getStatus(empresa);
                const enabled = getModulesEnabled(empresa);
                const endpoint = empresa.usar_vps_intermediaria
                  ? `VPS RSYS → /${empresa.vps_cliente_identificador || '—'}`
                  : empresa.endpoint_url || '—';

                return (
                  <li
                    key={empresa.id}
                    onClick={() => handleEdit(empresa)}
                    style={{ animationDelay: `${Math.min(idx * 30, 300)}ms`, animationFillMode: 'backwards' }}
                    className={cn(
                      'relative grid grid-cols-1 md:grid-cols-[1.4fr_1.4fr_1.6fr_0.8fr_60px] gap-3 md:gap-4 px-5 py-4',
                      'transition-all duration-200 cursor-pointer group animate-fade-in',
                      'hover:bg-primary/[0.035]',
                    )}
                  >
                    {/* Accent bar on hover */}
                    <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-primary opacity-0 scale-y-0 group-hover:opacity-100 group-hover:scale-y-100 transition-all duration-300 origin-center" />

                    {/* Empresa */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105 group-hover:border-primary/40">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{empresa.nome}</p>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5 tracking-wider">
                          {empresa.cod_empresa_bi}
                        </p>
                      </div>
                    </div>

                    {/* Endpoint */}
                    <div className="min-w-0 flex items-center">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                        <Plug className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100 group-hover:text-primary transition-all" />
                        <span className="truncate font-mono" title={endpoint}>
                          {endpoint}
                        </span>
                      </div>
                    </div>

                    {/* Módulos */}
                    <div className="flex items-center flex-wrap gap-1.5">
                      {enabled.length === 0 ? (
                        <span className="text-xs text-muted-foreground/60 italic">Nenhum</span>
                      ) : (
                        enabled.map(key => {
                          const mod = MODULES.find(m => m.key === key)!;
                          const Icon = mod.icon;
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border/60 text-[11px] font-medium text-foreground/80 transition-all duration-200 group-hover:border-primary/30 group-hover:bg-primary/[0.06] group-hover:text-foreground"
                            >
                              <Icon className="h-3 w-3 opacity-70" />
                              {mod.label}
                            </span>
                          );
                        })
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex items-center">
                      <StatusPill status={status} />
                    </div>



                    {/* Ações */}
                    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:scale-105"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleEdit(empresa)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(empresa)}>
                            <Settings2 className="h-4 w-4 mr-2" /> Configurar módulos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTestConnection(empresa)}>
                            <Check className="h-4 w-4 mr-2" /> Testar conexão
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(empresa)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(empresa)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border/60 bg-muted/10 text-[11px] text-muted-foreground tabular-nums">
              Exibindo <span className="text-foreground font-medium">{filtered.length}</span> de{' '}
              <span className="text-foreground font-medium">{lista.length}</span> empresas
            </div>
          </div>
        )}
      </div>

      <EmpresaFormDialog open={dialogOpen} onOpenChange={handleDialogClose} empresa={selectedEmpresa} />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PelegriniPageSurface>
  );
}
