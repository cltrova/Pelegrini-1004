import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import VisitasPage from './VisitasPage';
import { consultarSessaoVisitas, listarVisitas } from './visitasApi';
import { tokenPortal } from './portalSession';

export default function VisitasGerenciaPage() {
  const { user } = useAuth();
  const { filialAtiva } = useFilialSelecionada();
  const chevroletAtiva = filialAtiva === 'chevrolet';
  const session = useQuery({
    queryKey: ['sessao-visitas-gerencia', user?.id],
    enabled: !!user?.id && chevroletAtiva,
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const result = await consultarSessaoVisitas(await tokenPortal(user?.id), signal);
      if (result?.id !== user?.id || result?.perfil !== 'gerencial') {
        throw new Error('Sua sessão do Comercial não está disponível. Entre novamente pelo portal.');
      }
      return result;
    },
  });

  if (!chevroletAtiva) return <Navigate to="/comercial/dashboard" replace />;
  if (session.isPending) {
    return <LoadingState message="Carregando relatórios de visitas" variant="content" className="flex-1" />;
  }
  if (session.isError) return (
    <div className="space-y-3 p-4">
      <p role="alert" className="text-sm text-muted-foreground">{session.error.message}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => void session.refetch()}>Tentar novamente</Button>
    </div>
  );

  return <VisitasPage key={session.data.id} sessao={session.data}
    carregar={async (params, signal) => listarVisitas(params, signal, await tokenPortal(user?.id))} />;
}
