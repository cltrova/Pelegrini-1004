import { Outlet } from 'react-router-dom';
import { MobileBottomNav } from './MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileLayoutProps {
  children?: React.ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <>{children || <Outlet />}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      {children || <Outlet />}
      <MobileBottomNav />
    </div>
  );
}
