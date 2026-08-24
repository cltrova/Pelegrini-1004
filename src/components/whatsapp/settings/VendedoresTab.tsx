import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useVendedores, useCreateVendedor, useRemoveVendedor, useReactivateVendedor } from '@/hooks/useVendedores';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
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
import { 
  Plus, 
  Phone, 
  User, 
  MoreVertical, 
  UserX, 
  UserCheck,
  Loader2,
  Users,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { applyPhoneMask, formatPhoneDisplay, isValidBrazilianPhone } from '@/utils/phoneUtils';

export function VendedoresTab() {
  const { isMaster } = useAuth();
  const { empresa } = useEmpresaAtiva();
  const { data: vendedores, isLoading } = useVendedores();
  const createVendedor = useCreateVendedor();
  const removeVendedor = useRemoveVendedor();
  const reactivateVendedor = useReactivateVendedor();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedVendedor, setSelectedVendedor] = useState<typeof vendedores extends (infer T)[] ? T : never | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    phone: '',
    empresaId: empresa?.id || '',
  });
  
  // Buscar empresas para o select (apenas para masters)
  const { data: empresas } = useQuery({
    queryKey: ['empresas-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome, cod_empresa_bi')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: isMaster,
  });
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyPhoneMask(e.target.value);
    setFormData(prev => ({ ...prev, phone: masked }));
  };
  
  const handleSubmit = async () => {
    if (!isValidBrazilianPhone(formData.phone)) {
      return;
    }
    
    const targetEmpresaId = isMaster ? formData.empresaId : empresa?.id;
    const targetEmpresa = isMaster 
      ? empresas?.find(e => e.id === formData.empresaId)
      : empresa;
    
    if (!targetEmpresaId || !targetEmpresa) return;
    
    await createVendedor.mutateAsync({
      nome: formData.nome || undefined,
      phone: formData.phone,
      cod_empresa_bi: targetEmpresa.cod_empresa_bi,
      company_id: targetEmpresaId,
    });
    
    setShowAddDialog(false);
    setFormData({ nome: '', phone: '', empresaId: empresa?.id || '' });
  };
  
  const handleRemove = async () => {
    if (!selectedVendedor) return;
    
    await removeVendedor.mutateAsync({
      profileId: selectedVendedor.id,
    });
    
    setShowRemoveDialog(false);
    setSelectedVendedor(null);
  };
  
  const handleReactivate = async (vendedor: typeof selectedVendedor) => {
    if (!vendedor) return;
    
    await reactivateVendedor.mutateAsync({
      profileId: vendedor.id,
    });
  };
  
  const getInitials = (nome: string | null, email: string) => {
    if (nome) {
      return nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };
  
  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ativo
          </Badge>
        );
      case 'pending_login':
        return (
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando Login
          </Badge>
        );
      case 'inactive':
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Inativo
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status || 'Desconhecido'}
          </Badge>
        );
    }
  };
  
  const activeVendedores = vendedores?.filter(v => v.status !== 'inactive') || [];
  const inactiveVendedores = vendedores?.filter(v => v.status === 'inactive') || [];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {activeVendedores.length} vendedor{activeVendedores.length !== 1 ? 'es' : ''} ativo{activeVendedores.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Vendedor
        </Button>
      </div>
      
      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}
      
      {/* Empty State */}
      {!isLoading && vendedores?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum vendedor cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adicione vendedores para que eles possam acessar o sistema e receber conversas.
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Vendedor
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Vendedores Ativos */}
      {activeVendedores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vendedores Ativos</CardTitle>
            <CardDescription>
              Vendedores que podem receber e atender conversas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeVendedores.map(vendedor => (
              <div
                key={vendedor.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(vendedor.nome, vendedor.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {vendedor.nome || 'Sem nome'}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {formatPhoneDisplay(vendedor.phone_e164) || vendedor.email}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {getStatusBadge(vendedor.status)}
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setSelectedVendedor(vendedor);
                          setShowRemoveDialog(true);
                        }}
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Desativar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Vendedores Inativos */}
      {inactiveVendedores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">Vendedores Inativos</CardTitle>
            <CardDescription>
              Vendedores desativados que não recebem novas conversas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {inactiveVendedores.map(vendedor => (
              <div
                key={vendedor.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 opacity-50">
                    <AvatarFallback className="bg-muted">
                      {getInitials(vendedor.nome, vendedor.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-muted-foreground">
                      {vendedor.nome || 'Sem nome'}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {formatPhoneDisplay(vendedor.phone_e164) || vendedor.email}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {getStatusBadge(vendedor.status)}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReactivate(vendedor)}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Reativar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Dialog: Adicionar Vendedor */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Vendedor</DialogTitle>
            <DialogDescription>
              Cadastre um novo vendedor pelo número de telefone. Ele aparecerá imediatamente na listagem.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className="pl-10"
                  maxLength={15}
                />
              </div>
              {formData.phone && !isValidBrazilianPhone(formData.phone) && (
                <p className="text-xs text-destructive">Telefone inválido</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="nome"
                  placeholder="Nome do vendedor"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  className="pl-10"
                />
              </div>
              {formData.nome.length === 0 && formData.phone.length > 0 && (
                <p className="text-xs text-destructive">Nome é obrigatório</p>
              )}
            </div>
            
            {isMaster && empresas && (
              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa</Label>
                <Select
                  value={formData.empresaId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, empresaId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={
                !formData.nome.trim() ||
                !isValidBrazilianPhone(formData.phone) || 
                createVendedor.isPending ||
                (isMaster && !formData.empresaId)
              }
            >
              {createVendedor.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog: Confirmar Remoção */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar vendedor?</AlertDialogTitle>
            <AlertDialogDescription>
              O vendedor <strong>{selectedVendedor?.nome || 'selecionado'}</strong> será desativado e não receberá novas conversas. Você pode reativá-lo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
