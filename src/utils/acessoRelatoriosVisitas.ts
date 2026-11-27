import { isCliente1004 } from '@/config/cliente1004';

export function filialPermiteRelatoriosVisitas(codEmpresa: string | null, filialAtiva: string | null): boolean {
  return isCliente1004(codEmpresa) && filialAtiva === 'chevrolet';
}
