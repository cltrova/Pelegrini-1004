import { useState } from 'react';
import { Loader2, KeyRound, Eye, EyeOff, LogOut, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

function translateAuthError(err: any): string {
  const msg: string = (err?.message || '').toString();
  const code: string = (err?.code || err?.error_code || '').toString();
  const lower = msg.toLowerCase();
  if (code === 'same_password' || lower.includes('should be different')) {
    return 'A nova senha precisa ser diferente da senha temporária.';
  }
  if (code === 'weak_password' || lower.includes('pwned') || lower.includes('leaked') || lower.includes('compromised')) {
    return 'Senha muito fraca ou já vazada em bancos públicos. Escolha outra, misturando letras, números e símbolos.';
  }
  if (lower.includes('password should be at least')) {
    return 'Senha muito curta. Use no mínimo 6 caracteres (recomendado 8+).';
  }
  if (lower.includes('session') || lower.includes('jwt')) {
    return 'Sua sessão expirou. Saia e entre novamente com a senha temporária.';
  }
  return msg || 'Não foi possível atualizar a senha.';
}

export function ForceChangePassword() {
  const { user, refreshProfile, logout } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < 6) {
      setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: updErr } = await supabase.auth.updateUser({ password });
      console.log('[ForceChangePassword] updateUser response:', { data, updErr });
      if (updErr) throw updErr;

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('user_id', user!.id);
      if (profErr) throw profErr;

      // Força atualização da sessão para que o novo hash seja usado
      await supabase.auth.refreshSession();
      await refreshProfile();
      toast({ title: 'Senha atualizada', description: 'Agora entre sempre com sua nova senha.' });
    } catch (err: any) {
      console.error('[ForceChangePassword] erro:', err);
      const friendly = translateAuthError(err);
      setErrorMsg(friendly);
      toast({ title: 'Não foi possível salvar', description: friendly, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle>Primeiro acesso</CardTitle>
          </div>
          <CardDescription>
            Por segurança, defina uma nova senha para continuar. A senha temporária deixará de funcionar após a troca.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-pass">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-pass"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <Button
                  type="button" variant="ghost" size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pass">Confirmar senha</Label>
              <Input
                id="confirm-pass"
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a nova senha"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar nova senha'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={logout} disabled={loading}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
