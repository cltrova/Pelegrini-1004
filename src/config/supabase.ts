type SupabaseEnv = Record<string, string | boolean | undefined>;

const placeholderPattern = /example\.supabase\.co|seu-projeto|sua-chave|local-preview-key/i;

export function isSupabaseConfigured(env: SupabaseEnv = import.meta.env): boolean {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const key = typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string'
    ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim()
    : '';

  if (!url || !key || placeholderPattern.test(url) || placeholderPattern.test(key)) return false;

  try {
    const parsedUrl = new URL(url);
    const isSecure = parsedUrl.protocol === 'https:';
    const isLocalDevelopment = parsedUrl.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname);
    return isSecure || isLocalDevelopment;
  } catch {
    return false;
  }
}
