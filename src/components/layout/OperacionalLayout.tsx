import { Outlet } from 'react-router-dom';
import { OperacionalSidebar } from './OperacionalSidebar';

export function OperacionalLayout() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <OperacionalSidebar />
      <main className="flex-1 md:ml-64 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
