 import { Outlet } from 'react-router-dom';
 import { ComercialMobileHeader } from './ComercialMobileHeader';
 import { ComercialMobileBottomNav } from './ComercialMobileBottomNav';
 
 export function ComercialMobileLayout() {
   return (
     <div className="min-h-screen flex flex-col bg-background">
       <ComercialMobileHeader />
       <main className="flex-1 overflow-y-auto pb-20">
         <Outlet />
       </main>
       <ComercialMobileBottomNav />
     </div>
   );
 }