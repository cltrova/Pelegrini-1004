import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Users,
  UserPlus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  UserCog,
  Loader2,
  Crown,
  Shield,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useTeamMembers, 
  useInviteMember, 
  useUpdateMemberRole,
  useToggleMemberActive,
  useToggleMemberApproval 
} from '@/hooks/useWhatsappSettings';
import { useToast } from '@/hooks/use-toast';

type MemberRole = 'admin' | 'supervisor' | 'agent';

interface InviteFormData {
  nome: string;
  email: string;
}

const ROLE_CONFIG: Record<MemberRole, { label: string; icon: React.ReactNode; color: string }> = {
  admin: { label: 'Admin', icon: <Crown className="h-3 w-3" />, color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' },
  supervisor: { label: 'Supervisor', icon: <Shield className="h-3 w-3" />, color: 'bg-blue-500/20 text-blue-500 border-blue-500/30' },
  agent: { label: 'Agente', icon: <User className="h-3 w-3" />, color: 'bg-muted text-muted-foreground' },
};

export function TeamTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: members = [], isLoading } = useTeamMembers();
  const inviteMember = useInviteMember();
  const updateRole = useUpdateMemberRole();
  const toggleActive = useToggleMemberActive();
  const toggleApproval = useToggleMemberApproval();
  
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [formData, setFormData] = useState<InviteFormData>({
    nome: '',
    email: '',
  });
  
  const handleInvite = async () => {
    if (!formData.nome || !formData.email) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha nome e email.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await inviteMember.mutateAsync(formData);
      toast({ title: 'Convite enviado com sucesso!' });
      setIsInviteOpen(false);
      setFormData({ nome: '', email: '' });
    } catch (error: any) {
      toast({
        title: 'Erro ao convidar',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };
  
  const handleRoleChange = async (memberId: string, role: MemberRole) => {
    try {
      await updateRole.mutateAsync({ id: memberId, role });
      toast({ title: 'Role atualizada!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar role', variant: 'destructive' });
    }
  };
  
  const handleToggleActive = async (memberId: string, isActive: boolean) => {
    try {
      await toggleActive.mutateAsync({ id: memberId, is_active: !isActive });
      toast({ title: isActive ? 'Membro desativado' : 'Membro ativado' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    }
  };
  
  const handleToggleApproval = async (memberId: string, isApproved: boolean) => {
    try {
      await toggleApproval.mutateAsync({ id: memberId, is_approved: !isApproved });
      toast({ title: isApproved ? 'Aprovação removida' : 'Membro aprovado!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar aprovação', variant: 'destructive' });
    }
  };
  
  const getInitials = (nome?: string, email?: string) => {
    if (nome) {
      return nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return email?.slice(0, 2).toUpperCase() || '??';
  };
  
  if (isLoading) {
    return <LoadingState message="Carregando equipe..." />;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Equipe</h2>
          <p className="text-sm text-muted-foreground">
            {members.length} membro{members.length !== 1 ? 's' : ''} na equipe
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar Membro
        </Button>
      </div>
      
      {/* Members List */}
      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="Nenhum membro na equipe"
          message="Convide membros para começar."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member: any) => {
            const isCurrentUser = member.user_id === user?.id;
            const memberRole: MemberRole = member.role || 'agent';
            const roleConfig = ROLE_CONFIG[memberRole];
            
            return (
              <Card 
                key={member.id} 
                className={cn(
                  "hover:shadow-md transition-shadow",
                  !member.is_active && "opacity-60"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(member.nome, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground truncate">
                          {member.nome || 'Sem nome'}
                        </h3>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">Você</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground truncate mb-2">
                        {member.email}
                      </p>
                      
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1">
                        <Badge className={cn("text-xs", roleConfig.color)}>
                          {roleConfig.icon}
                          <span className="ml-1">{roleConfig.label}</span>
                        </Badge>
                        
                        {!member.is_approved && (
                          <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/30">
                            Pendente
                          </Badge>
                        )}
                        
                        {!member.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inativo
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    {!isCurrentUser && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Role Selection */}
                          <DropdownMenuItem 
                            onClick={() => handleRoleChange(member.id, 'admin')}
                            className={memberRole === 'admin' ? 'bg-accent' : ''}
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRoleChange(member.id, 'supervisor')}
                            className={memberRole === 'supervisor' ? 'bg-accent' : ''}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Supervisor
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRoleChange(member.id, 'agent')}
                            className={memberRole === 'agent' ? 'bg-accent' : ''}
                          >
                            <User className="h-4 w-4 mr-2" />
                            Agente
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Approval */}
                          <DropdownMenuItem 
                            onClick={() => handleToggleApproval(member.id, member.is_approved)}
                          >
                            {member.is_approved ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Remover Aprovação
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Aprovar
                              </>
                            )}
                          </DropdownMenuItem>
                          
                          {/* Active Status */}
                          <DropdownMenuItem 
                            onClick={() => handleToggleActive(member.id, member.is_active)}
                          >
                            {member.is_active ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Novo Membro</DialogTitle>
            <DialogDescription>
              Envie um convite para adicionar à equipe.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="joao@empresa.com"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleInvite}
              disabled={inviteMember.isPending}
            >
              {inviteMember.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
