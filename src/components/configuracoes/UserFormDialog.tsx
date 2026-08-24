import { useState, useEffect } from 'react';
import { Loader2, Crown, Shield, User, Building2, Eye, EyeOff, MessageSquare, DollarSign, BarChart3, Bot, TrendingUp, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types/auth';
import { ROLE_PERMISSIONS } from '@/types/auth';
import { useEmpresas } from '@/hooks/useEmpresaConfig';
import { getFiliaisDaEmpresa } from '@/config/filiaisEmpresa';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string | null;
  onSuccess: () => void;
  defaultRole?: AppRole;
  defaultCodEmpresa?: string;
}

interface ModulePermissions {
  modulo_dre: boolean;
  modulo_variacao: boolean;
  modulo_comercial: boolean;
  modulo_assistente_ia: boolean;
  modulo_whatsapp: boolean;
  modulo_operacional: boolean;
  modulo_resumo: boolean;
}

// Hierarchical module→pages structure
interface ModuleConfig {
  key: keyof ModulePermissions;
  label: string;
  icon: React.ElementType;
  color: string;
  pages: { key: string; label: string }[];
}

const MODULE_HIERARCHY: ModuleConfig[] = [
  {
    key: 'modulo_whatsapp',
    label: 'WhatsApp',
    icon: MessageSquare,
    color: 'text-green-500',
    pages: [
      { key: 'whatsapp_chat', label: 'Conversas' },
      { key: 'whatsapp_relatorios', label: 'Relatórios' },
      { key: 'whatsapp_configuracoes', label: 'Configurações' },
    ],
  },
  {
    key: 'modulo_comercial',
    label: 'Comercial',
    icon: BarChart3,
    color: 'text-blue-500',
    pages: [
      { key: 'comercial_dashboard', label: 'Dashboard / Metas' },
      { key: 'comercial_metas_diarias', label: 'Metas Diárias' },
      { key: 'comercial_clientes', label: 'Análise de Clientes' },
    ],
  },
  {
    key: 'modulo_operacional',
    label: 'Operacional',
    icon: Package,
    color: 'text-amber-500',
    pages: [
      { key: 'operacional_estoque', label: 'Estoque' },
      { key: 'operacional_assistente', label: 'Assistente de Estoque' },
    ],
  },
  {
    key: 'modulo_resumo',
    label: 'Resumo Financeiro',
    icon: DollarSign,
    color: 'text-sky-500',
    pages: [
      { key: 'financeiro_resumo', label: 'Resumo / Recebíveis' },
    ],
  },
  {
    key: 'modulo_dre',
    label: 'DRE',
    icon: DollarSign,
    color: 'text-emerald-500',
    pages: [
      { key: 'financeiro_dre', label: 'Demonstrativo de Resultados' },
    ],
  },
  {
    key: 'modulo_variacao',
    label: 'Variação / DFC',
    icon: TrendingUp,
    color: 'text-purple-500',
    pages: [
      { key: 'financeiro_variacao', label: 'Variação Patrimonial' },
      { key: 'financeiro_dfc', label: 'Fluxo de Caixa (DFC)' },
    ],
  },
  {
    key: 'modulo_assistente_ia',
    label: 'Assistente Financeiro',
    icon: Bot,
    color: 'text-orange-500',
    pages: [
      { key: 'financeiro_assistente_dre', label: 'Assistente DRE' },
      { key: 'financeiro_assistente_variacao', label: 'Assistente Variação' },
    ],
  },
];

type PagePermissions = Record<string, boolean>;

const isFiliaisPermitidasSchemaError = (error: unknown) => {
  const supabaseError = error as { code?: string; message?: string; details?: string };
  const errorText = [
    supabaseError?.code,
    supabaseError?.message,
    supabaseError?.details,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    errorText.includes('filiais_permitidas') &&
    (errorText.includes('schema cache') ||
      errorText.includes('could not find') ||
      supabaseError?.code === 'PGRST204')
  );
};

const getEdgeFunctionErrorMessage = async (error: any) => {
  const fallback =
    error?.name === 'FunctionsHttpError'
      ? 'A função de criação de usuário retornou erro. Verifique se a Edge Function create-user foi publicada no Supabase.'
      : error?.message || 'Não foi possível salvar o usuário.';
  const response = error?.context;

  if (!response || typeof response.json !== 'function') {
    return fallback;
  }

  try {
    const body = await response.clone().json();
    const message = body?.error || body?.message;
    if (message === 'Internal server error') {
      return 'A Edge Function create-user está retornando erro interno em produção. Publique a versão atual da função no Supabase para criar usuários.';
    }
    return message || fallback;
  } catch {}

  try {
    const text = await response.clone().text();
    if (text === 'Internal server error') {
      return 'A Edge Function create-user está retornando erro interno em produção. Publique a versão atual da função no Supabase para criar usuários.';
    }
    return text || fallback;
  } catch {
    return fallback;
  }
};

export function UserFormDialog({ 
  open, 
  onOpenChange, 
  userId, 
  onSuccess,
  defaultRole,
  defaultCodEmpresa,
}: UserFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [nome, setNome] = useState('');
  const [codEmpresaBi, setCodEmpresaBi] = useState('');
  const [filialId, setFilialId] = useState<string>('');
  const [filiaisPermitidas, setFiliaisPermitidas] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<AppRole>('vendedor');
  const [modulePermissions, setModulePermissions] = useState<ModulePermissions>({
    modulo_dre: false,
    modulo_variacao: false,
    modulo_comercial: false,
    modulo_assistente_ia: false,
    modulo_whatsapp: true,
    modulo_operacional: false,
    modulo_resumo: false,
  });
  const [pagePermissions, setPagePermissions] = useState<PagePermissions>({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { isMaster, isGerencial, codEmpresa } = useAuth();
  const { data: empresas = [], isLoading: loadingEmpresas } = useEmpresas();

  const isEditing = !!userId;

  const availableRoles: AppRole[] = isMaster 
    ? ['master', 'gerencial', 'vendedor'] 
    : ['vendedor'];

  const selectedCompany = empresas.find(e => e.cod_empresa_bi === codEmpresaBi);
  const filiaisDisponiveis = getFiliaisDaEmpresa(codEmpresaBi);
  const filialIdsDisponiveis = filiaisDisponiveis.map((filial) => filial.id);

  useEffect(() => {
    if (open) {
      if (userId) {
        loadUserData();
      } else {
        resetForm();
      }
    }
  }, [userId, open]);

  useEffect(() => {
    if (!isEditing && selectedCompany) {
      setModulePermissions({
        modulo_dre: selectedCompany.modulo_dre ?? false,
        modulo_variacao: selectedCompany.modulo_variacao ?? false,
        modulo_comercial: selectedCompany.modulo_comercial ?? false,
        modulo_assistente_ia: selectedCompany.modulo_assistente_ia ?? false,
        modulo_whatsapp: selectedCompany.modulo_whatsapp ?? false,
        modulo_operacional: selectedCompany.modulo_operacional ?? false,
        modulo_resumo: selectedCompany.modulo_resumo ?? false,
      });
    }
  }, [codEmpresaBi, selectedCompany, isEditing]);

  useEffect(() => {
    if (selectedRole === 'master') {
      setFiliaisPermitidas([]);
      setFilialId('');
      return;
    }

    setFiliaisPermitidas((prev) =>
      prev.filter((filialId) => filialIdsDisponiveis.includes(filialId))
    );
  }, [selectedRole, codEmpresaBi]);

  const resetForm = () => {
    setEmail('');
    setNome('');
    setTempPassword(null);
    setCopied(false);
    setCodEmpresaBi(defaultCodEmpresa || (isGerencial ? codEmpresa || '' : ''));
    setFilialId('');
    setFiliaisPermitidas([]);
    setSelectedRole(defaultRole || 'vendedor');
    setModulePermissions({
      modulo_dre: false,
      modulo_variacao: false,
      modulo_comercial: false,
      modulo_assistente_ia: false,
      modulo_whatsapp: true,
      modulo_operacional: false,
      modulo_resumo: false,
    });
    setPagePermissions({});
    setExpandedModules(new Set());
  };

  const loadUserData = async () => {
    if (!userId) return;

    try {
      setLoadingUser(true);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      const { data: permissions, error: permError } = await supabase
        .from('user_module_permissions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      setEmail(profile.email);
      setNome(profile.nome || '');
      setCodEmpresaBi(profile.cod_empresa_bi || '');
      const filialPadrao = ((profile as any).filial_id as string) || '';
      const permitidas = Array.isArray((profile as any).filiais_permitidas)
        ? ((profile as any).filiais_permitidas as string[]).filter(Boolean)
        : filialPadrao
          ? [filialPadrao]
          : [];
      setFilialId(filialPadrao);
      setFiliaisPermitidas(permitidas);
      
      
      const userRoles = (roles || []).map(r => r.role as AppRole);
      if (userRoles.includes('master')) {
        setSelectedRole('master');
      } else if (userRoles.includes('gerencial')) {
        setSelectedRole('gerencial');
      } else {
        setSelectedRole('vendedor');
      }

      if (permissions) {
        setModulePermissions({
          modulo_dre: permissions.modulo_dre ?? false,
          modulo_variacao: permissions.modulo_variacao ?? false,
          modulo_comercial: permissions.modulo_comercial ?? false,
          modulo_assistente_ia: permissions.modulo_assistente_ia ?? false,
          modulo_whatsapp: permissions.modulo_whatsapp ?? false,
          modulo_operacional: permissions.modulo_operacional ?? false,
          modulo_resumo: (permissions as any).modulo_resumo ?? false,
        });
        // Load page-level permissions from JSONB
        const paginas = (permissions as any).permissoes_paginas;
        if (paginas && typeof paginas === 'object') {
          setPagePermissions(paginas as PagePermissions);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados do usuário.',
        variant: 'destructive',
      });
      onOpenChange(false);
    } finally {
      setLoadingUser(false);
    }
  };

  const toggleModule = (moduleKey: keyof ModulePermissions, checked: boolean) => {
    setModulePermissions(prev => ({ ...prev, [moduleKey]: checked }));
    
    // When enabling a module, enable all its pages by default
    const moduleConfig = MODULE_HIERARCHY.find(m => m.key === moduleKey);
    if (moduleConfig) {
      const newPagePerms = { ...pagePermissions };
      moduleConfig.pages.forEach(p => {
        newPagePerms[p.key] = checked;
      });
      setPagePermissions(newPagePerms);
    }
  };

  const togglePage = (pageKey: string) => {
    setPagePermissions(prev => ({ ...prev, [pageKey]: !prev[pageKey] }));
  };

  const toggleExpanded = (moduleKey: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleKey)) next.delete(moduleKey);
      else next.add(moduleKey);
      return next;
    });
  };

  const isAllPagesEnabled = (moduleConfig: ModuleConfig) => {
    return moduleConfig.pages.every(p => pagePermissions[p.key] !== false);
  };

  const enabledPageCount = (moduleConfig: ModuleConfig) => {
    return moduleConfig.pages.filter(p => pagePermissions[p.key] !== false).length;
  };

  const toggleFilialPermitida = (filialId: string) => {
    setFiliaisPermitidas((prev) =>
      prev.includes(filialId)
        ? prev.filter((id) => id !== filialId)
        : [...prev, filialId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRole !== 'master' && !codEmpresaBi) {
      toast({
        title: 'Erro',
        description: 'Código da empresa é obrigatório para usuários Gerencial e Vendedor.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const filiaisParaSalvar = selectedRole === 'master'
        ? []
        : filiaisDisponiveis.length > 0
          ? filiaisPermitidas
          : [];
      const filialPadraoParaSalvar = filiaisParaSalvar.length === 1 ? filiaisParaSalvar[0] : null;

      if (isEditing) {
        const profilePayload = {
          nome,
          cod_empresa_bi: selectedRole === 'master' ? null : codEmpresaBi,
          filial_id: filialPadraoParaSalvar,
          filiais_permitidas: filiaisParaSalvar,
        };
        const profileFallbackPayload = {
          nome,
          cod_empresa_bi: selectedRole === 'master' ? null : codEmpresaBi,
          filial_id: filialPadraoParaSalvar,
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profilePayload as any)
          .eq('user_id', userId);

        let salvouComFallbackFilial = false;
        if (profileError) {
          if (!isFiliaisPermitidasSchemaError(profileError)) {
            throw profileError;
          }

          const { error: fallbackError } = await supabase
            .from('profiles')
            .update(profileFallbackPayload as any)
            .eq('user_id', userId);

          if (fallbackError) throw fallbackError;
          salvouComFallbackFilial = true;
        }

        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);

        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: selectedRole });

        if (roleError) throw roleError;

        const { error: permError } = await supabase
          .from('user_module_permissions')
          .upsert({
            user_id: userId,
            ...modulePermissions,
            permissoes_paginas: pagePermissions,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: 'user_id' });

        if (permError) {
          console.error('Erro ao atualizar permissões:', permError);
          throw new Error('Não foi possível salvar as permissões do usuário.');
        }

        toast({
          title: 'Usuário atualizado',
          description: salvouComFallbackFilial
            ? 'Dados salvos. A liberação por múltiplas filiais ficará ativa após aplicar a migração do banco.'
            : 'Os dados do usuário foram atualizados com sucesso.',
        });
      } else {
        const createPayload = {
          email,
          nome,
          cod_empresa_bi: selectedRole === 'master' ? null : codEmpresaBi,
          filial_id: filialPadraoParaSalvar,
          filiais_permitidas: filiaisParaSalvar,
          role: selectedRole,
          module_permissions: {
            ...modulePermissions,
            permissoes_paginas: pagePermissions,
          },
        };

        const { data, error } = await supabase.functions.invoke('create-user', {
          body: createPayload,
        });

        if (error) throw new Error(await getEdgeFunctionErrorMessage(error));
        if (data?.error) throw new Error(data.error);

        if (data?.temp_password) {
          setTempPassword(data.temp_password);
          toast({
            title: 'Usuário criado',
            description: 'Senha temporária gerada. Compartilhe com o usuário.',
          });
          setLoading(false);
          return; // mantém dialog aberto; refresh ocorre ao clicar em Concluir
        }

        toast({
          title: 'Usuário criado',
          description: 'O novo usuário foi criado com sucesso.',
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar o usuário.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case 'master':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'gerencial':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'vendedor':
        return <User className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do usuário abaixo.'
              : 'Preencha os dados para criar um novo usuário.'}
          </DialogDescription>
        </DialogHeader>

        {loadingUser ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : tempPassword ? (
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium mb-2">Senha temporária gerada</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all rounded bg-background px-3 py-2 font-mono text-sm border">
                  {tempPassword}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(tempPassword);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                ⚠️ Esta senha é apenas para o primeiro login. O usuário será obrigado a definir uma nova senha ao entrar. Ela não será mostrada novamente.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onSuccess()}>
                Concluir
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
                disabled={isEditing}
              />
            </div>

            {!isEditing && (
              <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                Uma senha temporária será gerada automaticamente ao salvar. O usuário será obrigado a trocá-la no primeiro acesso.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>

            {/* Seletor de Tipo/Role */}
            <div className="space-y-2">
              <Label>Tipo de Usuário</Label>
              <Select
                value={selectedRole}
                onValueChange={(value: AppRole) => {
                  setSelectedRole(value);
                  if (value === 'master') {
                    setCodEmpresaBi('');
                  }
                }}
                disabled={!isMaster && isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role)}
                        <span className="font-medium">
                          {ROLE_PERMISSIONS[role].label}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_PERMISSIONS[selectedRole].description}
              </p>
            </div>

            {/* Campo Empresa */}
            <div className="space-y-2">
              <Label htmlFor="codEmpresa" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Empresa
              </Label>
              <Select
                value={codEmpresaBi || undefined}
                onValueChange={(value) => setCodEmpresaBi(value)}
                disabled={selectedRole === 'master' || (!isMaster && isGerencial) || loadingEmpresas}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas
                    .filter(e => e.ativo && e.cod_empresa_bi !== 'MASTER')
                    .map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.cod_empresa_bi}>
                        {empresa.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedRole === 'master'
                  ? 'Usuários Master têm acesso a todas as empresas.'
                  : 'Selecione a empresa que este usuário poderá acessar.'}
              </p>
            </div>

            {/* Permissões de Filial (quando a empresa possui filiais distintas) */}
            {selectedRole !== 'master' && filiaisDisponiveis.length > 0 && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Filiais permitidas
                </Label>
                <div className="rounded-lg border bg-muted/20 divide-y divide-border">
                  {filiaisDisponiveis.map((filial) => (
                    <label
                      key={filial.id}
                      htmlFor={`filial-${filial.id}`}
                      className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <Checkbox
                        id={`filial-${filial.id}`}
                        checked={filiaisPermitidas.includes(filial.id)}
                        onCheckedChange={() => toggleFilialPermitida(filial.id)}
                      />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium">{filial.nome}</span>
                        <span className="block text-xs text-muted-foreground">
                          {filiaisPermitidas.includes(filial.id)
                            ? 'Liberada para este usuário.'
                            : 'Aparecerá bloqueada no modal de filiais.'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  No cliente Pelegrini 1004, CT e CCH aparecem no modal para o usuário, mas somente as filiais marcadas ficam acessíveis.
                </p>
              </div>
            )}


            {/* Permissões Hierárquicas de Módulos */}
            {selectedRole !== 'master' && (
              <div className="space-y-3">
                <Label>Permissões de Módulos</Label>
                <p className="text-xs text-muted-foreground">
                  Ative o módulo para liberar acesso total, ou expanda para restringir páginas específicas.
                </p>
                <div className="border rounded-lg bg-muted/20 divide-y divide-border">
                  {MODULE_HIERARCHY.map(({ key, label, icon: Icon, color, pages }) => {
                    const isEnabled = modulePermissions[key];
                    const isExpanded = expandedModules.has(key);
                    const allPages = pages.length;
                    const enabledPages = enabledPageCount({ key, label, icon: Icon, color, pages });

                    return (
                      <div key={key}>
                        {/* Module level */}
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => isEnabled && toggleExpanded(key)}
                            className={`shrink-0 transition-colors ${isEnabled ? 'text-muted-foreground hover:text-foreground cursor-pointer' : 'text-muted-foreground/30 cursor-default'}`}
                          >
                            {isExpanded && isEnabled ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => toggleModule(key, checked)}
                          />
                          <Icon className={`h-4 w-4 ${isEnabled ? color : 'text-muted-foreground/40'}`} />
                          <span className={`text-sm font-medium flex-1 ${isEnabled ? '' : 'text-muted-foreground/60'}`}>
                            {label}
                          </span>
                          {isEnabled && (
                            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                              {enabledPages}/{allPages}
                            </span>
                          )}
                        </div>

                        {/* Sub-pages */}
                        {isEnabled && isExpanded && (
                          <div className="pb-2 pl-14 pr-3 space-y-1">
                            {pages.map(page => (
                              <div key={page.key} className="flex items-center gap-2.5 py-1">
                                <Checkbox
                                  id={page.key}
                                  checked={pagePermissions[page.key] !== false}
                                  onCheckedChange={() => togglePage(page.key)}
                                />
                                <label
                                  htmlFor={page.key}
                                  className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                >
                                  {page.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedRole === 'vendedor' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Vendedores só visualizam suas próprias conversas no WhatsApp.
                  </p>
                )}
              </div>
            )}

            {selectedRole === 'master' && (
              <p className="text-xs text-muted-foreground p-3 border rounded-lg bg-yellow-500/10 border-yellow-500/30">
                ⚡ Usuários Master têm acesso a todos os módulos automaticamente.
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar Usuário'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
