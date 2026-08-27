 import { NavLink, useLocation, useNavigate } from 'react-router-dom';
 import { LayoutDashboard, Calendar, Users, Home, Clock, MoreHorizontal, XCircle } from 'lucide-react';
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
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
   const { codEmpresaAtiva } = useEmpresaAtiva();
   const showQuoteNavigation = codEmpresaAtiva === '1004' || codEmpresaAtiva === '10041';
   const isQuoteRoute = location.pathname === '/comercial/cotacoes'
     || location.pathname === '/comercial/perdidas';
 
   const isActive = (item: NavItem) => {
     if (item.match) {
       return item.match.some(m => location.pathname.startsWith(m));
     }
     return location.pathname === item.path;
   };
 
   return (
     <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
       <div className="flex h-16 items-center justify-around px-2">
         {navItems.map((item) => {
           const active = isActive(item);
           return (
             <button
               key={item.path}
               onClick={() => navigate(item.path)}
               className={cn(
                 'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-all duration-200',
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
         {showQuoteNavigation && (
           <Popover>
             <PopoverTrigger asChild>
               <button
                 type="button"
                 className={cn(
                   'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-all duration-200',
                   isQuoteRoute
                     ? 'bg-primary/10 text-primary'
                     : 'text-muted-foreground hover:text-foreground active:scale-95',
                 )}
               >
                 <MoreHorizontal className={cn('h-5 w-5', isQuoteRoute && 'scale-110')} />
                 <span className={cn('text-[10px] font-medium', isQuoteRoute && 'font-semibold')}>Mais</span>
               </button>
             </PopoverTrigger>
             <PopoverContent side="top" align="end" className="w-56 p-1">
               <NavLink to="/comercial/cotacoes" className="flex h-9 items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent">
                 <Clock aria-hidden="true" className="h-4 w-4" />
                 Cotações Abertas
               </NavLink>
               <NavLink to="/comercial/perdidas" className="flex h-9 items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent">
                 <XCircle aria-hidden="true" className="h-4 w-4" />
                 Vendas Perdidas
               </NavLink>
             </PopoverContent>
           </Popover>
         )}
       </div>
     </nav>
   );
 }
