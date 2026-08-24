import { Outlet } from 'react-router-dom';
import { WhatsappHeader } from './WhatsappHeader';

export function WhatsappLayout() {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <WhatsappHeader />
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
