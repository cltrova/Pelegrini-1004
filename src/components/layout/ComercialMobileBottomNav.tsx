 import { NavLink, useLocation, useNavigate } from 'react-router-dom';
 import { LayoutDashboard, Calendar, Users, Home, Clock, MoreHorizontal, XCircle, ClipboardList } from 'lucide-react';
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
 import { ThemeToggle } from '@/components/common/ThemeToggle';
 import { cn } from '@/lib/utils';
 import { useAuth } from '@/contexts/AuthContext';
 import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
 import { filialPermiteRelatoriosVisitas } from '@/utils/acessoRelatoriosVisitas';
 
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
   const { isMaster, isGerencial } = useAuth();
   const { filialAtiva, carregandoFilial } = useFilialSelecionada();
   const showQuoteNavigation = codEmpresaAtiva === '1004' || codEmpresaAtiva === '10041';
   const mostrarRelatoriosVisitas = !carregandoFilial && (isMaster || isGerencial)
     && filialPermiteRelatoriosVisitas(codEmpresaAtiva, filialAtiva);
   const rotaDoMenuMais = location.pathname === '/comercial/cotacoes'
     || location.pathname === '/comercial/perdidas'
     || (mostrarRelatoriosVisitas && location.pathname === '/comercial/visitas');
 
   const isActive = (item: NavItem) => {
     if (item.match) {
       return item.match.some(path => location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`)));
     }
     return location.pathname === item.path;
   };
 
   return (
    <nav
      aria-label="Navegacao comercial mobile"
      className="commercial-mobile-navigation z-50 shrink-0 border-t border-border bg-card safe-area-bottom"
    >
       <div className="flex h-16 items-center justify-around px-2">
         {navItems.map((item) => {
           const active = isActive(item);
           return (
             <button
               key={item.path}
               aria-current={active ? 'page' : undefined}
               onClick={() => navigate(item.path)}
               className={cn(
                 'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-sm px-1 py-2 transition-colors duration-150',
                 active 
                   ? 'text-primary bg-primary/10' 
                   : 'text-muted-foreground hover:text-foreground'
               )}
             >
               <item.icon className="h-5 w-5" />
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
                   'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-sm px-1 py-2 transition-colors duration-150',
                   rotaDoMenuMais
                     ? 'bg-primary/10 text-primary'
                     : 'text-muted-foreground hover:text-foreground',
                 )}
               >
                 <MoreHorizontal className="h-5 w-5" />
                 <span className={cn('text-[10px] font-medium', rotaDoMenuMais && 'font-semibold')}>Mais</span>
               </button>
             </PopoverTrigger>
             <PopoverContent side="top" align="end" className="commercial-overlay w-56 p-1">
               <NavLink to="/comercial/cotacoes" className="flex h-11 items-center gap-2 rounded-sm px-2 text-sm hover:bg-primary/10">
                 <Clock aria-hidden="true" className="h-4 w-4" />
                 Cotações Abertas
               </NavLink>
               <NavLink to="/comercial/perdidas" className="flex h-11 items-center gap-2 rounded-sm px-2 text-sm hover:bg-primary/10">
                 <XCircle aria-hidden="true" className="h-4 w-4" />
                 Vendas Perdidas
               </NavLink>
               {mostrarRelatoriosVisitas && (
                 <NavLink to="/comercial/visitas" className="flex h-11 items-center gap-2 rounded-sm px-2 text-sm hover:bg-primary/10">
                   <ClipboardList aria-hidden="true" className="h-4 w-4" />
                   Relatórios de visitas
                 </NavLink>
               )}
             </PopoverContent>
           </Popover>
         )}
         <div className="flex h-14 shrink-0 items-center justify-center px-0.5">
           <ThemeToggle />
         </div>
       </div>
     </nav>
   );
 }
