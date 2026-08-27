import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { EmpresaSelecionadaProvider } from "@/contexts/EmpresaSelecionadaContext";
import { FilialSelecionadaProvider } from "@/contexts/FilialSelecionadaContext";
import { FinanceiroLayout } from "@/components/layout/FinanceiroLayout";
import { ComercialLayout } from "@/components/layout/ComercialLayout";
import { WhatsappLayout } from "@/components/layout/WhatsappLayout";
import { OperacionalLayout } from "@/components/layout/OperacionalLayout";
import { AppErrorBoundary } from "@/components/common/AppErrorBoundary";
import { RequireModule } from "@/components/auth/RequireModule";
import { RequireRole } from "@/components/auth/RequireRole";
import { ForceChangePassword } from "@/components/auth/ForceChangePassword";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresaAtiva } from "@/hooks/useEmpresaAtiva";
import { useUserModulePermissions } from "@/hooks/useUserModulePermissions";
import DrePage from "./pages/financeiro/DrePage";
import VariacaoPage from "./pages/financeiro/VariacaoPage";
import ResumoPage from "./pages/financeiro/ResumoPage";
import SaldoAVencerPage from "./pages/financeiro/SaldoAVencerPage";

// ComercialDashboardPage removido do roteamento: layout antigo (MetasVendedoresPage) restaurado para todas as empresas.
import MetasVendedoresPage from "./pages/comercial/MetasVendedoresPage";
import ClientesAnalysePage from "./pages/comercial/ClientesAnalysePage";
import ProdutosPage from "./pages/comercial/ProdutosPage";
import ComissaoPage from "./pages/comercial/ComissaoPage";
import CotacoesAbertasPage from "./pages/comercial/CotacoesAbertasPage";
import VendasPerdidasPage from "./pages/comercial/VendasPerdidasPage";
import EstoquePage from "./pages/operacional/EstoquePage";
import EstoqueRetroativoPage from "./pages/operacional/EstoqueRetroativoPage";
import ChatPage from "./pages/whatsapp/ChatPage";
import SettingsPage from "./pages/whatsapp/SettingsPage";
import RelatorioPage from "./pages/whatsapp/RelatorioPage";
import AgentesPage from "./pages/whatsapp/AgentesPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import UsuariosPage from "./pages/configuracoes/UsuariosPage";
import EmpresasPage from "./pages/configuracoes/EmpresasPage";
import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
});

function GuardSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

// Enquanto auth/empresa ainda carregam, nenhum guard pode redirecionar
// (isso causava o "pisca e volta para a tela de módulos").
function useGuardContext() {
  const { codEmpresaAtiva, isLoading } = useEmpresaAtiva();
  const { isLoading: authLoading } = useAuth();
  const pending = isLoading || authLoading || !codEmpresaAtiva;
  return { codEmpresaAtiva, pending };
}

function RequirePelegrini({ children, redirectTo }: { children: React.ReactNode; redirectTo: string }) {
  const { codEmpresaAtiva, pending } = useGuardContext();
  if (pending) return <GuardSpinner />;
  if (codEmpresaAtiva !== '1004' && codEmpresaAtiva !== '10041') return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

export function RequireCotacoesPelegrini({ children, redirectTo }: { children: React.ReactNode; redirectTo: string }) {
  const { codEmpresaAtiva, pending } = useGuardContext();
  if (pending) return <GuardSpinner />;
  if (codEmpresaAtiva !== '1004' && codEmpresaAtiva !== '10041') return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

function VendasPerdidasRoute() {
  return (
    <RequireCotacoesPelegrini redirectTo="/comercial/dashboard">
      <VendasPerdidasPage />
    </RequireCotacoesPelegrini>
  );
}

export const VENDAS_PERDIDAS_ROUTE = {
  path: 'perdidas',
  Component: VendasPerdidasRoute,
} as const;

function ComercialDashboardByEmpresa() {
  // Layout validado do módulo Comercial Pelegrini.
  return (
    <AppErrorBoundary label="Dashboard Comercial" resetKey="comercial-dashboard">
      <MetasVendedoresPage />
    </AppErrorBoundary>
  );
}




function FinanceiroIndexRedirect() {
  const { empresa, isLoading: empresaLoading, isMaster } = useEmpresaAtiva();
  const { permissions, isLoading: permissionsLoading } = useUserModulePermissions();

  if (empresaLoading || permissionsLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (isMaster || permissions?.modulo_resumo) {
    if (!empresa || empresa.modulo_resumo) return <Navigate to="/financeiro/resumo" replace />;
  }
  if (isMaster || permissions?.modulo_dre) {
    if (!empresa || empresa.modulo_dre) return <Navigate to="/financeiro/dre" replace />;
  }
  if (isMaster || permissions?.modulo_variacao) {
    if (!empresa || empresa.modulo_variacao) return <Navigate to="/financeiro/variacao" replace />;
  }

  return <Navigate to="/" replace />;
}

function PasswordGate({ children }: { children: React.ReactNode }) {

  const { isAuthenticated, mustChangePassword, isLoading } = useAuth();
  return (
    <>
      {children}
      {!isLoading && isAuthenticated && mustChangePassword && <ForceChangePassword />}
    </>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EmpresaSelecionadaProvider>
          <FilialSelecionadaProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <PasswordGate>
              <Routes>

              <Route path="/" element={<HomePage />} />

              <Route path="/mobile" element={<Navigate to="/comercial/dashboard" replace />} />

              
              {/* Módulo Financeiro - cada rota protegida pelo seu módulo específico */}
              <Route path="/financeiro" element={
                <RequireRole allowedRoles={['master', 'gerencial']}>
                  <FinanceiroLayout />
                </RequireRole>
              }>
                <Route index element={<FinanceiroIndexRedirect />} />
                <Route path="dre" element={
                  <RequireModule moduleKey="dre">
                    <DrePage />
                  </RequireModule>
                } />
                <Route path="variacao" element={
                  <RequireModule moduleKey="variacao">
                    <VariacaoPage />
                  </RequireModule>
                } />
                <Route path="resumo" element={
                  <RequireModule moduleKey="resumo">
                    <ResumoPage />
                  </RequireModule>
                } />
                <Route path="duplicatas" element={
                  <Navigate to="/financeiro" replace />
                } />
                <Route path="saldo-a-vencer" element={<SaldoAVencerPage />} />
                <Route path="fluxo-caixa" element={
                  <Navigate to="/financeiro" replace />
                } />
              </Route>
              
              {/* Módulo Comercial - protegido por módulo */}
              <Route path="/comercial" element={
                <RequireModule moduleKey="comercial">
                  <AppErrorBoundary label="Modulo Comercial" resetKey="comercial-layout">
                    <ComercialLayout />
                  </AppErrorBoundary>
                </RequireModule>
              }>
                <Route index element={<Navigate to="/comercial/dashboard" replace />} />
                <Route path="dashboard" element={<ComercialDashboardByEmpresa />} />
                <Route path="cotacoes" element={
                  <RequireCotacoesPelegrini redirectTo="/comercial/dashboard">
                    <CotacoesAbertasPage />
                  </RequireCotacoesPelegrini>
                } />
                <Route {...VENDAS_PERDIDAS_ROUTE} />
                <Route path="progresso-vendedor" element={
                  <Navigate to="/comercial/dashboard" replace />
                } />
                <Route path="metas-diarias" element={<Navigate to="/comercial/dashboard" replace />} />
                <Route path="clientes" element={<ClientesAnalysePage />} />
                <Route path="produtos" element={<ProdutosPage />} />
                <Route path="marcas" element={<Navigate to="/comercial/produtos" replace />} />
                <Route path="queda-clientes" element={<Navigate to="/comercial/clientes" replace />} />
                <Route path="comissao" element={
                  <RequirePelegrini redirectTo="/comercial/dashboard">
                    <ComissaoPage />
                  </RequirePelegrini>
                } />
                <Route path="autenticacao" element={
                  <Navigate to="/comercial/dashboard" replace />
                } />

              </Route>

              {/* Módulo Operacional - protegido por módulo */}
              <Route path="/operacional" element={
                <RequireModule moduleKey="operacional">
                  <OperacionalLayout />
                </RequireModule>
              }>
                <Route index element={<Navigate to="/operacional/estoque" replace />} />
                <Route path="estoque" element={<EstoquePage />} />
                <Route path="estoque/retroativo" element={
                  <RequirePelegrini redirectTo="/operacional/estoque">
                    <EstoqueRetroativoPage />
                  </RequirePelegrini>
                } />
              </Route>
              
              {/* Módulo WhatsApp CRM - protegido por módulo */}
              <Route path="/whatsapp" element={
                <RequireModule moduleKey="whatsapp">
                  <WhatsappLayout />
                </RequireModule>
              }>
                <Route index element={<ChatPage />} />
                <Route path="relatorio" element={<RelatorioPage />} />
                <Route path="agentes" element={<AgentesPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              
              {/* Configurações - protegido por role master */}
              <Route path="/configuracoes" element={
                <RequireRole allowedRoles={['master']}>
                  <ConfiguracoesPage />
                </RequireRole>
              } />
              <Route path="/configuracoes/usuarios" element={<UsuariosPage />} />
              <Route path="/configuracoes/empresas" element={
                <RequireRole allowedRoles={['master']}>
                  <EmpresasPage />
                </RequireRole>
              } />
              
              {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </PasswordGate>

            </BrowserRouter>
          </TooltipProvider>
          </FilialSelecionadaProvider>
        </EmpresaSelecionadaProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
