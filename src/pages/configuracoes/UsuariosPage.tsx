import { useState } from 'react';
import { ArrowLeft, Plus, Crown, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { RequireRole } from '@/components/auth/RequireRole';
import { UserList } from '@/components/configuracoes/UserList';
import { UserFormDialog } from '@/components/configuracoes/UserFormDialog';
import { VisitadoresList } from '@/components/configuracoes/VisitadoresList';
import { CLIENTE_COD_EMPRESA_BI_PADRAO } from '@/config/cliente1004';
import { isLocalPreviewEnabled } from '@/config/localPreview';

function UsuariosPageContent() {
  const navigate = useNavigate();
  const { isMaster } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = (userId: string) => {
    setEditingUserId(userId);
    setIsFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingUserId(null);
    }
  };

  const handleFormSuccess = () => {
    setRefreshKey(prev => prev + 1);
    handleFormClose(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <h1 className="sr-only">Gestão de Usuários</h1>
      <div className="container mx-auto flex shrink-0 items-center justify-between gap-2 px-4 pt-2">
        <Button variant="ghost" size="icon" aria-label="Voltar"
          onClick={() => navigate(isMaster ? '/configuracoes' : '/')}>
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </Button>
        <Button onClick={() => { setEditingUserId(null); setIsFormOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Content */}
      <div className="container mx-auto min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                Master
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Acesso total a todas as empresas, configurações e usuários.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                Gerencial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Dashboards, relatórios e gestão de colaboradores da empresa.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-green-500" />
                Vendedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Acesso às próprias conversas no WhatsApp e perfil.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* User List */}
        <UserList 
          key={refreshKey} 
          onEdit={handleEdit}
          filterByCompany={CLIENTE_COD_EMPRESA_BI_PADRAO}
        />
        {isMaster && !isLocalPreviewEnabled() && <VisitadoresList />}
      </div>

      {/* Form Dialog */}
      <UserFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        userId={editingUserId}
        onSuccess={handleFormSuccess}
        defaultCodEmpresa={CLIENTE_COD_EMPRESA_BI_PADRAO}
      />
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <RequireRole allowedRoles={['master', 'gerencial']}>
      <UsuariosPageContent />
    </RequireRole>
  );
}
