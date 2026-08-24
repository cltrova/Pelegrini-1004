import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Shield, AlertCircle } from 'lucide-react';
import { useAgentGroups, useUpsertAgent, useWhatsappAgents } from '@/hooks/useWhatsappAgents';

interface Rule {
  id: string;
  type: 'no_response' | 'negative_sentiment' | 'keyword' | 'unassigned';
  // for no_response
  minutes?: number;
  // for keyword
  keywords?: string[];
  // route to
  target_group_id: string;
  message_template?: string;
}

interface Props {
  agentId: string;
  supervisesClients: boolean;
  onToggleSupervises: (v: boolean) => void;
}

export function SupervisionRules({ agentId, supervisesClients, onToggleSupervises }: Props) {
  const { data: agents = [] } = useWhatsappAgents();
  const { data: groups = [] } = useAgentGroups(agentId);
  const upsert = useUpsertAgent();

  const agent = agents.find(a => a.id === agentId);
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    if (agent?.rules && Array.isArray(agent.rules)) {
      setRules(agent.rules as Rule[]);
    }
  }, [agent?.id]);

  const saveRules = (next: Rule[]) => {
    setRules(next);
    upsert.mutate({ id: agentId, rules: next as any });
  };

  const addRule = () => {
    saveRules([
      ...rules,
      {
        id: crypto.randomUUID(),
        type: 'no_response',
        minutes: 30,
        target_group_id: groups[0]?.id ?? '',
      },
    ]);
  };

  const updateRule = (id: string, patch: Partial<Rule>) => {
    saveRules(rules.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const removeRule = (id: string) => saveRules(rules.filter(r => r.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <Label className="text-base">Supervisionar conversas com clientes</Label>
            <p className="text-xs text-muted-foreground">
              O agente monitora conversas e dispara alertas conforme as regras abaixo.
            </p>
          </div>
        </div>
        <Switch checked={supervisesClients} onCheckedChange={onToggleSupervises} />
      </div>

      {!supervisesClients && (
        <div className="flex gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          Ative a supervisão para criar regras automáticas (tempo sem resposta, sentimento negativo, palavras-chave).
        </div>
      )}

      {supervisesClients && (
        <>
          {groups.length === 0 && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              Crie ao menos um grupo na aba "Grupos" para poder rotear alertas.
            </div>
          )}

          <div className="space-y-2">
            {rules.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Select value={r.type} onValueChange={(v) => updateRule(r.id, { type: v as any })}>
                      <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_response">Cliente sem resposta há</SelectItem>
                        <SelectItem value="negative_sentiment">Sentimento negativo detectado</SelectItem>
                        <SelectItem value="keyword">Mensagem contém palavras-chave</SelectItem>
                        <SelectItem value="unassigned">Conversa sem atendente atribuído</SelectItem>
                      </SelectContent>
                    </Select>

                    {r.type === 'no_response' && (
                      <>
                        <Input
                          type="number"
                          className="w-24"
                          value={r.minutes ?? 30}
                          onChange={(e) => updateRule(r.id, { minutes: Number(e.target.value) })}
                        />
                        <span className="text-sm text-muted-foreground">minutos</span>
                      </>
                    )}

                    {r.type === 'keyword' && (
                      <Input
                        placeholder="urgente, reclamação, cancelar"
                        value={(r.keywords ?? []).join(', ')}
                        onChange={(e) => updateRule(r.id, {
                          keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                        })}
                      />
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-destructive"
                      onClick={() => removeRule(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">Notificar grupo:</span>
                    <Select
                      value={r.target_group_id}
                      onValueChange={(v) => updateRule(r.id, { target_group_id: v })}
                    >
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                      <SelectContent>
                        {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={addRule} disabled={groups.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar regra
          </Button>
        </>
      )}
    </div>
  );
}
