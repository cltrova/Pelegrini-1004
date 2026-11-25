import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import VisitasPage from './VisitasPage';
import { consultarSessaoVisitas, listarVisitas } from './visitasApi';
import { tokenPortal } from './portalSession';

export default function VisitasGerenciaPage() {
  const { user } = useAuth();
  const { filialAtiva } = useFilialSelecionada();
  const session = useQuery({
    queryKey: ['sessao-visitas-gerencia', user?.id],
    enabled: !!user?.id,
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

  if (session.isPending) return <p role="status" className="p-4">Carregando relatórios de visitas…</p>;
  if (session.isError) return (
    <div className="space-y-3 p-4">
      <h1 className="text-lg font-bold">Relatórios de visitas</h1>
      <p role="alert" className="text-sm text-muted-foreground">{session.error.message}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => void session.refetch()}>Tentar novamente</Button>
    </div>
  );

  return <VisitasPage key={`${session.data.id}:${filialAtiva}`} sessao={session.data} filialInicial={filialAtiva}
    carregar={async (params, signal) => listarVisitas(params, signal, await tokenPortal(user?.id))} />;
}
