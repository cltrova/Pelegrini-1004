import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { ProdutosSectionPremium } from './ProdutosSectionPremium';
import { ProdutosSectionLegacy } from './ProdutosSectionLegacy';

export function ProdutosSection(props: any) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  return codEmpresaAtiva === '1003'
    ? <ProdutosSectionPremium {...props} />
    : <ProdutosSectionLegacy {...props} />;
}
