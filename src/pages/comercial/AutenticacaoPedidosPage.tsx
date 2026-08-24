import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import AutenticacaoPedidosPagePremium from './AutenticacaoPedidosPagePremium';
import AutenticacaoPedidosPageExecutive from './AutenticacaoPedidosPageExecutive';
import AutenticacaoPedidosPageLegacy from './AutenticacaoPedidosPageLegacy';

export default function AutenticacaoPedidosPage() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const cod = String(codEmpresaAtiva ?? '');
  if (cod === '1003') return <AutenticacaoPedidosPageExecutive />;
  if (cod === '1004') return <AutenticacaoPedidosPagePremium />;
  return <AutenticacaoPedidosPageLegacy />;
}
