import { Outlet } from 'react-router-dom';
import { FinanceiroSidebar } from './FinanceiroSidebar';
import { FinanceiroSearchProvider } from '@/contexts/FinanceiroSearchContext';

export function FinanceiroLayout() {
  return (
    <FinanceiroSearchProvider>
      <div className="min-h-screen flex w-full bg-background">
        <FinanceiroSidebar />
        <main className="flex-1 md:ml-64 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </FinanceiroSearchProvider>
  );
}
