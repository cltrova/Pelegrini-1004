import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { DashboardChartsPremium } from './DashboardChartsPremium';
import { DashboardChartsLegacy } from './DashboardChartsLegacy';

export function DashboardCharts(props: any) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  return codEmpresaAtiva === '1003'
    ? <DashboardChartsPremium {...props} />
    : <DashboardChartsLegacy {...props} />;
}
