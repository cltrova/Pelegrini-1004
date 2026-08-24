import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  CLIENTE_COD_EMPRESA_BI_PADRAO,
  isCliente1004,
  resolveCliente1004,
} from '@/config/cliente1004';

interface EmpresaSelecionadaContextType {
  empresaSelecionada: string | null;
  setEmpresaSelecionada: (codEmpresa: string | null) => void;
  clearEmpresaSelecionada: () => void;
}

const EmpresaSelecionadaContext = createContext<EmpresaSelecionadaContextType | undefined>(undefined);

const STORAGE_KEY = 'bi-reports-empresa-selecionada';

export function EmpresaSelecionadaProvider({ children }: { children: ReactNode }) {
  const [empresaSelecionada, setEmpresaSelecionadaState] = useState<string | null>(() => {
    if (typeof localStorage === 'undefined') {
      return CLIENTE_COD_EMPRESA_BI_PADRAO;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    return resolveCliente1004(stored);
  });

  const setEmpresaSelecionada = (codEmpresa: string | null) => {
    const nextEmpresa = resolveCliente1004(codEmpresa);

    setEmpresaSelecionadaState(nextEmpresa);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, nextEmpresa);
    }
  };

  const clearEmpresaSelecionada = () => {
    setEmpresaSelecionadaState(CLIENTE_COD_EMPRESA_BI_PADRAO);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, CLIENTE_COD_EMPRESA_BI_PADRAO);
    }
  };

  useEffect(() => {
    if (!isCliente1004(empresaSelecionada)) {
      setEmpresaSelecionada(CLIENTE_COD_EMPRESA_BI_PADRAO);
    }
  }, [empresaSelecionada]);

  return (
    <EmpresaSelecionadaContext.Provider 
      value={{ 
        empresaSelecionada, 
        setEmpresaSelecionada, 
        clearEmpresaSelecionada 
      }}
    >
      {children}
    </EmpresaSelecionadaContext.Provider>
  );
}

export function useEmpresaSelecionada() {
  const context = useContext(EmpresaSelecionadaContext);
  if (!context) {
    throw new Error('useEmpresaSelecionada must be used within EmpresaSelecionadaProvider');
  }
  return context;
}
