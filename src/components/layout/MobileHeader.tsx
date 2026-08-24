import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
  transparent?: boolean;
  className?: string;
}

export function MobileHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions,
  transparent = false,
  className,
}: MobileHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 safe-area-top transition-all duration-200',
        transparent
          ? 'bg-transparent'
          : 'bg-background/95 backdrop-blur-lg border-b border-border/50',
        className
      )}
    >
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left side */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {showBack && (
            <button
              onClick={handleBack}
              className="flex items-center justify-center h-9 w-9 rounded-full bg-muted/60 active:bg-muted transition-colors shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right side - actions */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

interface MobilePageContainerProps {
  children: ReactNode;
  header?: ReactNode;
  bottomNav?: boolean;
  className?: string;
  noPadding?: boolean;
}

export function MobilePageContainer({
  children,
  header,
  bottomNav = true,
  className,
  noPadding = false,
}: MobilePageContainerProps) {
  return (
    <div className={cn('min-h-screen bg-background flex flex-col', className)}>
      {header}
      <main
        className={cn(
          'flex-1 overflow-y-auto',
          !noPadding && 'p-4',
          bottomNav && 'pb-20'
        )}
      >
        {children}
      </main>
    </div>
  );
}
