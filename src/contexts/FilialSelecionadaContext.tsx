import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { useEmpresaSelecionada } from '@/contexts/EmpresaSelecionadaContext';
import { useAuth } from '@/contexts/AuthContext';
import { empresaPossuiFiliais, getFilialPorId } from '@/config/filiaisEmpresa';
import { getFilialAccessState } from '@/utils/filialAccess';

interface FilialSelecionadaContextType {
  filialAtiva: string | null;
  filialNome: string | null;
  setFilialAtiva: (id: string | null) => void;
  setFilialAtivaForEmpresa: (codEmpresa: string | null | undefined, id: string | null) => void;
  clearFilial: () => void;
  /** Empresa ativa exige seleção de filial e ainda não há uma escolhida. */
  requerSelecao: boolean;
  /** Empresa ativa possui filiais distintas configuradas. */
  empresaPossuiFiliaisAtiva: boolean;
  codEmpresaContexto: string | null;
}

const FilialSelecionadaContext = createContext<FilialSelecionadaContextType | undefined>(undefined);

const STORAGE_PREFIX = 'bi-reports-filial-';

export function FilialSelecionadaProvider({ children }: { children: ReactNode }) {
  const { empresaSelecionada } = useEmpresaSelecionada();
  const { codEmpresa: codEmpresaPerfil, isMaster, profile } = useAuth() as any;
  const filialPadraoPerfil = (profile?.filial_id as string | null) ?? null;
  const filiaisPermitidasPerfil = (profile?.filiais_permitidas as string[] | null | undefined) ?? undefined;

  const codEmpresaContexto = isMaster ? empresaSelecionada : codEmpresaPerfil;
  const empresaPossuiFiliaisAtiva = empresaPossuiFiliais(codEmpresaContexto);
  const filialAccessState = getFilialAccessState({
    codEmpresa: codEmpresaContexto,
    isMaster,
    filiaisPermitidas: filiaisPermitidasPerfil,
    filialPadrao: filialPadraoPerfil,
  });

  const storageKey = useMemo(
    () => (codEmpresaContexto ? `${STORAGE_PREFIX}${codEmpresaContexto}` : null),
    [codEmpresaContexto],
  );

  const [filialAtiva, setFilialAtivaState] = useState<string | null>(() => {
    if (!codEmpresaContexto) return null;
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${codEmpresaContexto}`);
    const initialAccess = getFilialAccessState({
      codEmpresa: codEmpresaContexto,
      isMaster,
      filiaisPermitidas: filiaisPermitidasPerfil,
      filialPadrao: filialPadraoPerfil,
    });
    if (stored && initialAccess.available.some((filial) => filial.id === stored)) return stored;
    if (initialAccess.available.length === 1) return initialAccess.available[0].id;
    // Fallback: filial padrão vinda do perfil do usuário
    if (!isMaster && filialPadraoPerfil && initialAccess.available.some((filial) => filial.id === filialPadraoPerfil)) {
      return filialPadraoPerfil;
    }
    return null;
  });

  // Recarregar quando empresa muda
  useEffect(() => {
    if (!storageKey) {
      setFilialAtivaState(null);
      return;
    }
    const stored = localStorage.getItem(storageKey);
    // Validar se ainda existe na config
    if (stored && filialAccessState.available.some((filial) => filial.id === stored)) {
      setFilialAtivaState(stored);
    } else {
      if (filialAccessState.available.length === 1) {
        setFilialAtivaState(filialAccessState.available[0].id);
        localStorage.setItem(storageKey, filialAccessState.available[0].id);
      } else if (!isMaster && filialPadraoPerfil && filialAccessState.available.some((filial) => filial.id === filialPadraoPerfil)) {
        setFilialAtivaState(filialPadraoPerfil);
        localStorage.setItem(storageKey, filialPadraoPerfil);
      } else {
        setFilialAtivaState(null);
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey, codEmpresaContexto, isMaster, filialPadraoPerfil, filiaisPermitidasPerfil]);

  const setFilialAtiva = useCallback((id: string | null) => {
    setFilialAtivaState(id);
    if (!storageKey) return;
    if (id) localStorage.setItem(storageKey, id);
    else localStorage.removeItem(storageKey);
  }, [storageKey]);

  const setFilialAtivaForEmpresa = useCallback((codEmpresa: string | null | undefined, id: string | null) => {
    if (!codEmpresa) return;
    const access = getFilialAccessState({
      codEmpresa,
      isMaster,
      filiaisPermitidas: filiaisPermitidasPerfil,
      filialPadrao: filialPadraoPerfil,
    });
    if (id && !access.available.some((filial) => filial.id === id)) return;

    const key = `${STORAGE_PREFIX}${codEmpresa}`;
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);

    if (codEmpresa === codEmpresaContexto) {
      setFilialAtivaState(id);
    }
  }, [codEmpresaContexto, isMaster, filialPadraoPerfil, filiaisPermitidasPerfil]);

  const clearFilial = useCallback(() => {
    setFilialAtiva(null);
  }, [setFilialAtiva]);

  const filialNome = getFilialPorId(codEmpresaContexto, filialAtiva)?.nome ?? null;
  const requerSelecao = empresaPossuiFiliaisAtiva && !filialAtiva;

  return (
    <FilialSelecionadaContext.Provider value={{
      filialAtiva,
      filialNome,
      setFilialAtiva,
      setFilialAtivaForEmpresa,
      clearFilial,
      requerSelecao,
      empresaPossuiFiliaisAtiva,
      codEmpresaContexto,
    }}>
      {children}
    </FilialSelecionadaContext.Provider>
  );
}

export function useFilialSelecionada() {
  const ctx = useContext(FilialSelecionadaContext);
  if (!ctx) throw new Error('useFilialSelecionada must be used within FilialSelecionadaProvider');
  return ctx;
}
