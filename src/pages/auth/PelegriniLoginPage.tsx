import { useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn, PackageCheck, ShieldCheck, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatAuthDialogError } from '@/components/auth/LoginDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type LoginBranch = 'transmissao' | 'chevrolet';

const branches = {
  transmissao: {
    name: 'Casa da Transmissão',
    detail: 'Câmbio, diferencial, motor e peças pesadas.',
    logo: '/brand/home/transmissao-transparent.png',
    image: '/brand/home/transmissao-cambio-pesado.png',
    icon: Wrench,
  },
  chevrolet: {
    name: 'Casa do Chevrolet',
    detail: 'Peças originais, estoque e atendimento ágil.',
    logo: '/brand/casa-chevrolet-wordmark.png',
    image: '/brand/home/chevrolet-componentes.png',
    icon: PackageCheck,
  },
} as const;

export function PelegriniLoginPage() {
  const { login, signup } = useAuth();
  const [branch, setBranch] = useState<LoginBranch>('transmissao');
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const activeBranch = branches[branch];

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const result = await login(email, password);
      if (!result.success) {
        setMessage({ type: 'error', text: formatAuthDialogError(result.error || 'Email ou senha incorretos.') });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas precisam ser iguais.' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    setLoading(true);
    try {
      const result = await signup(email, password, name);
      if (result.success) {
        setMessage({ type: 'success', text: 'Conta criada. Entre com suas credenciais.' });
        setTab('login');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: formatAuthDialogError(result.error) });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pelegrini-login" data-branch={branch}>
      <section className="pelegrini-login-visual" aria-label="Operações Pelegrini">
        <img className="pelegrini-login-visual-image" src={activeBranch.image} alt="" aria-hidden="true" />
        <div className="pelegrini-login-visual-overlay" />
        <div className="pelegrini-login-visual-content">
          <div className="pelegrini-login-branch-selector" aria-label="Conheça as filiais">
            {(Object.keys(branches) as LoginBranch[]).map((branchKey) => {
              const item = branches[branchKey];
              const Icon = item.icon;
              return (
                <button key={branchKey} type="button" aria-pressed={branch === branchKey} className="pelegrini-login-branch-button" onClick={() => setBranch(branchKey)}>
                  <Icon aria-hidden="true" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>

          <div className="pelegrini-login-story" aria-live="polite">
            <img src={activeBranch.logo} alt={activeBranch.name} />
            <p>{activeBranch.detail}</p>
            <div><ShieldCheck aria-hidden="true" /> Operação conectada e segura</div>
          </div>
        </div>
      </section>

      <section className="pelegrini-login-access" aria-labelledby="pelegrini-login-title">
        <div className="pelegrini-login-access-inner">
          <div className="pelegrini-login-heading">
            <span>Central de gestão</span>
            <h1 id="pelegrini-login-title">Acesse sua central</h1>
            <p>Entre com suas credenciais para continuar.</p>
          </div>

          <Tabs value={tab} onValueChange={(value) => { setTab(value as 'login' | 'signup'); setMessage(null); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form className="pelegrini-login-form" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <Label htmlFor="entry-email">Email</Label>
                  <Input id="entry-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry-password">Senha</Label>
                  <div className="relative">
                    <Input id="entry-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                    <button type="button" className="pelegrini-login-password-toggle" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((current) => !current)}>
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </div>
                {message && <p className="pelegrini-login-message" data-state={message.type} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
                <Button type="submit" className="h-11 w-full gap-2" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
                  {loading ? 'Entrando...' : 'Entrar no sistema'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="pelegrini-login-form" onSubmit={handleSignup}>
                <div className="space-y-2"><Label htmlFor="entry-name">Nome</Label><Input id="entry-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="signup-entry-email">Email</Label><Input id="signup-entry-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="signup-entry-password">Senha</Label><Input id="signup-entry-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="entry-confirm-password">Confirmar senha</Label><Input id="entry-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
                {message && <p className="pelegrini-login-message" data-state={message.type} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
                <Button type="submit" className="h-11 w-full" disabled={loading}>{loading ? 'Criando...' : 'Criar conta'}</Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="pelegrini-login-footer">Casa da Transmissão · Casa do Chevrolet</p>
        </div>
      </section>
    </main>
  );
}
