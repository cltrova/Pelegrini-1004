import { cn } from '@/lib/utils';

interface TransmissionFullLogoProps {
  className?: string;
  label?: string;
}

export function TransmissionFullLogo({ className, label = 'Casa da Transmissão' }: TransmissionFullLogoProps) {
  return (
    <img
      src="/brand/home/transmissao-full-white.png"
      alt={label}
      data-transmission-full-logo=""
      className={cn('transmission-full-logo', className)}
    />
  );
}
