import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Building2, 
  Plus, 
  Globe, 
  FileSpreadsheet,
  Pencil,
  Trash2,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { useWhatsappEmpresas, useCreateEmpresa, useUpdateEmpresa, useDeleteEmpresa } from '@/hooks/useWhatsappSettings';
import { useToast } from '@/hooks/use-toast';

interface EmpresaFormData {
  nome: string;
  domain?: string;
  sheets_url?: string;
}

export function EmpresasTab() {
  const { toast } = useToast();
  const { data: empresas = [], isLoading } = useWhatsappEmpresas();
  const createEmpresa = useCreateEmpresa();
  const updateEmpresa = useUpdateEmpresa();
  const deleteEmpresa = useDeleteEmpresa();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<any>(null);
  const [formData, setFormData] = useState<EmpresaFormData>({
    nome: '',
    domain: '',
    sheets_url: '',
  });
  
  const handleNew = () => {
    setSelectedEmpresa(null);
    setFormData({ nome: '', domain: '', sheets_url: '' });
    setIsFormOpen(true);
  };
  
  const handleEdit = (empresa: any) => {
    setSelectedEmpresa(empresa);
    setFormData({
      nome: empresa.nome || '',
      domain: empresa.domain || '',
      sheets_url: empresa.sheets_url || '',
    });
    setIsFormOpen(true);
  };
  
  const handleDelete = (empresa: any) => {
    setSelectedEmpresa(empresa);
    setIsDeleteOpen(true);
  };
  
  const handleSubmit = async () => {
    if (!formData.nome) {
      toast({
        title: 'Campo obrigatório',
        description: 'Nome da empresa é obrigatório.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      if (selectedEmpresa) {
        await updateEmpresa.mutateAsync({
          id: selectedEmpresa.id,
          ...formData,
        });
        toast({ title: 'Empresa atualizada com sucesso!' });
      } else {
        await createEmpresa.mutateAsync(formData);
        toast({ title: 'Empresa criada com sucesso!' });
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
    if (!selectedEmpresa) return;
    
    try {
      await deleteEmpresa.mutateAsync(selectedEmpresa.id);
      toast({ title: 'Empresa removida com sucesso!' });
      setIsDeleteOpen(false);
    } catch (error) {
      toast({
        title: 'Erro ao remover',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };
  
  if (isLoading) {
    return <LoadingState message="Carregando empresas..." />;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Empresas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as empresas que utilizam o sistema WhatsApp.
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>
      
      {/* Empresas Grid */}
      {empresas.length === 0 ? (
      <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title="Nenhuma empresa cadastrada"
          message="Adicione a primeira empresa para começar."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {empresas.map((empresa: any) => (
            <Card key={empresa.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{empresa.nome}</CardTitle>
                  </div>
                  <Badge variant={empresa.ativo ? 'default' : 'secondary'}>
                    {empresa.ativo ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {empresa.domain && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="h-4 w-4" />
                    <span>{empresa.domain}</span>
                  </div>
                )}
                
                {empresa.sheets_url && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Planilha vinculada</span>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground">
                  Criada em {format(new Date(empresa.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  {empresa.sheets_url && (
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" />
                      Colunas
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleEdit(empresa)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(empresa)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedEmpresa ? 'Editar Empresa' : 'Nova Empresa'}
            </DialogTitle>
            <DialogDescription>
              {selectedEmpresa 
                ? 'Atualize os dados da empresa.' 
                : 'Cadastre uma nova empresa no sistema.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Empresa *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Empresa ABC"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="domain">Domínio de Email</Label>
              <Input
                id="domain"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="Ex: empresa.com.br"
              />
              <p className="text-xs text-muted-foreground">
                Usuários com este domínio serão vinculados automaticamente.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sheets_url">URL Google Sheets</Label>
              <Input
                id="sheets_url"
                value={formData.sheets_url}
                onChange={(e) => setFormData({ ...formData, sheets_url: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/..."
              />
              <p className="text-xs text-muted-foreground">
                Link da planilha de leads (opcional).
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createEmpresa.isPending || updateEmpresa.isPending}
            >
              {selectedEmpresa ? 'Salvar' : 'Criar'}
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
              Tem certeza que deseja excluir a empresa "{selectedEmpresa?.nome}"?
              Esta ação não pode ser desfeita.
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
