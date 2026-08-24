/**
 * Tokens semânticos do padrão visual Comercial 1004.
 * Reflete as cores usadas em VisaoGeralRapida1004 e é a fonte única
 * para gráficos, badges e cards das demais abas.
 */
export const PREMIUM_1004 = {
  // Valores e referência (identidade primária)
  AZUL: 'hsl(var(--primary))',
  AZUL_SOFT: 'hsl(var(--primary) / 0.15)',

  // Realizado / positivo / atingido
  VERDE: 'hsl(142 71% 45%)',
  VERDE_SOFT: 'hsl(142 71% 45% / 0.15)',

  // Atenção / metas em andamento
  AMARELO: 'hsl(38 92% 50%)',
  AMARELO_SOFT: 'hsl(38 92% 50% / 0.15)',

  // Perdas / devoluções / negativo
  VERMELHO: 'hsl(var(--destructive))',
  VERMELHO_SOFT: 'hsl(var(--destructive) / 0.15)',

  // Comparação / meta de referência
  ROXO: 'hsl(262 83% 65%)',
  ROXO_SOFT: 'hsl(262 83% 65% / 0.15)',

  // Neutro secundário
  CINZA: 'hsl(var(--muted-foreground))',
} as const;

export type Premium1004Tone = 'azul' | 'verde' | 'amarelo' | 'vermelho' | 'roxo';

export const TONE_TO_HEX: Record<Premium1004Tone, string> = {
  azul: PREMIUM_1004.AZUL,
  verde: PREMIUM_1004.VERDE,
  amarelo: PREMIUM_1004.AMARELO,
  vermelho: PREMIUM_1004.VERMELHO,
  roxo: PREMIUM_1004.ROXO,
};
