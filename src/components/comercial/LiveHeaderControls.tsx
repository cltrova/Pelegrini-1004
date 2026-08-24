import { useEffect, useState } from 'react';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LiveHeaderControls() {
  const [now, setNow] = useState(() => new Date());
  const [lastUpdate, setLastUpdate] = useState(() => new Date());
  const [spin, setSpin] = useState(false);
  const qc = useQueryClient();
  const fetching = useIsFetching();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (fetching === 0) setLastUpdate(new Date());
  }, [fetching]);

  const ago = Math.max(0, Math.floor((now.getTime() - lastUpdate.getTime()) / 1000));
  const agoLabel =
    ago < 5 ? 'agora' :
    ago < 60 ? `${ago}s atrás` :
    ago < 3600 ? `${Math.floor(ago / 60)}min atrás` :
    `${Math.floor(ago / 3600)}h atrás`;

  const handleRefresh = () => {
    setSpin(true);
    qc.invalidateQueries();
    setTimeout(() => setSpin(false), 700);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground glass-surface rounded-full px-3 py-1.5">
        <Clock className="h-3 w-3 text-primary" />
        <span className="mono-value font-medium tabular-nums">
          {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span className="opacity-60 px-1">•</span>
        <span className="flex items-center gap-1">
          <span className="pulse-dot" aria-hidden="true" />
          <span className="text-success font-semibold">{agoLabel}</span>
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRefresh}
        disabled={fetching > 0}
        className="h-8 px-3 gap-1.5 hover:border-primary/50 hover:bg-primary/5 transition-all"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', (spin || fetching > 0) && 'spin-once')} />
        <span className="text-xs">Atualizar</span>
      </Button>
    </div>
  );
}
