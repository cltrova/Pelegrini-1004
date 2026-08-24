import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  MessageSquare,
  Plus,
  Search,
  Pencil,
  Trash2,
  Hash,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { useWhatsappMacros } from '@/hooks/useWhatsappData';
import { useCreateMacro, useUpdateMacro, useDeleteMacro } from '@/hooks/useWhatsappSettings';
import { useToast } from '@/hooks/use-toast';

interface MacroFormData {
  name: string;
  shortcut: string;
  content: string;
  category?: string;
  is_active: boolean;
}

export function MacrosTab() {
  const { toast } = useToast();
  const { data: macros = [], isLoading } = useWhatsappMacros();
  const createMacro = useCreateMacro();
  const updateMacro = useUpdateMacro();
  const deleteMacro = useDeleteMacro();
  
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedMacro, setSelectedMacro] = useState<any>(null);
  const [formData, setFormData] = useState<MacroFormData>({
    name: '',
    shortcut: '',
    content: '',
    category: '',
    is_active: true,
  });
  
  // Filter macros by search
  const filteredMacros = macros.filter((macro: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      macro.name?.toLowerCase().includes(searchLower) ||
      macro.shortcut?.toLowerCase().includes(searchLower) ||
      macro.content?.toLowerCase().includes(searchLower) ||
      macro.category?.toLowerCase().includes(searchLower)
    );
  });
  
  const handleNew = () => {
    setSelectedMacro(null);
    setFormData({ name: '', shortcut: '', content: '', category: '', is_active: true });
    setIsFormOpen(true);
  };
  
  const handleEdit = (macro: any) => {
    setSelectedMacro(macro);
    setFormData({
      name: macro.name || '',
      shortcut: macro.shortcut || '',
      content: macro.content || '',
      category: macro.category || '',
      is_active: macro.is_active ?? true,
    });
    setIsFormOpen(true);
  };
  
  const handleDelete = (macro: any) => {
    setSelectedMacro(macro);
    setIsDeleteOpen(true);
  };
  
  const handleSubmit = async () => {
    if (!formData.name || !formData.shortcut || !formData.content) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha nome, atalho e conteúdo.',
        variant: 'destructive',
      });
      return;
    }
    
    // Remove "/" from shortcut if user added it
    const cleanShortcut = formData.shortcut.replace(/^\//, '');
    
    try {
      if (selectedMacro) {
        await updateMacro.mutateAsync({
          id: selectedMacro.id,
          ...formData,
          shortcut: cleanShortcut,
        });
        toast({ title: 'Macro atualizada!' });
      } else {
        await createMacro.mutateAsync({
          ...formData,
          shortcut: cleanShortcut,
        });
        toast({ title: 'Macro criada com sucesso!' });
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
    if (!selectedMacro) return;
    
    try {
      await deleteMacro.mutateAsync(selectedMacro.id);
      toast({ title: 'Macro removida!' });
      setIsDeleteOpen(false);
    } catch (error) {
      toast({
        title: 'Erro ao remover',
        variant: 'destructive',
      });
    }
  };
  
  if (isLoading) {
    return <LoadingState message="Carregando macros..." />;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Macros</h2>
          <p className="text-sm text-muted-foreground">
            Respostas rápidas ativadas com "/" no chat.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar macros..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Macro
          </Button>
        </div>
      </div>
      
      {/* Macros List */}
      {filteredMacros.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-12 w-12" />}
          title={search ? 'Nenhuma macro encontrada' : 'Nenhuma macro cadastrada'}
          message={search ? 'Tente outro termo de busca.' : 'Crie macros para respostas rápidas no chat.'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredMacros.map((macro: any) => (
            <Card 
              key={macro.id} 
              className={cn(
                "hover:shadow-md transition-shadow",
                !macro.is_active && "opacity-60"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-foreground truncate">{macro.name}</h3>
                      <Badge variant="secondary" className="font-mono shrink-0">
                        /{macro.shortcut}
                      </Badge>
                    </div>
                    
                    {macro.category && (
                      <Badge variant="outline" className="mb-2">
                        {macro.category}
                      </Badge>
                    )}
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {macro.content}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {macro.usage_count || 0} usos
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(macro)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(macro)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
              {selectedMacro ? 'Editar Macro' : 'Nova Macro'}
            </DialogTitle>
            <DialogDescription>
              {selectedMacro 
                ? 'Atualize os dados da macro.' 
                : 'Crie uma nova resposta rápida.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Saudação inicial"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="shortcut">Atalho *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">/</span>
                <Input
                  id="shortcut"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value.replace(/^\//, '') })}
                  placeholder="ola"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Digite /{formData.shortcut || 'atalho'} no chat para usar esta macro.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Digite o texto da resposta..."
                rows={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Saudações"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Macro ativa</Label>
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
              disabled={createMacro.isPending || updateMacro.isPending}
            >
              {(createMacro.isPending || updateMacro.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {selectedMacro ? 'Salvar' : 'Criar'}
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
              Tem certeza que deseja excluir a macro "/{selectedMacro?.shortcut}"?
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
