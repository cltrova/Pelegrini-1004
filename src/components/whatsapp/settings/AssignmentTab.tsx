import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  User,
  Users,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { useWhatsappInstances } from '@/hooks/useWhatsappData';
import { 
  useAssignmentRules, 
  useCreateAssignmentRule, 
  useUpdateAssignmentRule, 
  useDeleteAssignmentRule,
  useTeamMembers 
} from '@/hooks/useWhatsappSettings';
import { useToast } from '@/hooks/use-toast';

interface RuleFormData {
  name: string;
  instance_id?: string;
  rule_type: 'fixed_agent' | 'round_robin';
  fixed_agent_id?: string;
  participating_agents: string[];
  is_active: boolean;
}

export function AssignmentTab() {
  const { toast } = useToast();
  const { data: rules = [], isLoading: rulesLoading } = useAssignmentRules();
  const { data: instances = [] } = useWhatsappInstances();
  const { data: members = [] } = useTeamMembers();
  const createRule = useCreateAssignmentRule();
  const updateRule = useUpdateAssignmentRule();
  const deleteRule = useDeleteAssignmentRule();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    instance_id: undefined,
    rule_type: 'round_robin',
    fixed_agent_id: undefined,
    participating_agents: [],
    is_active: true,
  });
  
  const handleNew = () => {
    setSelectedRule(null);
    setFormData({
      name: '',
      instance_id: undefined,
      rule_type: 'round_robin',
      fixed_agent_id: undefined,
      participating_agents: [],
      is_active: true,
    });
    setIsFormOpen(true);
  };
  
  const handleEdit = (rule: any) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name || '',
      instance_id: rule.instance_id || undefined,
      rule_type: rule.rule_type || 'round_robin',
      fixed_agent_id: rule.fixed_agent_id || undefined,
      participating_agents: rule.participating_agents || [],
      is_active: rule.is_active ?? true,
    });
    setIsFormOpen(true);
  };
  
  const handleDelete = (rule: any) => {
    setSelectedRule(rule);
    setIsDeleteOpen(true);
  };
  
  const toggleAgent = (agentId: string) => {
    const newAgents = formData.participating_agents.includes(agentId)
      ? formData.participating_agents.filter(id => id !== agentId)
      : [...formData.participating_agents, agentId];
    setFormData({ ...formData, participating_agents: newAgents });
  };
  
  const handleSubmit = async () => {
    if (!formData.name) {
      toast({
        title: 'Campo obrigatório',
        description: 'Preencha o nome da regra.',
        variant: 'destructive',
      });
      return;
    }
    
    if (formData.rule_type === 'fixed_agent' && !formData.fixed_agent_id) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione um agente fixo.',
        variant: 'destructive',
      });
      return;
    }
    
    if (formData.rule_type === 'round_robin' && formData.participating_agents.length < 2) {
      toast({
        title: 'Mínimo de agentes',
        description: 'Round Robin precisa de pelo menos 2 agentes.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      if (selectedRule) {
        await updateRule.mutateAsync({
          id: selectedRule.id,
          ...formData,
        });
        toast({ title: 'Regra atualizada!' });
      } else {
        await createRule.mutateAsync(formData);
        toast({ title: 'Regra criada com sucesso!' });
      }
      setIsFormOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };
  
  const confirmDelete = async () => {
    if (!selectedRule) return;
    
    try {
      await deleteRule.mutateAsync(selectedRule.id);
      toast({ title: 'Regra removida!' });
      setIsDeleteOpen(false);
    } catch (error) {
      toast({
        title: 'Erro ao remover',
        variant: 'destructive',
      });
    }
  };
  
  const getInstanceName = (instanceId?: string) => {
    if (!instanceId) return 'Todas instâncias';
    const instance = instances.find((i: any) => i.id === instanceId);
    return instance?.name || 'Instância';
  };
  
  const getAgentName = (agentId: string) => {
    const member = members.find((m: any) => m.user_id === agentId);
    return member?.nome || member?.email || 'Agente';
  };
  
  if (rulesLoading) {
    return <LoadingState message="Carregando regras..." />;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Regras de Atribuição</h2>
          <p className="text-sm text-muted-foreground">
            Defina como as novas conversas serão distribuídas entre os agentes.
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Regra
        </Button>
      </div>
      
      {/* Rules List */}
      {rules.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="h-12 w-12" />}
          title="Nenhuma regra configurada"
          message="Crie regras para distribuir conversas automaticamente."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rules.map((rule: any) => (
            <Card 
              key={rule.id} 
              className={cn(
                "hover:shadow-md transition-shadow",
                !rule.is_active && "opacity-60"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-foreground">{rule.name || 'Regra'}</h3>
                      <Badge 
                        variant={rule.rule_type === 'round_robin' ? 'default' : 'secondary'}
                        className="shrink-0"
                      >
                        {rule.rule_type === 'round_robin' ? (
                          <>
                            <Users className="h-3 w-3 mr-1" />
                            Round Robin
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3 mr-1" />
                            Agente Fixo
                          </>
                        )}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">
                      Instância: {getInstanceName(rule.instance_id)}
                    </p>
                    
                    {rule.rule_type === 'fixed_agent' && rule.fixed_agent_id && (
                      <p className="text-sm">
                        Agente: {getAgentName(rule.fixed_agent_id)}
                      </p>
                    )}
                    
                    {rule.rule_type === 'round_robin' && rule.participating_agents?.length > 0 && (
                      <p className="text-sm">
                        {rule.participating_agents.length} agentes na rotação
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <Switch checked={rule.is_active} disabled />
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(rule)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedRule ? 'Editar Regra' : 'Nova Regra'}
            </DialogTitle>
            <DialogDescription>
              Configure a distribuição automática de conversas.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Regra *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Suporte Geral"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="instance">Instância</Label>
              <Select
                value={formData.instance_id || 'all'}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  instance_id: value === 'all' ? undefined : value 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas instâncias</SelectItem>
                  {instances.map((instance: any) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="rule_type">Tipo de Regra *</Label>
              <Select
                value={formData.rule_type}
                onValueChange={(value: 'fixed_agent' | 'round_robin') => setFormData({ 
                  ...formData, 
                  rule_type: value,
                  fixed_agent_id: value === 'round_robin' ? undefined : formData.fixed_agent_id,
                  participating_agents: value === 'fixed_agent' ? [] : formData.participating_agents,
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Round Robin
                    </div>
                  </SelectItem>
                  <SelectItem value="fixed_agent">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Agente Fixo
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Fixed Agent Select */}
            {formData.rule_type === 'fixed_agent' && (
              <div className="space-y-2">
                <Label htmlFor="fixed_agent">Agente *</Label>
                <Select
                  value={formData.fixed_agent_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, fixed_agent_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um agente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member: any) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.nome || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Round Robin Agents */}
            {formData.rule_type === 'round_robin' && (
              <div className="space-y-2">
                <Label>Agentes Participantes *</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Selecione pelo menos 2 agentes para rotação.
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">
                      Nenhum membro cadastrado.
                    </p>
                  ) : (
                    members.map((member: any) => (
                      <div 
                        key={member.user_id} 
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted"
                      >
                        <Checkbox
                          id={member.user_id}
                          checked={formData.participating_agents.includes(member.user_id)}
                          onCheckedChange={() => toggleAgent(member.user_id)}
                        />
                        <Label htmlFor={member.user_id} className="flex-1 cursor-pointer">
                          {member.nome || member.email}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.participating_agents.length} agentes selecionados
                </p>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Regra ativa</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createRule.isPending || updateRule.isPending}
            >
              {(createRule.isPending || updateRule.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {selectedRule ? 'Salvar' : 'Criar'}
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
              Tem certeza que deseja excluir esta regra de atribuição?
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
    </div>
  );
}
