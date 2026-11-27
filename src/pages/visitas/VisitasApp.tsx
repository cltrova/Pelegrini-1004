import { useEffect, useState, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PelegriniThemeProvider } from '@/components/common/PelegriniThemeProvider';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import VisitasPage from './VisitasPage';
import { consultarSessaoVisitas, sairVisitas, trocarSenhaVisitas, type SessaoVisitas } from './visitasApi';

const queries = new QueryClient();

function VisitasEntrada() {
  const [sessao, setSessao] = useState<SessaoVisitas>();
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let active = true;
    void consultarSessaoVisitas().then(value => {
      if (!active) return;
      if (value) setSessao(value);
      else window.location.replace('/');
    }).catch(() => {
      if (!active) return;
      setErro('Não foi possível verificar a sessão. Tente entrar novamente.');
    });
    return () => { active = false; };
  }, []);

  async function definirSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const senha = String(form.get('nova-senha'));
    if (senha !== form.get('confirmacao')) {
      setErro('As senhas precisam ser iguais.');
      return;
    }
    setPending(true);
    setErro('');
    try {
      setSessao(await trocarSenhaVisitas(senha));
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar a senha.');
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await sairVisitas();
    queries.clear();
    window.location.replace('/');
  }

  if (!sessao) return erro ? (
    <main className="space-y-3 p-6">
      <p role="alert" className="text-sm text-destructive">{erro}</p>
      <Button asChild variant="outline"><a href="/">Voltar ao login</a></Button>
    </main>
  ) : <LoadingState message="Carregando Visitas" variant="screen" />;

  if (sessao.troca_senha_pendente) return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 text-foreground">
      <form onSubmit={definirSenha} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <h1 className="text-xl font-semibold">Defina sua senha</h1>
        <p className="text-sm text-muted-foreground">Use pelo menos 12 caracteres para acessar seus relatórios de visitas.</p>
        <div className="space-y-1.5">
          <Label htmlFor="nova-senha">Nova senha</Label>
          <Input type="password" id="nova-senha" name="nova-senha" autoComplete="new-password"
            minLength={12} maxLength={256} disabled={pending} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirme-senha">Confirme a nova senha</Label>
          <Input type="password" id="confirme-senha" name="confirmacao" autoComplete="new-password"
            minLength={12} maxLength={256} disabled={pending} required />
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Salvando…' : 'Salvar senha'}</Button>
        <Button type="button" variant="ghost" className="w-full" disabled={pending}
          onClick={() => void logout().catch(() => setErro('Não foi possível encerrar a sessão. Tente novamente.'))}>Sair</Button>
      </form>
    </main>
  );
  return <VisitasPage key={sessao.id} sessao={sessao} logout={logout} />;
}

export default function VisitasApp() {
  return <PelegriniThemeProvider>
    <QueryClientProvider client={queries}><VisitasEntrada /></QueryClientProvider>
  </PelegriniThemeProvider>;
}
