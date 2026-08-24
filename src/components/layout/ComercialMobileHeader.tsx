 import { ShoppingCart, Bell, User } from 'lucide-react';
 import { useAuth } from '@/contexts/AuthContext';
 import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
 import { ThemeToggle } from '@/components/common/ThemeToggle';
 
 interface ComercialMobileHeaderProps {
   title?: string;
   subtitle?: string;
 }
 
 export function ComercialMobileHeader({ title = 'Comercial', subtitle }: ComercialMobileHeaderProps) {
   const { user } = useAuth();
   const { empresa } = useEmpresaAtiva();
 
   return (
     <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border safe-area-top">
       <div className="flex items-center justify-between px-4 py-3">
         {/* Logo e Título */}
         <div className="flex items-center gap-3">
           <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg">
             <ShoppingCart className="h-5 w-5 text-white" />
           </div>
           <div>
             <h1 className="font-bold text-lg leading-tight">{title}</h1>
             <span className="text-xs text-muted-foreground">
               {subtitle || empresa?.nome || 'Módulo Comercial'}
             </span>
           </div>
         </div>
 
         {/* Ações */}
         <div className="flex items-center gap-2">
           <ThemeToggle />
           <button className="relative p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors">
             <Bell className="h-5 w-5 text-muted-foreground" />
             <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
               3
             </span>
           </button>
           <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
             <User className="h-5 w-5 text-primary" />
           </div>
         </div>
       </div>
     </header>
   );
 }