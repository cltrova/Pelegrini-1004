// Formatadores de valores para exibição

export function formatCurrency(value: number, showSign = false): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  
  if (showSign && value !== 0) {
    return value > 0 ? `+${formatted}` : `-${formatted}`;
  }
  
  return value < 0 ? `-${formatted}` : formatted;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatPercent(value: number, showSign = false): string {
  const formatted = `${formatNumber(Math.abs(value), 1)}%`;
  
  if (showSign && value !== 0) {
    return value > 0 ? `+${formatted}` : `-${formatted}`;
  }
  
  return value < 0 ? `-${formatted}` : formatted;
}

export function formatPeriod(anoMes: string): string {
  const [ano, mes] = anoMes.split('-');
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  if (mes) {
    return `${meses[parseInt(mes, 10) - 1]} ${ano}`;
  }
  
  return ano;
}

export function formatPeriodShort(anoMes: string): string {
  const [ano, mes] = anoMes.split('-');
  const mesesCurtos = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  
  if (mes) {
    return `${mesesCurtos[parseInt(mes, 10) - 1]}/${ano.slice(2)}`;
  }
  
  return ano;
}

const MESES_COMPLETOS_PT = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function parseIsoDateParts(value?: string): { ano: number; mes: number; dia: number } | null {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return {
    ano: Number(match[1]),
    mes: Number(match[2]),
    dia: Number(match[3]),
  };
}

function formatDateBr(parts: { ano: number; mes: number; dia: number }): string {
  return `${String(parts.dia).padStart(2, '0')}/${String(parts.mes).padStart(2, '0')}/${parts.ano}`;
}

export function formatFiltroPeriodoLabel(
  periodo: { inicio?: string; fim?: string } | undefined,
  fallback: { ano: number; mes: number },
): string {
  const inicio = parseIsoDateParts(periodo?.inicio);
  const fim = parseIsoDateParts(periodo?.fim);
  const mesNome = MESES_COMPLETOS_PT[(fallback.mes || 1) - 1] || String(fallback.mes).padStart(2, '0');

  if (!inicio || !fim) {
    return `Mês filtrado: ${mesNome} de ${fallback.ano}`;
  }

  if (inicio.ano === fim.ano && inicio.mes === fim.mes && inicio.dia === fim.dia) {
    return `Dia filtrado: ${formatDateBr(inicio)}`;
  }

  const ultimoDiaMes = new Date(inicio.ano, inicio.mes, 0).getDate();
  const cobreMesInteiro = inicio.ano === fim.ano
    && inicio.mes === fim.mes
    && inicio.dia === 1
    && fim.dia === ultimoDiaMes;

  if (cobreMesInteiro) {
    const nome = MESES_COMPLETOS_PT[inicio.mes - 1] || String(inicio.mes).padStart(2, '0');
    return `Mês filtrado: ${nome} de ${inicio.ano}`;
  }

  return `Período filtrado: ${formatDateBr(inicio)} a ${formatDateBr(fim)}`;
}

export function formatCompactNumber(value: number): string {
  const absValue = Math.abs(value);
  
  if (absValue >= 1_000_000_000) {
    return `${formatNumber(value / 1_000_000_000, 1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${formatNumber(value / 1_000_000, 1)}M`;
  }
  if (absValue >= 1_000) {
    return `${formatNumber(value / 1_000, 1)}K`;
  }
  
  return formatNumber(value, 0);
}

/** Moeda compacta para cards estreitos: R$ 430,1K / R$ 1,2M. Mantém centavos só abaixo de 1k. */
export function formatCurrencyCompact(value: number, showSign = false): string {
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1_000_000) body = `R$ ${formatNumber(value / 1_000_000, 2)}M`;
  else if (abs >= 1_000) body = `R$ ${formatNumber(value / 1_000, 1)}K`;
  else body = `R$ ${formatNumber(value, 2)}`;

  if (showSign && value !== 0) return value > 0 ? `+${body}` : body.replace('R$', '-R$');
  return value < 0 ? body.replace('R$', '-R$') : body;
}

export function getValueColorClass(value: number): string {
  if (value > 0) return 'value-positive';
  if (value < 0) return 'value-negative';
  return '';
}

export function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return '↑';
    case 'down': return '↓';
    default: return '→';
  }
}
