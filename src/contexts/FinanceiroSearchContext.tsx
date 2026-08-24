import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface FinanceiroSearchContextValue {
  /** true somente depois que o usuário clicar em "Buscar" */
  hasSearched: boolean;
  markSearched: () => void;
  resetSearch: () => void;
  /** false quando não há provider (outros módulos não são afetados) */
  isFinanceiroModule: boolean;
}

const FinanceiroSearchContext = createContext<FinanceiroSearchContextValue>({
  hasSearched: true,
  markSearched: () => {},
  resetSearch: () => {},
  isFinanceiroModule: false,
});

export function FinanceiroSearchProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [hasSearched, setHasSearched] = useState(false);

  // Ao trocar de tela dentro do Financeiro, volta ao estado neutro
  useEffect(() => {
    setHasSearched(false);
  }, [location.pathname]);

  const markSearched = useCallback(() => setHasSearched(true), []);
  const resetSearch = useCallback(() => setHasSearched(false), []);

  const value = useMemo(
    () => ({ hasSearched, markSearched, resetSearch, isFinanceiroModule: true }),
    [hasSearched, markSearched, resetSearch]
  );

  return (
    <FinanceiroSearchContext.Provider value={value}>
      {children}
    </FinanceiroSearchContext.Provider>
  );
}

export function useFinanceiroSearch() {
  return useContext(FinanceiroSearchContext);
}

/** Mensagem padrão do estado neutro do módulo Financeiro */
export const FINANCEIRO_EMPTY_MESSAGE =
  'Selecione os filtros e clique em Buscar para visualizar os dados.';
