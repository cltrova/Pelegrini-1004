import { Outlet } from 'react-router-dom';
import { OperacionalSidebar } from './OperacionalSidebar';
import { PelegriniModuleShell } from '@/components/pelegrini';

export function OperacionalLayout() {
  return (
    <PelegriniModuleShell sidebar={<OperacionalSidebar />}>
      <Outlet />
    </PelegriniModuleShell>
  );
}
