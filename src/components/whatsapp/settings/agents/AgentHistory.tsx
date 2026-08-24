import { useAgentBroadcasts, useAgentInterventions } from '@/hooks/useWhatsappAgents';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Shield, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AgentHistory({ agentId }: { agentId: string }) {
  const { data: broadcasts = [] } = useAgentBroadcasts(agentId);
  const { data: interventions = [] } = useAgentInterventions(agentId);

  const items = [
    ...broadcasts.map((b: any) => ({ kind: 'broadcast' as const, ...b })),
    ...interventions.map((i: any) => ({ kind: 'intervention' as const, ...i })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (items.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <Clock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>
        <p className="text-xs text-muted-foreground">
          Broadcasts e intervenções aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {items.map((item) => (
        <Card key={`${item.kind}-${item.id}`}>
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className={`rounded-full p-2 ${item.kind === 'broadcast' ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
                {item.kind === 'broadcast'
                  ? <MessageSquare className="h-4 w-4 text-primary" />
                  : <Shield className="h-4 w-4 text-amber-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {item.kind === 'broadcast' ? 'Broadcast' : 'Intervenção'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { locale: ptBR, addSuffix: true })}
                  </span>
                </div>
                {item.kind === 'broadcast' ? (
                  <>
                    <p className="text-sm mt-1">
                      <span className="font-medium">{(item as any).source_name || (item as any).source_phone || '—'}</span>
                      {' → '}
                      <span className="text-muted-foreground">
                        {(((item as any).delivered_to as any[])?.length ?? 0)} destinatário(s)
                      </span>
                    </p>
                    {(item as any).content && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{(item as any).content}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm mt-1 font-medium">{(item as any).rule_triggered}</p>
                    {(item as any).action_taken && (
                      <p className="text-xs text-muted-foreground">{(item as any).action_taken}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
