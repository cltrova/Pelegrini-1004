import { useLocation, useNavigate } from 'react-router-dom';
import { Home, TrendingUp, BarChart3, ChevronLeft, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  match?: string[];
  requiresAuth?: boolean;
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: 'Início', path: '/', match: ['/'] },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const isActive = (item: NavItem) => {
    if (item.match) {
      return item.match.some(m => location.pathname === m);
    }
    return location.pathname === item.path;
  };

  // Filter items based on auth state
  const visibleItems = isAuthenticated 
    ? mainNavItems 
    : mainNavItems.filter(item => !item.requiresAuth);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {visibleItems.map((item) => {
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

interface MobileBackButtonProps {
  onBack?: () => void;
}

export function MobileBackButton({ onBack }: MobileBackButtonProps) {
  const navigate = useNavigate();
  
  return (
    <button
      onClick={onBack || (() => navigate(-1))}
      className="flex items-center justify-center h-10 w-10 rounded-full bg-muted/50 active:bg-muted transition-colors"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}
