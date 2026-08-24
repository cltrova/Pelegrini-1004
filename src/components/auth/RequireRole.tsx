import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types/auth';
import { Shield, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RequireRoleProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  fallbackRoute?: string;
  showAccessDenied?: boolean;
}

/**
 * Componente de guarda de rota que verifica permissões baseadas em roles
 */
export function RequireRole({ 
  children, 
  allowedRoles, 
  fallbackRoute = '/',
  showAccessDenied = true 
}: RequireRoleProps) {
  const { isAuthenticated, isLoading, roles, getInitialRoute } = useAuth();
  const location = useLocation();

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Se não autenticado, redirecionar para home (que mostrará login)
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Verificar se tem alguma role permitida
  const hasPermission = allowedRoles.some(role => roles.includes(role));

  if (!hasPermission) {
    if (showAccessDenied) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="flex items-center justify-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Acesso Negado
              </CardTitle>
              <CardDescription>
                Você não tem permissão para acessar esta página.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Esta funcionalidade está disponível apenas para usuários com permissões específicas.
                Entre em contato com o administrador se você acredita que deveria ter acesso.
              </p>
              <Button 
                onClick={() => window.location.href = getInitialRoute()} 
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
    
    return <Navigate to={fallbackRoute} replace />;
  }

  return <>{children}</>;
}

/**
 * HOC para proteger rotas com verificação de role
 */
export function withRoleGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  allowedRoles: AppRole[]
) {
  return function WithRoleGuardWrapper(props: P) {
    return (
      <RequireRole allowedRoles={allowedRoles}>
        <WrappedComponent {...props} />
      </RequireRole>
    );
  };
}

/**
 * Componente para renderizar conteúdo condicionalmente baseado em role
 */
interface RoleBasedContentProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  fallback?: ReactNode;
}

export function RoleBasedContent({ children, allowedRoles, fallback = null }: RoleBasedContentProps) {
  const { roles } = useAuth();
  
  const hasPermission = allowedRoles.some(role => roles.includes(role));
  
  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
