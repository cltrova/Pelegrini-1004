import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Pencil, 
  Trash2, 
  Globe, 
  BarChart3,
  TrendingUp,
  ShoppingCart,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { useEmpresaMutations, Empresa } from '@/hooks/useEmpresaConfig';

interface EmpresaListProps {
  empresas: Empresa[];
  onEdit: (empresa: Empresa) => void;
}

export function EmpresaList({ empresas, onEdit }: EmpresaListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { deleteEmpresa } = useEmpresaMutations();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [empresaToDelete, setEmpresaToDelete] = useState<Empresa | null>(null);

  const handleDelete = async () => {
    if (!empresaToDelete) return;

    try {
      await deleteEmpresa(empresaToDelete.id);
      toast({
        title: 'Empresa excluída',
        description: `${empresaToDelete.nome} foi excluída com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message || 'Não foi possível excluir a empresa.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setEmpresaToDelete(null);
    }
  };

  const confirmDelete = (empresa: Empresa) => {
    setEmpresaToDelete(empresa);
    setDeleteDialogOpen(true);
  };

  if (empresas.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma empresa cadastrada</h3>
          <p className="text-muted-foreground text-sm">
            Clique em "Nova Empresa" para adicionar a primeira empresa.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {empresas.map((empresa) => (
          <Card 
            key={empresa.id} 
            className={`relative transition-all hover:shadow-md ${!empresa.ativo ? 'opacity-60' : ''}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold line-clamp-1">{empresa.nome}</h3>
                    <p className="text-xs text-muted-foreground">Código: {empresa.cod_empresa_bi}</p>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(empresa)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => confirmDelete(empresa)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                <Globe className="h-3 w-3" />
                <span className="truncate">
                  {empresa.usar_vps_intermediaria
                    ? `VPS RSYS → /${empresa.vps_cliente_identificador || '?'}`
                    : empresa.endpoint_url}
                </span>
              </div>

              <div className="mb-3">
                <Badge
                  variant={empresa.usar_vps_intermediaria ? 'default' : 'outline'}
                  className="text-[10px] gap-1"
                >
                  {empresa.usar_vps_intermediaria ? '🛰️ Via VPS intermediária' : '🔗 Conexão direta'}
                </Badge>
              </div>


              <div className="flex flex-wrap gap-1.5 mb-3">
                <Badge 
                  variant={empresa.modulo_dre ? 'default' : 'outline'} 
                  className="text-xs gap-1"
                >
                  <BarChart3 className="h-3 w-3" />
                  DRE
                </Badge>
                <Badge 
                  variant={empresa.modulo_variacao ? 'default' : 'outline'} 
                  className="text-xs gap-1"
                >
                  <TrendingUp className="h-3 w-3" />
                  Variação
                </Badge>
                <Badge 
                  variant={empresa.modulo_comercial ? 'default' : 'outline'} 
                  className="text-xs gap-1"
                >
                  <ShoppingCart className="h-3 w-3" />
                  Comercial
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <Badge variant={empresa.ativo ? 'secondary' : 'outline'} className="text-xs">
                  {empresa.ativo ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa "{empresaToDelete?.nome}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
