import { useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FilialBadge } from '@/components/common/FilialBadge';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Visão geral do sistema' },
  '/financeiro/dre': { title: 'DRE', subtitle: 'Demonstração do Resultado do Exercício' },
  '/financeiro/variacao': { title: 'Variação', subtitle: 'Análise de variações entre períodos' },
  '/configuracoes': { title: 'Configurações', subtitle: 'Configurações do sistema' },
};

interface HeaderProps {
  showSearch?: boolean;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

export function Header({
  showSearch = false,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  actions,
}: HeaderProps) {
  const location = useLocation();
  const pageInfo = pageTitles[location.pathname] || {
    title: 'Página',
    subtitle: '',
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title */}
        <div>
          <h1 className="page-title">{pageInfo.title}</h1>
          {pageInfo.subtitle && (
            <p className="page-subtitle">{pageInfo.subtitle}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-9 w-64"
                onChange={(e) => onSearchChange?.(e.target.value)}
              />
            </div>
          )}

          <FilialBadge />

          {actions}

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
          </Button>
        </div>
      </div>
    </header>
  );
}
