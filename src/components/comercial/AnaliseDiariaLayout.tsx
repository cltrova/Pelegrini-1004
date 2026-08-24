import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { AnaliseDiariaLayoutPremium } from './AnaliseDiariaLayoutPremium';
import { AnaliseDiariaLayoutLegacy } from './AnaliseDiariaLayoutLegacy';

export function AnaliseDiariaLayout() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  return codEmpresaAtiva === '1003'
    ? <AnaliseDiariaLayoutPremium />
    : <AnaliseDiariaLayoutLegacy />;
}
