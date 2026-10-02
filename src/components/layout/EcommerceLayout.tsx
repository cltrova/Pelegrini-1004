import { Outlet } from 'react-router-dom';
import { PelegriniModuleShell } from '@/components/pelegrini';
import { EcommerceSidebar } from './EcommerceSidebar';

export function EcommerceLayout() {
  return (
    <PelegriniModuleShell sidebar={<EcommerceSidebar />} moduleKey="ecommerce">
      <div data-testid="ecommerce-route-outlet" className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </PelegriniModuleShell>
  );
}

export default EcommerceLayout;
