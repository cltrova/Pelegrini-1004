 import { Outlet } from 'react-router-dom';
 import { ComercialMobileBottomNav } from './ComercialMobileBottomNav';
 
 export function ComercialMobileLayout() {
   return (
    <div data-module-shell="comercial" className="flex h-dvh min-h-0 flex-col bg-background">
       <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
         <Outlet />
       </main>
       <ComercialMobileBottomNav />
     </div>
   );
 }
