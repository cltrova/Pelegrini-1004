// Lógica pura extraída de ComercialFilters.tsx para permitir testes unitários
// sem renderizar o componente. Comportamento mantido idêntico ao inline.
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';

// Formata Date em YYYY-MM-DD usando componentes LOCAIS (evita shift de UTC)
export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Para (ano, mes 1-12), retorna o "fim" do período:
// - mês corrente → hoje (para não pedir datas futuras à API)
// - mês passado/futuro → último dia do mês
export function computeFimPeriodo(ano: number, mes: number, hoje: Date = new Date()): string {
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  if (ano === anoAtual && mes === mesAtual) {
    return toLocalISO(hoje);
  }
  const ultimoDia = new Date(ano, mes, 0);
  return toLocalISO(ultimoDia);
}

// Filtros padrão: mês corrente, do primeiro dia até hoje.
export function getDefaultFilters(
  _periodoDisponivel?: { ultimoAno: string; ultimoMes: string } | null,
  hoje: Date = new Date(),
): ComercialFiltersType {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const primeiroDia = new Date(ano, mes - 1, 1);
  return {
    anos: [String(ano)],
    meses: [String(mes).padStart(2, '0')],
    periodo: {
      inicio: toLocalISO(primeiroDia),
      fim: computeFimPeriodo(ano, mes, hoje),
    },
    status: 'todos',
    tipo: 'todos',
  };
}

// Lógica pura de updatePeriodo (equivalente ao inline no componente)
export function buildPeriodoUpdate(
  currentFilters: ComercialFiltersType,
  anosArr: string[],
  mesesArr: string[],
  hoje: Date = new Date(),
): ComercialFiltersType {
  if (anosArr.length === 0 || mesesArr.length === 0) {
    return { ...currentFilters, anos: anosArr, meses: mesesArr };
  }
  const menorAno = Math.min(...anosArr.map(Number));
  const maiorAno = Math.max(...anosArr.map(Number));
  const menorMes = Math.min(...mesesArr.map(Number));
  const maiorMes = Math.max(...mesesArr.map(Number));
  const primeiroDia = new Date(menorAno, menorMes - 1, 1);
  return {
    ...currentFilters,
    anos: anosArr,
    meses: mesesArr,
    periodo: {
      inicio: toLocalISO(primeiroDia),
      fim: computeFimPeriodo(maiorAno, maiorMes, hoje),
    },
  };
}

// Lógica pura de handleLimpar
export function buildLimparFilters(
  currentFilters: ComercialFiltersType,
  hoje: Date = new Date(),
): ComercialFiltersType {
  const ano = String(hoje.getFullYear());
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return {
    ...currentFilters,
    anos: [ano],
    meses: [mes],
    vendedor: undefined,
    vendedores: undefined,
    cliente: undefined,
    tipo: 'todos',
    periodo: {
      inicio: toLocalISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
      fim: computeFimPeriodo(hoje.getFullYear(), hoje.getMonth() + 1, hoje),
    },
  };
}
