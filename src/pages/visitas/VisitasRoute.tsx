import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { getFilialPorId } from '@/config/filiaisEmpresa';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import VisitasPage from './VisitasPage';
import { consultarSessaoVisitas } from './visitasApi';

export default function VisitasRoute({ gerencial = false }: { gerencial?: boolean }) {
  const { user, roles, logout, mustChangePassword } = useAuth();
  const { codEmpresaContexto, filialAtiva } = useFilialSelecionada();
  const redirecionarGerencia = !gerencial && !roles.includes('visitador');
  const sessao = useQuery({
    queryKey: ['sessao-visitas', user?.id],
    queryFn: ({ signal }) => consultarSessaoVisitas(user!.id, signal),
    enabled: !!user && !redirecionarGerencia && !mustChangePassword,
    retry: false,
  });

  if (redirecionarGerencia) return <Navigate to="/comercial/visitas" replace />;
  if (!user || mustChangePassword) return null;
  if (sessao.isPending) return <LoadingState message="Carregando Visitas" variant={gerencial ? 'content' : 'screen'} className="flex-1" />;
  if (sessao.isError) {
    return (
      <div className="flex min-h-48 flex-wrap items-center justify-center gap-3 p-4">
        <p role="alert" className="text-sm text-destructive">{sessao.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => void sessao.refetch()}>Tentar novamente</Button>
      </div>
    );
  }
  const filiais = gerencial
    ? sessao.data.filiais.filter(
      ({ filial_id }) => filial_id === filialAtiva && !!getFilialPorId(codEmpresaContexto, filialAtiva),
    )
    : sessao.data.filiais;

  return <VisitasPage key={user.id} sessao={{ ...sessao.data, filiais, perfil: gerencial ? 'gerencial' : 'visitador' }}
    logout={gerencial ? undefined : logout} />;
}
