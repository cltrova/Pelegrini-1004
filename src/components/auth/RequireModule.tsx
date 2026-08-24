import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';
import { Shield, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type ModuloKey = 'dre' | 'variacao' | 'comercial' | 'whatsapp' | 'assistente_ia' | 'operacional' | 'resumo';

interface RequireModuleProps {
  children: ReactNode;
  moduleKey: ModuloKey;
  fallbackRoute?: string;
}

/**
 * Componente de guarda que verifica acesso ao módulo
 * Combina verificação da empresa E do usuário
 */
export function RequireModule({ 
  children, 
  moduleKey, 
  fallbackRoute = '/' 
}: RequireModuleProps) {
  const { isAuthenticated, isLoading: authLoading, isMaster } = useAuth();
  const { hasModulo, isLoading: empresaLoading } = useEmpresaConfig();
  const { 
    canAccessWhatsApp, 
    canAccessComercial, 
    canAccessDRE, 
    canAccessVariacao, 
    canAccessAssistenteIA,
    canAccessOperacional,
    canAccessResumo,
    isLoading: permLoading 
  } = useUserModulePermissions();
  const location = useLocation();

  const isLoading = authLoading || empresaLoading || permLoading;

  // Mostrar loading enquanto verifica
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Se não autenticado, redirecionar para home
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Master sempre tem acesso
  if (isMaster) {
    return <>{children}</>;
  }

  // Verificar acesso da empresa ao módulo
  const empresaHasAccess = hasModulo(moduleKey);
  
  // Verificar acesso do usuário ao módulo
  const userHasAccess = (() => {
    switch (moduleKey) {
      case 'whatsapp': return canAccessWhatsApp;
      case 'comercial': return canAccessComercial;
      case 'dre': return canAccessDRE;
      case 'variacao': return canAccessVariacao;
      case 'assistente_ia': return canAccessAssistenteIA;
      case 'operacional': return canAccessOperacional;
      case 'resumo': return canAccessResumo;
      default: return false;
    }
  })();

  // Se não tem acesso ao módulo
  if (!empresaHasAccess || !userHasAccess) {
    const reason = !empresaHasAccess 
      ? 'Este módulo não está habilitado para sua empresa.'
      : 'Você não tem permissão para acessar este módulo.';

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-amber-500" />
            </div>
            <CardTitle className="flex items-center justify-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              Módulo Bloqueado
            </CardTitle>
            <CardDescription>
              Você não tem acesso a este módulo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {reason} Entre em contato com o administrador se você acredita que deveria ter acesso.
            </p>
            <Button 
              onClick={() => window.location.href = fallbackRoute} 
              variant="outline" 
              className="w-full"
            >
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
