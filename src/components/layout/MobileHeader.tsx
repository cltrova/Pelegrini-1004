import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
  className?: string;
}

export function MobileHeader({
  title,
  showBack = false,
  onBack,
  actions,
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
    <>
      <h1 className="sr-only">{title}</h1>
      {(showBack || actions) && (
        <div className={cn('safe-area-top flex shrink-0 flex-wrap items-center gap-2 px-3 py-1', className)}>
          {showBack && (
            <Button type="button" variant="ghost" size="icon" aria-label="Voltar" onClick={handleBack}>
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </Button>
          )}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </>
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
