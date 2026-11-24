import { useEffect, useState, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import VisitasPage from './VisitasPage';
import { consultarSessaoVisitas, entrarVisitas, sairVisitas, type SessaoVisitas } from './visitasApi';

const queries = new QueryClient();

function VisitasEntrada() {
  const [sessao, setSessao] = useState<SessaoVisitas | null | undefined>();
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState('');

  function iniciarSessao(value: SessaoVisitas | null) {
    if (value) {
      const path = value.perfil === 'gerencial' ? '/comercial/visitas' : '/visitas';
      if (window.location.pathname !== path) window.history.replaceState(null, '', path);
    }
    setSessao(value);
  }

  useEffect(() => {
    let active = true;
    void consultarSessaoVisitas().then(value => {
      if (active) iniciarSessao(value);
    }).catch(() => {
      if (!active) return;
      setErro('Não foi possível verificar a sessão. Tente entrar novamente.');
      setSessao(null);
    });
    return () => { active = false; };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setErro('');
    const form = new FormData(event.currentTarget);
    try {
      iniciarSessao(await entrarVisitas(String(form.get('email')), String(form.get('senha'))));
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível entrar.');
    } finally {
      setPending(false);
    }
  }

  if (sessao === undefined) return <p className="p-6" role="status">Carregando Visitas…</p>;
  if (sessao) return <VisitasPage key={sessao.id} sessao={sessao} logout={async () => {
    await sairVisitas();
    queries.clear();
    setSessao(null);
  }} />;

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 text-foreground">
      <form onSubmit={login} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <h1 className="text-xl font-semibold">Relatórios de visitas</h1>
        <div className="space-y-1.5">
          <Label htmlFor="visitas-email">Email</Label>
          <Input type="email" id="visitas-email" name="email" autoComplete="username" maxLength={254} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="visitas-senha">Senha</Label>
          <Input type="password" id="visitas-senha" name="senha" autoComplete="current-password" maxLength={256} required />
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Entrando…' : 'Entrar no sistema'}</Button>
      </form>
    </main>
  );
}

export default function VisitasApp() {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queries}><VisitasEntrada /></QueryClientProvider>
  </ThemeProvider>;
}
