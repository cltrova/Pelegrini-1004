import { DreRecord } from '@/types/dre';

export const GRUPOS_FIXOS_DRE = new Set([
  'Despesas com Pessoal Administrativo',
  'Outras Despesas Administrativas',
  'Despesas Não Dedutiveis',
  'Despesas Tributárias',
]);

interface EffectiveFixedAccountsParams {
  allRecords: DreRecord[];
  selectedFixedCodes: Set<string>;
  excludedFixedCodes?: Set<string>;
  variableCodes?: Set<string>;
}

export function isGrupoFixoDre(grupo: string) {
  return GRUPOS_FIXOS_DRE.has(grupo);
}

export function getEffectiveFixedAccountCodes({
  allRecords,
  selectedFixedCodes,
  excludedFixedCodes = new Set<string>(),
  variableCodes = new Set<string>(),
}: EffectiveFixedAccountsParams) {
  const effectiveCodes = new Set<string>();

  allRecords.forEach((record) => {
    const isFixed = selectedFixedCodes.has(record.codigo) || isGrupoFixoDre(record.grupo);

    if (isFixed && !variableCodes.has(record.codigo) && !excludedFixedCodes.has(record.codigo)) {
      effectiveCodes.add(record.codigo);
    }
  });

  return effectiveCodes;
}

export const GRUPOS_VARIAVEIS_DRE = new Set([
  'Custos de Vendas de Serviços',
  'Despesas com Pessoal de Vendas',
  'Outras Despesas com vendas',
  'Provisão para Credito Liquid. Duvidosas',
  'Despesas E-Commerce',
]);

export function isGrupoVariavelDre(grupo: string) {
  return GRUPOS_VARIAVEIS_DRE.has(grupo);
}

interface EffectiveVariableAccountsParams {
  allRecords: DreRecord[];
  selectedVariableCodes: Set<string>;
  excludedVariableCodes?: Set<string>;
}

export function getEffectiveVariableAccountCodes({
  allRecords,
  selectedVariableCodes,
  excludedVariableCodes = new Set<string>(),
}: EffectiveVariableAccountsParams) {
  const effectiveCodes = new Set<string>();

  allRecords.forEach((record) => {
    const isVar = selectedVariableCodes.has(record.codigo) || isGrupoVariavelDre(record.grupo);

    if (isVar && !excludedVariableCodes.has(record.codigo)) {
      effectiveCodes.add(record.codigo);
    }
  });

  return effectiveCodes;
}
