import { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { PremiumSectionCard } from './PremiumSectionCard';
import { Premium1004Tone } from './tokens1004';

interface PremiumChartContainerProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: Premium1004Tone;
  action?: ReactNode;
  height?: string; // classes tailwind, ex.: "h-64 md:h-72"
  className?: string;
  children: ReactNode; // conteúdo Recharts (será embrulhado em ResponsiveContainer)
}

/**
 * Container padrão para gráficos do Comercial 1004.
 * Garante header consistente, altura responsiva e ResponsiveContainer
 * padronizados em todas as abas.
 */
export function PremiumChartContainer({
  title,
  subtitle,
  icon,
  tone = 'azul',
  action,
  height = 'h-64 md:h-72',
  className,
  children,
}: PremiumChartContainerProps) {
  return (
    <PremiumSectionCard
      title={title}
      subtitle={subtitle}
      icon={icon}
      tone={tone}
      action={action}
      className={className}
    >
      <div className={cn('w-full', height)}>
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </PremiumSectionCard>
  );
}
