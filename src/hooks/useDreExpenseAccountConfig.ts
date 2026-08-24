import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'dre-expense-account-config:v1';

const DEFAULT_CONTAS_DESP_VARIAVEIS = [
  '3.1.1.02.02.00001','3.1.1.02.02.00002','3.1.1.02.02.00003','3.1.1.02.02.00004',
  '3.1.1.02.02.00005','3.1.1.02.02.00006','3.1.1.02.02.00007','3.1.1.02.02.00008',
  '3.1.1.02.02.00009','3.1.1.02.02.00024','3.1.1.02.02.00011','3.1.1.02.02.00012',
  '3.1.1.02.02.00013','3.1.1.02.02.00014','3.1.1.02.02.00015','3.1.1.02.02.00016',
  '3.1.1.02.02.00017','3.1.1.02.02.00018','3.1.1.02.02.00019','3.1.1.02.02.00020',
  '3.1.2.01.01.00015','3.1.2.01.01.00010','3.1.2.01.01.00016','3.1.2.01.01.00014',
  '3.1.2.01.02.00001','3.1.2.01.02.00002','3.1.2.01.02.00003',
  '3.1.2.02.01.00010','3.1.2.03.01.00001','3.1.2.03.01.00002','3.1.2.04.01.00001',
];

const DEFAULT_CONTAS_DESP_FIXAS = [
  '3.1.2.01.01.00001','3.1.2.01.01.00002','3.1.2.01.01.00003','3.1.2.01.01.00004',
  '3.1.2.01.01.00005','3.1.2.01.01.00006','3.1.2.01.01.00007','3.1.2.01.01.00008',
  '3.1.2.01.01.00011','3.1.2.01.02.00004','3.1.2.02.03.00005','3.1.2.01.02.00006',
  '3.1.2.02.01.00001','3.1.2.02.01.00002','3.1.2.02.01.00003','3.1.2.02.01.00004',
  '3.1.2.02.01.00005','3.1.2.02.01.00006','3.1.2.02.01.00007','3.1.2.02.01.00008',
  '3.1.2.02.01.00009','3.1.2.02.01.00011','3.1.2.02.02.00001','3.1.2.02.02.00002',
  '3.1.2.02.02.00003','3.1.2.02.02.00004','3.1.2.02.02.00005','3.1.2.02.02.00006',
  '3.1.2.02.02.00007','3.1.2.02.02.00008','3.1.2.02.02.00009','3.1.2.02.02.00010',
  '3.1.2.02.02.00011','3.1.2.02.02.00012','3.1.2.02.02.00013','3.1.2.02.02.00014',
  '3.1.2.02.04.00001','3.1.2.02.02.00016','3.1.2.02.02.00017','3.1.2.02.02.00038',
  '3.1.2.02.02.00019','3.1.2.02.02.00020','3.1.2.02.02.00021','3.1.2.02.02.00022',
  '3.1.2.02.02.00023','3.1.2.02.03.00006','3.1.2.02.02.00025','3.1.2.02.02.00026',
  '3.1.2.02.02.00027','3.1.2.02.02.00028','3.1.2.02.02.00029','3.1.2.02.02.00030',
  '3.1.2.02.02.00031','3.1.2.02.02.00032','3.1.2.02.03.00004','3.1.2.02.03.00002',
  '3.1.2.02.01.00013','3.1.2.02.02.00036','3.1.2.03.02.00001','3.1.2.03.02.00002',
  '3.1.2.03.02.00003','3.1.2.03.02.00004','3.1.2.03.02.00005','3.1.2.03.02.00006',
  '3.1.2.01.03.00001','3.1.2.03.01.00003','3.1.2.04.02.00002',
];

interface StoredDreExpenseAccountConfig {
  contasDespVar?: string[];
  contasDespFixas?: string[];
  excludedContasDespFixas?: string[];
  excludedContasDespVar?: string[];
}

function getDefaultConfig() {
  return {
    contasDespVar: [...DEFAULT_CONTAS_DESP_VARIAVEIS],
    contasDespFixas: [...DEFAULT_CONTAS_DESP_FIXAS],
    excludedContasDespFixas: [] as string[],
    excludedContasDespVar: [] as string[],
  };
}

function loadStoredConfig() {
  const fallback = getDefaultConfig();

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as StoredDreExpenseAccountConfig;

    return {
      contasDespVar: Array.isArray(parsed.contasDespVar) ? parsed.contasDespVar : fallback.contasDespVar,
      contasDespFixas: Array.isArray(parsed.contasDespFixas) ? parsed.contasDespFixas : fallback.contasDespFixas,
      excludedContasDespFixas: Array.isArray(parsed.excludedContasDespFixas) ? parsed.excludedContasDespFixas : fallback.excludedContasDespFixas,
      excludedContasDespVar: Array.isArray(parsed.excludedContasDespVar) ? parsed.excludedContasDespVar : fallback.excludedContasDespVar,
    };
  } catch {
    return fallback;
  }
}

function toArray(values: Set<string>) {
  return Array.from(values);
}

export function useDreExpenseAccountConfig() {
  const [initialConfig] = useState(() => loadStoredConfig());
  const [contasDespVar, setContasDespVarState] = useState<Set<string>>(() => new Set(initialConfig.contasDespVar));
  const [contasDespFixas, setContasDespFixasState] = useState<Set<string>>(() => new Set(initialConfig.contasDespFixas));
  const [excludedContasDespFixas, setExcludedContasDespFixasState] = useState<Set<string>>(() => new Set(initialConfig.excludedContasDespFixas));
  const [excludedContasDespVar, setExcludedContasDespVarState] = useState<Set<string>>(() => new Set(initialConfig.excludedContasDespVar));

  const setContasDespVar = useCallback((contas: Set<string>) => {
    setContasDespVarState(new Set(contas));
  }, []);

  const setContasDespFixas = useCallback((contas: Set<string>) => {
    setContasDespFixasState(new Set(contas));
  }, []);

  const setExcludedContasDespFixas = useCallback((contas: Set<string>) => {
    setExcludedContasDespFixasState(new Set(contas));
  }, []);

  const setExcludedContasDespVar = useCallback((contas: Set<string>) => {
    setExcludedContasDespVarState(new Set(contas));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        contasDespVar: toArray(contasDespVar),
        contasDespFixas: toArray(contasDespFixas),
        excludedContasDespFixas: toArray(excludedContasDespFixas),
        excludedContasDespVar: toArray(excludedContasDespVar),
      }),
    );
  }, [contasDespVar, contasDespFixas, excludedContasDespFixas, excludedContasDespVar]);

  return {
    contasDespVar,
    contasDespFixas,
    excludedContasDespFixas,
    excludedContasDespVar,
    setContasDespVar,
    setContasDespFixas,
    setExcludedContasDespFixas,
    setExcludedContasDespVar,
  };
}