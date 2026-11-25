import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getFilialPorId } from '@/config/filiaisEmpresa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tokenPortal } from '@/pages/visitas/portalSession';
import { listarVisitadores, redefinirSenhaVisitador, type VisitadorCadastrado } from '@/pages/visitas/visitasApi';
import { SenhaTemporariaVisitas } from './SenhaTemporariaVisitas';

export function VisitadoresList() {
  const { user } = useAuth();
  const [visitador, setVisitador] = useState<VisitadorCadastrado | null>(null);
  const [senhaTemporaria, setSenhaTemporaria] = useState('');
  const [redefinindo, setRedefinindo] = useState(false);
  const [erroSenha, setErroSenha] = useState('');
  const lista = useQuery({
    queryKey: ['visitas-visitadores', user?.id],
    enabled: !!user?.id,
    retry: false,
    queryFn: async ({ signal }) => listarVisitadores(await tokenPortal(user?.id), signal),
  });

  function fechar() {
    if (redefinindo) return;
    setVisitador(null);
    setSenhaTemporaria('');
    setErroSenha('');
  }

  async function redefinir() {
    if (!visitador || redefinindo) return;
    setRedefinindo(true);
    setErroSenha('');
    try {
      const resultado = await redefinirSenhaVisitador(visitador.id, await tokenPortal(user?.id));
      setSenhaTemporaria(resultado.senha_temporaria);
    } catch (error) {
      setErroSenha(error instanceof Error ? error.message : 'Não foi possível gerar a senha temporária.');
    } finally {
      setRedefinindo(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Visitadores</CardTitle></CardHeader>
      <CardContent>
        {lista.isPending && <p role="status" className="text-sm text-muted-foreground">Carregando visitadores…</p>}
        {lista.isError && (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-muted-foreground">{lista.error.message}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void lista.refetch()}>Tentar novamente</Button>
          </div>
        )}
        {lista.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum visitador cadastrado.</p>}
        {!!lista.data?.length && (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Visitador</TableHead><TableHead>Filiais</TableHead><TableHead className="text-right">Ações</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {lista.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.nome}</p>
                    <p className="break-all text-sm text-muted-foreground">{item.email}</p>
                  </TableCell>
                  <TableCell>{item.filiais.map((id) => getFilialPorId(item.cod_empresa_bi, id)?.nome ?? id).join(', ') || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="sm" variant="outline" onClick={() => setVisitador(item)}
                      aria-label={`Redefinir senha de ${item.nome}`}>Redefinir senha</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!visitador} onOpenChange={(open) => { if (!open) fechar(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{senhaTemporaria ? 'Nova senha temporária' : 'Redefinir senha do visitador'}</DialogTitle>
            <DialogDescription>
              {senhaTemporaria ? visitador?.email : `Gerar uma nova senha para ${visitador?.nome}? As sessões abertas serão encerradas.`}
            </DialogDescription>
          </DialogHeader>
          {senhaTemporaria && <SenhaTemporariaVisitas senha={senhaTemporaria} />}
          {erroSenha && <p className="text-sm text-destructive" role="alert">{erroSenha}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={redefinindo} onClick={fechar}>
              {senhaTemporaria ? 'Concluir' : 'Cancelar'}
            </Button>
            {!senhaTemporaria && (
              <Button type="button" disabled={redefinindo} onClick={() => void redefinir()}>
                {redefinindo ? 'Gerando…' : 'Gerar nova senha'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
