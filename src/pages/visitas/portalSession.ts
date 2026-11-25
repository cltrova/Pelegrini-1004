import { supabase } from '@/integrations/supabase/client';

export async function tokenPortal(userId: string | undefined) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || session.user.id !== userId) {
    throw new Error('Sua sessão expirou. Entre novamente pelo portal.');
  }
  return session.access_token;
}
