import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, LockKeyhole, LogIn, Mail } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { formatAuthDialogError } from '@/components/auth/LoginDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TransmissionFullLogo } from '@/components/pelegrini/TransmissionFullLogo';

type LoginBranch = 'transmissao' | 'chevrolet';

const branches = {
  transmissao: {
    name: 'Casa da Transmissão',
    detail: 'Câmbio, diferencial, motor e peças pesadas.',
    logo: '/brand/home/transmissao-transparent.png',
    image: '/brand/home/transmissao-cambio-pesado.png',
    label: 'Especialistas em transmissão e linha pesada',
  },
  chevrolet: {
    name: 'Casa do Chevrolet',
    detail: 'Peças originais, estoque e atendimento ágil.',
    logo: '/brand/casa-chevrolet-wordmark.png',
    image: '/brand/home/chevrolet-componentes.png',
    label: 'Peças Chevrolet com procedência e agilidade',
  },
} as const;

export function PelegriniLoginPage() {
  const { login } = useAuth();
  const reduceMotion = useReducedMotion();
  const [branch, setBranch] = useState<LoginBranch>('transmissao');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const activeBranch = branches[branch];

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => {
      setBranch((current) => current === 'transmissao' ? 'chevrolet' : 'transmissao');
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

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

  return (
    <main className="pelegrini-login" data-branch={branch} data-layout="split-60-40">
      <section className="pelegrini-login-visual" aria-label="Operações Pelegrini">
        <motion.img
          key={`image-${branch}`}
          className="pelegrini-login-visual-image"
          src={activeBranch.image}
          alt=""
          aria-hidden="true"
          initial={reduceMotion ? false : { opacity: 0.62, scale: 1.025 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.8, ease: 'easeOut' }}
        />
        <div className="pelegrini-login-visual-overlay" />
        <div className="pelegrini-login-visual-content">
          <motion.div
            className="pelegrini-login-story"
            aria-live="polite"
            key={`story-${branch}`}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.5, ease: 'easeOut' }}
          >
            <span className="pelegrini-login-story-label">{activeBranch.label}</span>
            <div className="pelegrini-login-logo-stage">
              {branch === 'transmissao'
                ? <TransmissionFullLogo />
                : <img src={activeBranch.logo} alt={activeBranch.name} />}
            </div>
            <p>{activeBranch.detail}</p>
          </motion.div>
          <div className="pelegrini-login-progress" aria-hidden="true">
            {(Object.keys(branches) as LoginBranch[]).map((branchKey) => (
              <span key={branchKey} data-active={branch === branchKey ? 'true' : 'false'} />
            ))}
          </div>
        </div>
      </section>

      <section className="pelegrini-login-access" aria-labelledby="pelegrini-login-title">
        <motion.div
          className="pelegrini-login-access-inner"
          initial={reduceMotion ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.55, ease: 'easeOut' }}
        >
          <div className="pelegrini-login-heading">
            <h1 id="pelegrini-login-title">Acesso ao sistema</h1>
            <span aria-hidden="true" />
          </div>

          <form className="pelegrini-login-form" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="entry-email">Email</Label>
              <div className="pelegrini-login-field" data-login-field="email">
                <Mail className="pelegrini-login-field-icon" aria-hidden="true" />
                <Input id="entry-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-password">Senha</Label>
              <div className="pelegrini-login-field" data-login-field="password">
                <LockKeyhole className="pelegrini-login-field-icon" aria-hidden="true" />
                <Input id="entry-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button type="button" className="pelegrini-login-password-toggle" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>
            {message && <p className="pelegrini-login-message" data-state={message.type} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
            <Button type="submit" className="pelegrini-login-submit h-11 w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
              {loading ? 'Entrando...' : 'Entrar no sistema'}
            </Button>
          </form>
        </motion.div>
      </section>
    </main>
  );
}
