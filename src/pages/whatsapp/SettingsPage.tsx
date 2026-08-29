import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { WhatsappMobileBottomNav } from '@/components/layout/WhatsappMobileBottomNav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SetupTab } from '@/components/whatsapp/settings/SetupTab';
import { EmpresasTab } from '@/components/whatsapp/settings/EmpresasTab';
import { InstancesTab } from '@/components/whatsapp/settings/InstancesTab';
import { MacrosTab } from '@/components/whatsapp/settings/MacrosTab';
import { AssignmentTab } from '@/components/whatsapp/settings/AssignmentTab';
import { TeamTab } from '@/components/whatsapp/settings/TeamTab';
import { VendedoresTab } from '@/components/whatsapp/settings/VendedoresTab';
import { SecurityTab } from '@/components/whatsapp/settings/SecurityTab';

import { EmpresaSelectorDialog } from '@/components/common/EmpresaSelectorDialog';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { 
  Rocket, 
  Building2, 
  Wifi, 
  MessageSquare, 
  GitBranch, 
  Users,
  UserPlus,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabValue = 'setup' | 'empresas' | 'instances' | 'macros' | 'assignment' | 'vendedores' | 'team' | 'security';

interface TabConfig {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
  description: string;
  requiresAdmin?: boolean;
  requiresGlobalAdmin?: boolean;
}

export default function SettingsPage() {
  const { isMaster } = useAuth();
  const isMobile = useIsMobile();
  const { hasEmpresaSelecionada, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const [activeTab, setActiveTab] = useState<TabValue>('setup');
  const [showEmpresaDialog, setShowEmpresaDialog] = useState(false);
  
  // Para simplificar, consideramos isMaster como Global Admin
  // Em um sistema real, teríamos roles mais granulares (admin, supervisor, agent)
  const isGlobalAdmin = isMaster;
  const isAdmin = isMaster; // Em produção, verificar role específica
  
  // Show empresa selector if master user has no empresa selected
  useEffect(() => {
    if (!isLoadingEmpresa && isMaster && !hasEmpresaSelecionada) {
      setShowEmpresaDialog(true);
    }
  }, [isLoadingEmpresa, isMaster, hasEmpresaSelecionada]);
  
  const tabs: TabConfig[] = [
    {
      value: 'setup',
      label: 'Setup',
      icon: <Rocket className="h-4 w-4" />,
      description: 'Guia de configuração inicial',
    },
    {
      value: 'empresas',
      label: 'Empresas',
      icon: <Building2 className="h-4 w-4" />,
      description: 'Gerenciamento multi-tenant',
      requiresGlobalAdmin: true,
    },
    {
      value: 'instances',
      label: 'Instâncias',
      icon: <Wifi className="h-4 w-4" />,
      description: 'Conexões WhatsApp',
    },
    {
      value: 'macros',
      label: 'Macros',
      icon: <MessageSquare className="h-4 w-4" />,
      description: 'Respostas rápidas',
    },
    {
      value: 'assignment',
      label: 'Atribuição',
      icon: <GitBranch className="h-4 w-4" />,
      description: 'Regras de distribuição',
    },
    {
      value: 'vendedores',
      label: 'Vendedores',
      icon: <UserPlus className="h-4 w-4" />,
      description: 'Cadastro por telefone',
      requiresAdmin: true,
    },
    {
      value: 'team',
      label: 'Equipe',
      icon: <Users className="h-4 w-4" />,
      description: 'Gerenciamento de membros',
      requiresAdmin: true,
    },
    {
      value: 'security',
      label: 'Segurança',
      icon: <Shield className="h-4 w-4" />,
      description: 'Políticas de acesso',
      requiresAdmin: true,
    },
  ];
  
  // Filtrar abas baseado nas permissões
  const visibleTabs = tabs.filter(tab => {
    if (tab.requiresGlobalAdmin && !isGlobalAdmin) return false;
    if (tab.requiresAdmin && !isAdmin) return false;
    return true;
  });
  
  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
  };
  
  const content = (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-6xl mx-auto p-4 md:p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas instâncias e automações</p>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className={cn(
            "w-full justify-start overflow-x-auto flex-nowrap bg-muted/50 p-1 h-auto",
            isMobile && "pb-2"
          )}>
            {visibleTabs.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap px-3 py-2",
                  "data-[state=active]:bg-background data-[state=active]:shadow-sm"
                )}
              >
                {tab.icon}
                <span className={cn(isMobile && "hidden sm:inline")}>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          
          {/* Tab Contents */}
          <div className="mt-6">
            <TabsContent value="setup" className="m-0">
              <SetupTab onNavigateToTab={handleTabChange} />
            </TabsContent>
            
            {isGlobalAdmin && (
              <TabsContent value="empresas" className="m-0">
                <EmpresasTab />
              </TabsContent>
            )}
            
            <TabsContent value="instances" className="m-0">
              <InstancesTab />
            </TabsContent>
            
            <TabsContent value="macros" className="m-0">
              <MacrosTab />
            </TabsContent>
            
            <TabsContent value="assignment" className="m-0">
              <AssignmentTab />
            </TabsContent>
            
            {isAdmin && (
              <>
                <TabsContent value="vendedores" className="m-0">
                  <VendedoresTab />
                </TabsContent>
                
                <TabsContent value="team" className="m-0">
                  <TeamTab />
                </TabsContent>
                
                <TabsContent value="security" className="m-0">
                  <SecurityTab />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </div>
      
      <EmpresaSelectorDialog
        open={showEmpresaDialog}
        onOpenChange={setShowEmpresaDialog}
        targetPath="/whatsapp/settings"
        moduloKey="whatsapp"
      />
    </div>
  );
  
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 overflow-hidden pb-20">
          {content}
        </div>
        <WhatsappMobileBottomNav />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      {content}
    </div>
  );
}
