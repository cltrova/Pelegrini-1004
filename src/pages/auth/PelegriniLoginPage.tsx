import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Eye, EyeOff, Keyboard, Loader2, LockKeyhole, LogIn, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { formatAuthDialogError } from '@/components/auth/LoginDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TransmissionFullLogo } from '@/components/pelegrini/TransmissionFullLogo';

type LoginBranch = 'transmissao' | 'chevrolet';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu email.').email('Digite um email válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, touchedFields },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const activeBranch = branches[branch];
  const emailValue = watch('email');
  const passwordValue = watch('password');
  const emailField = register('email');
  const passwordField = register('password');

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => {
      setBranch((current) => current === 'transmissao' ? 'chevrolet' : 'transmissao');
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogin = async ({ email, password }: LoginFormValues) => {
    setMessage(null);
    const result = await login(email, password);
    if (!result?.success) {
      setMessage({ type: 'error', text: formatAuthDialogError(result?.error || 'Email ou senha incorretos.') });
    }
  };

  const updateCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState('CapsLock'));
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

          <form className="pelegrini-login-form" onSubmit={handleSubmit(handleLogin)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="entry-email">Email</Label>
              <div
                className="pelegrini-login-field"
                data-login-field="email"
                data-state={errors.email ? 'error' : touchedFields.email && emailValue ? 'valid' : 'idle'}
              >
                <Mail className="pelegrini-login-field-icon" aria-hidden="true" />
                <Input
                  {...emailField}
                  id="entry-email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'entry-email-error' : undefined}
                  autoFocus
                />
                {touchedFields.email && emailValue && !errors.email && <Check className="pelegrini-login-valid-icon" aria-hidden="true" />}
              </div>
              <AnimatePresence initial={false}>
                {errors.email && (
                  <motion.p
                    id="entry-email-error"
                    className="pelegrini-login-field-feedback"
                    initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-password">Senha</Label>
              <div
                className="pelegrini-login-field"
                data-login-field="password"
                data-state={errors.password ? 'error' : touchedFields.password && passwordValue ? 'valid' : 'idle'}
              >
                <LockKeyhole className="pelegrini-login-field-icon" aria-hidden="true" />
                <Input
                  {...passwordField}
                  id="entry-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'entry-password-error' : capsLock ? 'entry-caps-lock' : undefined}
                  onKeyDown={updateCapsLock}
                  onKeyUp={updateCapsLock}
                  onBlur={(event) => {
                    passwordField.onBlur(event);
                    setCapsLock(false);
                  }}
                />
                <button type="button" className="pelegrini-login-password-toggle" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              <AnimatePresence initial={false}>
                {errors.password && (
                  <motion.p
                    id="entry-password-error"
                    className="pelegrini-login-field-feedback"
                    initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  >
                    {errors.password.message}
                  </motion.p>
                )}
                {capsLock && !errors.password && (
                  <motion.p
                    id="entry-caps-lock"
                    className="pelegrini-login-caps-lock"
                    role="status"
                    initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  >
                    <Keyboard aria-hidden="true" />
                    Caps Lock ativado
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {message && (
                <motion.p
                  key={message.text}
                  className="pelegrini-login-message"
                  data-state={message.type}
                  role={message.type === 'error' ? 'alert' : 'status'}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: [0, -5, 5, -3, 3, 0] }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                >
                  {message.text}
                </motion.p>
              )}
            </AnimatePresence>
            <Button type="submit" className="pelegrini-login-submit h-11 w-full gap-2" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
              {isSubmitting ? 'Validando acesso...' : 'Entrar no sistema'}
            </Button>
          </form>
        </motion.div>
      </section>
    </main>
  );
}
