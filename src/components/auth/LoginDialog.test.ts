import { describe, expect, it } from 'vitest';
import { formatAuthDialogError } from './LoginDialog';

describe('LoginDialog auth messages', () => {
  it('explica falha de conexao quando o Supabase local esta em modo preview', () => {
    expect(formatAuthDialogError('Failed to fetch')).toBe(
      'Nao foi possivel conectar ao Supabase. Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY reais no .env.local para testar cadastro e login.'
    );
  });

  it('mantem mensagens de autenticacao vindas do backend quando nao sao falha de conexao', () => {
    expect(formatAuthDialogError('Invalid login credentials')).toBe('Invalid login credentials');
  });
});
