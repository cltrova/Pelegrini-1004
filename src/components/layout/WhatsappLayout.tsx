import { Outlet } from 'react-router-dom';
import { WhatsappHeader } from './WhatsappHeader';
import { PelegriniModuleShell } from '@/components/pelegrini';

export function WhatsappLayout() {
  return (
    <PelegriniModuleShell sidebar={<WhatsappHeader />} variant="header">
      <Outlet />
    </PelegriniModuleShell>
  );
}
