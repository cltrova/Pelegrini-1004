import { useState, useEffect } from 'react';
import { Loader2, Crown, Shield, User, Building2, Pencil, Trash2, UserX, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useAuth } from '@/contexts/AuthContext';
import type { Profile, AppRole } from '@/types/auth';

interface UserWithRoles extends Profile {
  roles: AppRole[];
}

interface UserListProps {
  onEdit: (userId: string) => void;
  filterByCompany?: string; // Filtrar por empresa específica
}

export function UserList({ onEdit, filterByCompany }: UserListProps) {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { isMaster, codEmpresa } = useAuth();

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Carregar perfis
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Se não for master, filtrar pela empresa do usuário
      if (!isMaster && codEmpresa) {
        query = query.eq('cod_empresa_bi', codEmpresa);
      }

      // Se foi passado filtro específico
      if (filterByCompany) {
        query = query.eq('cod_empresa_bi', filterByCompany);
      }

      const { data: profiles, error: profilesError } = await query;

      if (profilesError) throw profilesError;

      // Carregar roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combinar dados
      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
        ...profile as Profile,
        roles: (roles || [])
          .filter(r => r.user_id === profile.user_id)
          .map(r => r.role as AppRole),
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a lista de usuários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [filterByCompany]);

  const handleDelete = async () => {
    if (!deleteUserId) return;

    try {
      // Use edge function to delete user completely (including auth.users)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Você precisa estar autenticado');
      }

      const response = await supabase.functions.invoke('delete-user', {
        body: { user_id: deleteUserId },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao excluir usuário');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Usuário removido',
        description: 'O usuário foi removido completamente do sistema.',
      });

      loadUsers();
    } catch (error: any) {
      console.error('Erro ao deletar usuário:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover o usuário.',
        variant: 'destructive',
      });
    } finally {
      setDeleteUserId(null);
    }
  };

  const getRoleBadge = (roles: AppRole[]) => {
    if (roles.includes('master')) {
      return (
        <Badge className="gap-1 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20">
          <Crown className="h-3 w-3" />
          Master
        </Badge>
      );
    }
    if (roles.includes('gerencial')) {
      return (
        <Badge className="gap-1 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20">
          <Shield className="h-3 w-3" />
          Gerencial
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
        <User className="h-3 w-3" />
        Vendedor
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <UserX className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium">Nenhum usuário cadastrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em "Novo Usuário" para criar o primeiro usuário.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usuários Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.nome || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.cod_empresa_bi ? (
                      <Badge variant="outline" className="gap-1">
                        <Building2 className="h-3 w-3" />
                        {user.cod_empresa_bi}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Todas</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(user.roles)}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => onEdit(user.user_id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Resetar senha"
                        onClick={() => setResetUserId(user.user_id)}
                      >
                        <KeyRound className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir"
                        onClick={() => setDeleteUserId(user.user_id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetUserId || !!resetResult} onOpenChange={(o) => { if (!o) { setResetUserId(null); setResetResult(null); setCopied(false); } }}>
        <AlertDialogContent>
          {!resetResult ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Resetar senha do usuário</AlertDialogTitle>
                <AlertDialogDescription>
                  Uma nova senha temporária será gerada. O usuário será obrigado a trocá-la no próximo login. A senha atual deixará de funcionar imediatamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetLoading}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={resetLoading}
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!resetUserId) return;
                    setResetLoading(true);
                    try {
                      const target = users.find(u => u.user_id === resetUserId);
                      const resp = await supabase.functions.invoke('reset-user-password', {
                        body: { user_id: resetUserId },
                      });
                      if (resp.error) throw new Error(resp.error.message || 'Falha ao resetar senha');
                      if (resp.data?.error) throw new Error(resp.data.error);
                      setResetResult({ email: target?.email || '', password: resp.data.temp_password });
                      setResetUserId(null);
                    } catch (err: any) {
                      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
                    } finally {
                      setResetLoading(false);
                    }
                  }}
                >
                  {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar nova senha'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Nova senha temporária</AlertDialogTitle>
                <AlertDialogDescription>
                  Compartilhe esta senha com <strong>{resetResult.email}</strong>. Ela não será mostrada novamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex items-center gap-2 py-2">
                <code className="flex-1 select-all rounded bg-muted px-3 py-2 font-mono text-sm border">
                  {resetResult.password}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(resetResult.password);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => { setResetResult(null); setCopied(false); }}>
                  Concluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
