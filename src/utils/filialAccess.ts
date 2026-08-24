import { getFiliaisDaEmpresa, type FilialConfig } from '@/config/filiaisEmpresa';

export interface FilialAccessInput {
  codEmpresa: string | null | undefined;
  isMaster: boolean;
  filiaisPermitidas: string[] | null | undefined;
  filialPadrao: string | null | undefined;
}

export interface FilialAccessItem extends FilialConfig {
  blocked: boolean;
}

export function normalizeFiliaisPermitidas(
  filiaisPermitidas: string[] | null | undefined,
  filialPadrao: string | null | undefined,
): string[] {
  if (Array.isArray(filiaisPermitidas)) {
    return filiaisPermitidas.filter(Boolean);
  }

  return filialPadrao ? [filialPadrao] : [];
}

export function getFilialAccessState({
  codEmpresa,
  isMaster,
  filiaisPermitidas,
  filialPadrao,
}: FilialAccessInput) {
  const filiais = getFiliaisDaEmpresa(codEmpresa);
  const permitted = new Set(normalizeFiliaisPermitidas(filiaisPermitidas, filialPadrao));

  const items: FilialAccessItem[] = filiais.map((filial) => ({
    ...filial,
    blocked: !isMaster && !permitted.has(filial.id),
  }));

  const available = items.filter((filial) => !filial.blocked);
  const blocked = items.filter((filial) => filial.blocked);

  return {
    items,
    available,
    blocked,
    hasAnyAccess: available.length > 0,
  };
}
