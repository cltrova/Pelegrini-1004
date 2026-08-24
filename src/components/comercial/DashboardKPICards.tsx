import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { DashboardKPICardsPremium } from './DashboardKPICardsPremium';
import { DashboardKPICardsLegacy } from './DashboardKPICardsLegacy';

export function DashboardKPICards(props: any) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  return codEmpresaAtiva === '1003'
    ? <DashboardKPICardsPremium {...props} />
    : <DashboardKPICardsLegacy {...props} />;
}
