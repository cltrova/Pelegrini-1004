import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { 
  Wifi,
  WifiOff,
  Plus,
  QrCode,
  Globe,
  MessageSquarePlus,
  Ban,
  Zap,
  Settings,
  Server,
  Link,
  Key,
  Save,
  Wrench,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Copy,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  RefreshCw,
  Smartphone,
  Phone
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { useWhatsappInstances, useWhatsappRealtime } from '@/hooks/useWhatsappData';
import { useCreateInstance, useUpdateInstance, useDeleteInstance, useTestInstance, useConnectInstance, useDisconnectInstance, useInviteMember } from '@/hooks/useWhatsappSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: 'link' | 'button';
  actionLabel?: string;
  actionUrl?: string;
}

interface InstanceFormData {
  name: string;
  instance_name: string;
  api_url: string;
  api_key: string;
}

interface SellerFormData {
  nome: string;
  email: string;
}

const SETUP_STEPS: SetupStep[] = [
  { id: '1', title: 'Acesse o painel Evolution', description: 'Abra o servidor Evolution onde as conexões WhatsApp são gerenciadas.', icon: <Globe className="h-4 w-4" />, action: 'link', actionLabel: 'Abrir', actionUrl: 'https://evolution-api.com' },
  { id: '2', title: 'Crie uma instância para o vendedor', description: 'No Evolution, crie uma conexão dedicada (ex: "joao_vendas"). Cada vendedor precisa da própria.', icon: <MessageSquarePlus className="h-4 w-4" /> },
  { id: '3', title: 'Desative mensagens de grupo', description: 'Nas configurações da instância, ignore grupos para evitar ruído.', icon: <Ban className="h-4 w-4" /> },
  { id: '4', title: 'Cadastre a instância aqui', description: 'Clique em "Conectar Vendedor" e preencha URL, API Key e nome técnico.', icon: <Zap className="h-4 w-4" />, action: 'button', actionLabel: 'Conectar Vendedor' },
  { id: '5', title: 'Escaneie o QR com o celular do vendedor', description: 'Use o WhatsApp do número de trabalho dele. Após conectar, o vendedor é vinculado automaticamente pelo telefone.', icon: <QrCode className="h-4 w-4" /> },
  { id: '6', title: 'Configure o Webhook no Evolution', description: 'Cole a URL do webhook (botão copiar no card) na configuração da instância no Evolution.', icon: <Wrench className="h-4 w-4" /> },
  { id: '7', title: 'Repita para cada vendedor', description: 'Uma instância por vendedor. Cada conversa cliente↔vendedor cai automaticamente no painel.', icon: <Smartphone className="h-4 w-4" /> },
];

const STORAGE_KEY = 'whatsapp-setup-progress';

export function InstancesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresa, hasEmpresaSelecionada } = useEmpresaAtiva();
  const { data: instances = [], isLoading } = useWhatsappInstances();
  const { subscribeToInstances } = useWhatsappRealtime();
  const createInstance = useCreateInstance();
  const updateInstance = useUpdateInstance();
  const deleteInstance = useDeleteInstance();
  const testInstance = useTestInstance();
  const connectInstance = useConnectInstance();
  const disconnectInstance = useDisconnectInstance();
  const inviteMember = useInviteMember();
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);
  const [qrInstance, setQrInstance] = useState<any>(null);
  const [formData, setFormData] = useState<InstanceFormData>({
    name: '',
    instance_name: '',
    api_url: '',
    api_key: '',
  });
  const [addSeller, setAddSeller] = useState(false);
  const [sellerData, setSellerData] = useState<SellerFormData>({
    nome: '',
    email: '',
  });
  
  // Subscribe to instance updates for realtime QR/status
  useEffect(() => {
    const unsubscribe = subscribeToInstances();
    return unsubscribe;
  }, []);
  
  // Polling for QR code status
  useEffect(() => {
    if (!isQRModalOpen || !qrInstance) return;
    
    const interval = setInterval(async () => {
      try {
        await testInstance.mutateAsync(qrInstance.id);
      } catch (error) {
        console.error('Error polling status:', error);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isQRModalOpen, qrInstance]);
  
  // Update qrInstance when instances change and auto-sync when connected
  useEffect(() => {
    if (qrInstance) {
      const updated = instances.find((i: any) => i.id === qrInstance.id);
      if (updated) {
        setQrInstance(updated);
        // Auto-sync phone when connected
        if (updated.status === 'connected' && !updated.phone_e164) {
          handleSyncPhone(updated.id, true);
        }
        // Close modal if connected
        if (updated.status === 'connected') {
          setIsQRModalOpen(false);
          toast({ title: 'Conectado!', description: 'WhatsApp conectado com sucesso.' });
        }
      }
    }
  }, [instances]);
  
  const handleSyncPhone = async (instanceId: string, silent = false) => {
    setIsSyncing(instanceId);
    try {
      const { data, error } = await supabase.functions.invoke('sync-instance-phone', {
        body: { instanceId },
      });
      
      if (error) throw error;
      
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
        if (!silent) {
          toast({ 
            title: 'Vendedor vinculado!', 
            description: `Telefone ${data.phone_e164} sincronizado.`,
          });
        }
      } else if (data?.error && !silent) {
        toast({ 
          title: 'Erro ao sincronizar', 
          description: data.message || data.error,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      if (!silent) {
        toast({ 
          title: 'Erro ao sincronizar', 
          description: error.message || 'Tente novamente.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSyncing(null);
    }
  };
  
  const progressPercent = (completedSteps.length / SETUP_STEPS.length) * 100;
  
  const toggleStep = (stepId: string) => {
    const newCompleted = completedSteps.includes(stepId)
      ? completedSteps.filter(id => id !== stepId)
      : [...completedSteps, stepId];
    
    setCompletedSteps(newCompleted);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCompleted));
  };
  
  const resetProgress = () => {
    setCompletedSteps([]);
    localStorage.removeItem(STORAGE_KEY);
  };
  
  const handleNew = () => {
    if (!hasEmpresaSelecionada) {
      toast({
        title: 'Empresa não selecionada',
        description: 'Selecione uma empresa no menu antes de criar uma instância.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedInstance(null);
    setFormData({ name: '', instance_name: '', api_url: '', api_key: '' });
    setAddSeller(false);
    setSellerData({ nome: '', email: '' });
    setIsFormOpen(true);
  };
  
  const handleEdit = (instance: any) => {
    setSelectedInstance(instance);
    setFormData({
      name: instance.name || '',
      instance_name: instance.instance_name || '',
      api_url: instance.api_url || '',
      api_key: '', // Don't show existing key
    });
    setAddSeller(false);
    setSellerData({ nome: '', email: '' });
    setIsFormOpen(true);
  };
  
  const handleDelete = (instance: any) => {
    setSelectedInstance(instance);
    setIsDeleteOpen(true);
  };
  
  const handleTest = async (instance: any) => {
    try {
      const result = await testInstance.mutateAsync(instance.id);
      toast({ 
        title: result.status === 'connected' ? 'Conectado!' : 'Status: ' + result.status,
        description: result.status === 'connected' ? 'Instância conectada.' : 'Verifique a conexão.',
      });
    } catch (error) {
      toast({ 
        title: 'Erro de conexão', 
        description: 'Verifique as credenciais e tente novamente.',
        variant: 'destructive',
      });
    }
  };
  
  const handleConnect = async (instance: any) => {
    try {
      setQrInstance(instance);
      setIsQRModalOpen(true);
      await connectInstance.mutateAsync(instance.id);
    } catch (error) {
      toast({ 
        title: 'Erro ao conectar', 
        description: 'Não foi possível gerar o QR Code.',
        variant: 'destructive',
      });
    }
  };
  
  const handleDisconnect = async (instance: any) => {
    try {
      await disconnectInstance.mutateAsync(instance.id);
      toast({ title: 'Desconectado', description: 'WhatsApp desconectado.' });
    } catch (error) {
      toast({ 
        title: 'Erro ao desconectar', 
        variant: 'destructive',
      });
    }
  };
  
  const copyWebhook = () => {
    const webhookUrl = `https://jegjihccrjqakqdodcrj.supabase.co/functions/v1/evolution-webhook`;
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: 'URL do Webhook copiada!' });
  };
  const handleSubmit = async () => {
    if (!hasEmpresaSelecionada) {
      toast({
        title: 'Empresa não selecionada',
        description: 'Selecione uma empresa no menu antes de criar uma instância.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.name || !formData.instance_name || !formData.api_url) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!selectedInstance && !formData.api_key) {
      toast({
        title: 'Campo obrigatório',
        description: 'API Key é obrigatória para nova instância.',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate seller data if adding seller
    if (addSeller && !selectedInstance) {
      if (!sellerData.nome || !sellerData.email) {
        toast({
          title: 'Dados do vendedor incompletos',
          description: 'Preencha nome e email do vendedor.',
          variant: 'destructive',
        });
        return;
      }
    }
    
    try {
      if (selectedInstance) {
        await updateInstance.mutateAsync({
          id: selectedInstance.id,
          ...formData,
        });
        toast({ title: 'Instância atualizada!' });
      } else {
        await createInstance.mutateAsync(formData);
        
        // Create seller if option is enabled
        if (addSeller && sellerData.nome && sellerData.email) {
          try {
            await inviteMember.mutateAsync(sellerData);
            toast({ title: 'Instância e vendedor criados com sucesso!' });
          } catch (sellerError: any) {
            toast({ 
              title: 'Instância criada!',
              description: `Vendedor não cadastrado: ${sellerError.message || 'Erro desconhecido'}`,
              variant: 'default',
            });
          }
        } else {
          toast({ title: 'Instância criada com sucesso!' });
        }
      }
      setIsFormOpen(false);
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };
  
  const confirmDelete = async () => {
    if (!selectedInstance) return;
    
    try {
      await deleteInstance.mutateAsync(selectedInstance.id);
      toast({ title: 'Instância removida!' });
      setIsDeleteOpen(false);
    } catch (error) {
      toast({
        title: 'Erro ao remover',
        variant: 'destructive',
      });
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Conectado</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Desconectado</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Conectando</Badge>;
      case 'qr_pending':
        return <Badge variant="outline">Aguardando QR</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  if (isLoading) {
    return <LoadingState message="Carregando instâncias..." />;
  }
  
  return (
    <div className="space-y-6">
      {/* Setup Guide */}
      <Collapsible open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isGuideOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  <div>
                    <CardTitle className="text-base">Como conectar um vendedor</CardTitle>
                    <CardDescription>Cada vendedor precisa de uma instância Evolution própria, conectada ao número de WhatsApp dele.</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{completedSteps.length}/{SETUP_STEPS.length}</Badge>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); resetProgress(); }}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <Progress value={progressPercent} className="h-2" />
              
              <div className="grid gap-2">
                {SETUP_STEPS.map((step) => (
                  <div 
                    key={step.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      completedSteps.includes(step.id) 
                        ? "bg-primary/5 border-primary/30" 
                        : "bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={completedSteps.includes(step.id)}
                      onCheckedChange={() => toggleStep(step.id)}
                    />
                    <div className={cn(
                      "p-1.5 rounded-md",
                      completedSteps.includes(step.id) ? "bg-primary/10 text-primary" : "bg-muted"
                    )}>
                      {step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        completedSteps.includes(step.id) && "text-primary"
                      )}>
                        {step.id}. {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    {step.action === 'link' && step.actionUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={step.actionUrl} target="_blank" rel="noopener noreferrer">
                          {step.actionLabel}
                        </a>
                      </Button>
                    )}
                    {step.action === 'button' && step.id === '4' && (
                      <Button variant="outline" size="sm" onClick={handleNew}>
                        {step.actionLabel}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      
      {/* Instances List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold">Vendedores conectados</h2>
            <p className="text-sm text-muted-foreground">
              {instances.length === 0
                ? 'Nenhuma instância cadastrada ainda.'
                : (() => {
                    const connected = instances.filter((i: any) => i.status === 'connected').length;
                    const linked = instances.filter((i: any) => i.default_seller_id).length;
                    return `${connected} de ${instances.length} ${instances.length === 1 ? 'conexão ativa' : 'conexões ativas'} • ${linked} vinculada${linked === 1 ? '' : 's'} a vendedor`;
                  })()}
            </p>
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Conectar Vendedor
          </Button>
        </div>
        
        {!hasEmpresaSelecionada && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-amber-500 shrink-0" />
              <p className="text-sm">
                Selecione uma empresa no menu superior para cadastrar conexões de vendedores.
              </p>
            </CardContent>
          </Card>
        )}
        
        {instances.length === 0 ? (
          <EmptyState
            icon={<QrCode className="h-12 w-12" />}
            title="Nenhum vendedor conectado"
            message='Clique em "Conectar Vendedor" para criar a primeira conexão. Cada vendedor precisa de uma instância dedicada.'
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {instances.map((instance: any) => (
              <Card key={instance.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{instance.name}</CardTitle>
                    {getStatusBadge(instance.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {instance.instance_name}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Vendor link block - prominent */}
                  <div className={cn(
                    "p-3 rounded-lg border",
                    instance.default_seller_id
                      ? "bg-primary/5 border-primary/30"
                      : instance.status === 'connected'
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-muted/40 border-border"
                  )}>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      <Smartphone className="h-3.5 w-3.5" />
                      Vendedor
                    </div>
                    {instance.default_seller_id ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-primary">Vinculado ✓</p>
                        {instance.phone_number && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {instance.phone_number}
                          </p>
                        )}
                      </div>
                    ) : instance.status === 'connected' ? (
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        Conectado, mas sem vendedor vinculado. Clique em "Vincular Vendedor" abaixo.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aguardando conexão via QR Code.
                      </p>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Criada em {format(new Date(instance.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                  
                  
                  {/* Show sync button if connected AND (no phone OR no seller linked) */}
                  {instance.status === 'connected' && (!instance.phone_e164 || !instance.default_seller_id) && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleSyncPhone(instance.id)}
                      disabled={isSyncing === instance.id}
                      className="w-full text-primary"
                    >
                      {isSyncing === instance.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Phone className="h-4 w-4 mr-2" />
                      )}
                      {instance.phone_e164 ? 'Vincular Vendedor' : 'Sincronizar Telefone'}
                    </Button>
                  )}
                  
                  {/* QR Code */}
                  {instance.status === 'qr_pending' && instance.qr_code && (
                    <div className="p-4 bg-white rounded-lg flex justify-center">
                      <img src={instance.qr_code} alt="QR Code" className="w-40 h-40" />
                    </div>
                  )}
                  
                  {/* Webhook URL */}
                  <div className="p-2 bg-muted rounded text-xs font-mono break-all flex items-center gap-2">
                    <span className="flex-1 truncate">
                      Webhook: .../{instance.id.slice(0, 8)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => copyWebhook()}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                    {instance.status === 'connected' ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDisconnect(instance)}
                        disabled={disconnectInstance.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        {disconnectInstance.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <WifiOff className="h-4 w-4 mr-1" />
                        )}
                        Desconectar
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleConnect(instance)}
                        disabled={connectInstance.isPending}
                        className="text-green-600 hover:text-green-600"
                      >
                        {connectInstance.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <QrCode className="h-4 w-4 mr-1" />
                        )}
                        Conectar
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleTest(instance)}
                      disabled={testInstance.isPending}
                    >
                      {testInstance.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      Status
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(instance)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(instance)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedInstance ? 'Editar Conexão' : 'Conectar Vendedor'}
            </DialogTitle>
            <DialogDescription>
              {selectedInstance
                ? 'Atualize os dados da conexão Evolution.'
                : 'Cada vendedor precisa de uma instância dedicada no Evolution. Após salvar, escaneie o QR Code com o celular dele.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do vendedor / identificação *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: João Silva"
              />
              <p className="text-xs text-muted-foreground">Aparece nos cards e relatórios.</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="instance_name">Nome da Instância no Evolution *</Label>
              <Input
                id="instance_name"
                value={formData.instance_name}
                onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
                placeholder="Ex: joao_vendas"
              />
              <p className="text-xs text-muted-foreground">Mesmo nome usado ao criar a instância no painel Evolution (sem espaços).</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="api_url">URL da API *</Label>
              <Input
                id="api_url"
                value={formData.api_url}
                onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                placeholder="https://evolution.empresa.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="api_key">
                API Key {!selectedInstance && '*'}
              </Label>
              <Input
                id="api_key"
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder={selectedInstance ? '••••••••' : 'Sua API Key'}
              />
              {selectedInstance && (
                <p className="text-xs text-muted-foreground">Deixe em branco para manter a atual.</p>
              )}
            </div>
            
            {/* Seller Registration Section - Only for new instances */}
            {!selectedInstance && (
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="add-seller" className="text-sm font-medium">
                      Cadastrar Vendedor
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Adicionar um vendedor junto com o chip
                    </p>
                  </div>
                  <Switch
                    id="add-seller"
                    checked={addSeller}
                    onCheckedChange={setAddSeller}
                  />
                </div>
                
                {addSeller && (
                  <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
                    <div className="space-y-2">
                      <Label htmlFor="seller-nome">Nome do Vendedor *</Label>
                      <Input
                        id="seller-nome"
                        value={sellerData.nome}
                        onChange={(e) => setSellerData({ ...sellerData, nome: e.target.value })}
                        placeholder="Ex: João Silva"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="seller-email">Email do Vendedor *</Label>
                      <Input
                        id="seller-email"
                        type="email"
                        value={sellerData.email}
                        onChange={(e) => setSellerData({ ...sellerData, email: e.target.value })}
                        placeholder="joao@empresa.com"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createInstance.isPending || updateInstance.isPending}
            >
              {(createInstance.isPending || updateInstance.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {selectedInstance ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a instância "{selectedInstance?.name}"?
              Todas as conversas associadas serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* QR Code Modal */}
      <Dialog open={isQRModalOpen} onOpenChange={setIsQRModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            {qrInstance?.status === 'connected' ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <p className="font-medium text-green-600">WhatsApp conectado!</p>
                {qrInstance?.phone_number && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Smartphone className="h-4 w-4" />
                    {qrInstance.phone_number}
                  </p>
                )}
              </div>
            ) : qrInstance?.qr_code ? (
              <div className="p-4 bg-white rounded-xl shadow-inner">
                <img 
                  src={qrInstance.qr_code} 
                  alt="QR Code" 
                  className="w-56 h-56"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}
            
            {qrInstance?.status !== 'connected' && (
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Abra o WhatsApp no celular → Menu → Aparelhos conectados → Conectar aparelho
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleConnect(qrInstance)}
                  disabled={connectInstance.isPending}
                >
                  {connectInstance.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Gerar novo QR
                </Button>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQRModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
