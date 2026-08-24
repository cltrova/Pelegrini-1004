 import { useLocation, useNavigate } from 'react-router-dom';
 import { LayoutDashboard, Calendar, Users, Home } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface NavItem {
   icon: React.ComponentType<{ className?: string }>;
   label: string;
   path: string;
   match?: string[];
 }
 
 const navItems: NavItem[] = [
   { icon: Home, label: 'Início', path: '/', match: ['/'] },
   { icon: LayoutDashboard, label: 'Dashboard', path: '/comercial/dashboard', match: ['/comercial/dashboard', '/comercial/metas'] },
   { icon: Calendar, label: 'Diárias', path: '/comercial/metas-diarias', match: ['/comercial/metas-diarias'] },
   { icon: Users, label: 'Clientes', path: '/comercial/clientes', match: ['/comercial/clientes', '/comercial/clientes-analise'] },
 ];
 
 export function ComercialMobileBottomNav() {
   const location = useLocation();
   const navigate = useNavigate();
 
   const isActive = (item: NavItem) => {
     if (item.match) {
       return item.match.some(m => location.pathname.startsWith(m));
     }
     return location.pathname === item.path;
   };
 
   return (
     <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
       <div className="flex items-center justify-around h-16 px-2">
         {navItems.map((item) => {
           const active = isActive(item);
           return (
             <button
               key={item.path}
               onClick={() => navigate(item.path)}
               className={cn(
                 'flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-xl transition-all duration-200 min-w-[64px]',
                 active 
                   ? 'text-primary bg-primary/10' 
                   : 'text-muted-foreground hover:text-foreground active:scale-95'
               )}
             >
               <item.icon className={cn('h-5 w-5', active && 'scale-110')} />
               <span className={cn(
                 'text-[10px] font-medium',
                 active && 'font-semibold'
               )}>
                 {item.label}
               </span>
             </button>
           );
         })}
       </div>
     </nav>
   );
 }