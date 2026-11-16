import type { ReactNode } from 'react';
import { FilialBadge } from '@/components/common/FilialBadge';

interface HeaderProps {
  title: string;
  actions?: ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-2">
        <FilialBadge />
        {actions}
      </div>
    </>
  );
}
