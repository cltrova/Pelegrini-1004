import { PelegriniHomeExperience } from '@/components/home/PelegriniHomeExperience';
import { useIsMobile } from '@/hooks/use-mobile';

export default function HomePage() {
  const isMobile = useIsMobile();
  return <PelegriniHomeExperience mobile={isMobile} />;
}
