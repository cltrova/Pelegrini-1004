import { getFilialPorId } from '../config/filiaisEmpresa';
import { PELEGRINI_THEMES } from '../config/pelegriniTheme';

export interface CotacoesFilialContext {
  filialId: 'transmissao' | 'chevrolet';
  nome: string;
  codigoEmpresaBi: '1004' | '10041';
  logoSrc: string;
  logoAlt: string;
}

export function resolveCotacoesFilial(
  codEmpresaAtiva: string | null | undefined,
  filialAtiva: string | null | undefined,
): CotacoesFilialContext | null {
  if (codEmpresaAtiva !== '1004' && codEmpresaAtiva !== '10041') return null;

  const filial = getFilialPorId(codEmpresaAtiva, filialAtiva);
  if (filial?.id !== 'transmissao' && filial?.id !== 'chevrolet') return null;

  const theme = PELEGRINI_THEMES[filial.id];
  return {
    filialId: filial.id,
    nome: theme.name,
    codigoEmpresaBi: filial.id === 'chevrolet' ? '10041' : '1004',
    logoSrc: theme.logoSrc,
    logoAlt: theme.logoAlt,
  };
}
