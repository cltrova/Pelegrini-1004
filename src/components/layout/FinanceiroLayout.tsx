import { Outlet } from 'react-router-dom';
import { FinanceiroSidebar } from './FinanceiroSidebar';
import { FinanceiroSearchProvider } from '@/contexts/FinanceiroSearchContext';
import { PelegriniModuleShell } from '@/components/pelegrini';

export function FinanceiroLayout() {
  return (
    <FinanceiroSearchProvider>
      <PelegriniModuleShell sidebar={<FinanceiroSidebar />}>
        <Outlet />
      </PelegriniModuleShell>
    </FinanceiroSearchProvider>
  );
}
