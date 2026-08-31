import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientsReportTab } from '@/components/whatsapp/reports/ClientsReportTab';
import { AgentsReportTab } from '@/components/whatsapp/reports/AgentsReportTab';
import { KPICards } from '@/components/whatsapp/reports/KPICards';
import { DashboardTab } from '@/components/whatsapp/reports/DashboardTab';
import { useWhatsappReportSummary, ReportFilters } from '@/hooks/useWhatsappReports';
import { LoadingState } from '@/components/common/LoadingState';
import { LayoutDashboard, Users, UserCheck } from 'lucide-react';
import { ReportFilters as ReportFiltersComponent, ReportFiltersState, defaultReportFilters } from '@/components/whatsapp/reports/ReportFilters';
import { useIsMobile } from '@/hooks/use-mobile';
import { WhatsappMobileBottomNav } from '@/components/layout/WhatsappMobileBottomNav';

export default function RelatorioPage() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Filter state: what user is editing
  const [pendingFilters, setPendingFilters] = useState<ReportFiltersState>(defaultReportFilters);
  
  // Applied filters: what is actually being used for queries (only updates on "Buscar" click)
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters | undefined>(undefined);
  
  const { data: summary, isLoading } = useWhatsappReportSummary(appliedFilters);

  const handleSearch = () => {
    // Convert from component state to hook filter format
    const filters: ReportFilters = {
      anos: pendingFilters.anos,
      meses: pendingFilters.meses,
      vendedorId: pendingFilters.vendedorId,
    };
    
    // Only set filters if at least one filter is active
    const hasActiveFilters = filters.anos.length > 0 || filters.meses.length > 0 || !!filters.vendedorId;
    setAppliedFilters(hasActiveFilters ? filters : undefined);
  };

  const handleClear = () => {
    setPendingFilters(defaultReportFilters);
    setAppliedFilters(undefined);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingState message="Carregando relatórios..." />
      </div>
    );
  }

  const content = (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
        {/* Collapsible Filters */}
        <ReportFiltersComponent
          filters={pendingFilters}
          onFiltersChange={setPendingFilters}
          onSearch={handleSearch}
          onClear={handleClear}
        />

        {/* KPIs always visible at top */}
        {summary && <KPICards summary={summary} />}

        {/* 3 Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="dashboard" className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="clientes" className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="vendedores" className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <UserCheck className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Vendedores</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4 sm:mt-6">
            {summary && <DashboardTab summary={summary} />}
          </TabsContent>

          <TabsContent value="clientes" className="mt-4 sm:mt-6">
            <ClientsReportTab filters={appliedFilters} />
          </TabsContent>

          <TabsContent value="vendedores" className="mt-4 sm:mt-6">
            <AgentsReportTab filters={appliedFilters} />
          </TabsContent>
        </Tabs>
      </div>
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

  return content;
}
