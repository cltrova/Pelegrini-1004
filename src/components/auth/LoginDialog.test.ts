import { describe, expect, it } from 'vitest';
import { formatAuthDialogError, getAuthDialogDescription } from './LoginDialog';

describe('LoginDialog auth messages', () => {
  it('exibe uma mensagem de indisponibilidade em falhas de conexão', () => {
    expect(formatAuthDialogError('Failed to fetch')).toBe(
      'O serviço de login está indisponível no momento. Tente novamente em instantes.'
    );
  });

  it('orienta o usuário a procurar suporte se a configuração da aplicação estiver ausente', () => {
    expect(formatAuthDialogError('AUTH_CONFIGURATION_MISSING')).toBe(
      'O acesso ao sistema está indisponível. Entre em contato com o suporte.'
    );
  });

  it('mantem mensagens de autenticacao vindas do backend quando nao sao falha de conexao', () => {
    expect(formatAuthDialogError('Invalid login credentials')).toBe('Invalid login credentials');
  });

  it('explica que cadastro nao e necessario no modo preview local', () => {
    expect(getAuthDialogDescription(true)).toBe(
      'Modo local ativo. Use a tela de Configuracoes para ajustar endpoint, VPS e modulos sem criar conta.'
    );
  });
});
