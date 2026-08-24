import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, BarChart3, Bot, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  match?: string[];
}

const navItems: NavItem[] = [
  { icon: MessageSquare, label: 'Conversas', path: '/whatsapp', match: ['/whatsapp'] },
  { icon: BarChart3, label: 'Relatórios', path: '/whatsapp/relatorio', match: ['/whatsapp/relatorio'] },
  { icon: Bot, label: 'Agentes', path: '/whatsapp/agentes', match: ['/whatsapp/agentes'] },
  { icon: Settings, label: 'Config', path: '/whatsapp/settings', match: ['/whatsapp/settings'] },
];

export function WhatsappMobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (item: NavItem) => {
    if (item.match) {
      return item.match.some(m => location.pathname === m);
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
