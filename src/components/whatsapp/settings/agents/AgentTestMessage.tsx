import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, CheckCircle2, AlertCircle, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  useAgentGroups, useAgentGroupMembers,
} from '@/hooks/useWhatsappAgents';
import type { WhatsappAgent } from '@/hooks/useWhatsappAgents';

interface Props {
  agent: WhatsappAgent;
}

interface TestResult {
  success: boolean;
  results?: Array<{
    group_id: string;
    delivered: Array<{ phone: string; ok: boolean; status?: number; error?: string }>;
  }>;
  routing?: { method: 'mention' | 'llm' | 'broadcast' | 'fallback' | 'forced'; target?: string; confidence?: number; reason?: string };
  error?: string;
  skipped?: boolean;
  reason?: string;
}

export function AgentTestMessage({ agent }: Props) {
  const { toast } = useToast();
  const { data: groups = [] } = useAgentGroups(agent.id);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const { data: members = [] } = useAgentGroupMembers(selectedGroupId);
  const [senderPhone, setSenderPhone] = useState('');
  const [senderName, setSenderName] = useState('Teste');
  const [content, setContent] = useState('🧪 Mensagem de teste do agente. Se você recebeu isto, o roteamento está funcionando!');
  const [includeSender, setIncludeSender] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);

  const selectedGroup = useMemo(() => groups.find((g) => g.id === selectedGroupId), [groups, selectedGroupId]);

  const handlePickMember = (phone: string) => {
    const m = members.find((x) => x.phone_e164 === phone);
    setSenderPhone(phone);
    if (m?.display_name) setSenderName(m.display_name);
  };

  const handleSend = async () => {
    if (!selectedGroupId || !senderPhone || !content.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setSending(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('agent-router', {
        body: {
          agent_id: agent.id,
          source_phone_e164: senderPhone,
          source_name: senderName || undefined,
          content,
          message_type: 'text',
          triggered_by: 'internal_chat',
          target_group_id: selectedGroupId, // força entrega no grupo escolhido
          include_sender: includeSender,
        },
      });
      if (error) throw error;
      setLastResult(data as TestResult);
      if ((data as any)?.success) {
        toast({ title: 'Mensagem de teste enviada', description: 'Verifique o WhatsApp dos membros do grupo.' });
      } else if ((data as any)?.skipped) {
        toast({ title: 'Roteamento ignorado', description: (data as any).reason, variant: 'destructive' });
      } else if ((data as any)?.error) {
        toast({ title: 'Erro no envio', description: (data as any).error, variant: 'destructive' });
      }
    } catch (e: any) {
      setLastResult({ success: false, error: e.message });
      toast({ title: 'Falha ao testar', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const totalDelivered = lastResult?.results?.reduce(
    (acc, r) => acc + r.delivered.filter((d) => d.ok).length, 0,
  ) ?? 0;
  const totalAttempts = lastResult?.results?.reduce(
    (acc, r) => acc + r.delivered.length, 0,
  ) ?? 0;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          Teste de roteamento
        </CardTitle>
        <CardDescription>
          Simule uma mensagem chegando no número do agente. Use <code className="px-1 py-0.5 rounded bg-muted text-foreground">@nome</code> de pessoa ou grupo para direcionar — sem menção, a IA decide o destino automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            Crie ao menos um grupo na aba "Grupos" antes de testar.
          </div>
        ) : (
          <>
            <div className="grid gap-2">
              <Label>Grupo de destino</Label>
              <Select value={selectedGroupId} onValueChange={(v) => { setSelectedGroupId(v); setSenderPhone(''); }}>
                <SelectTrigger><SelectValue placeholder="Escolha o grupo..." /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Remetente (telefone)</Label>
                {members.length > 0 ? (
                  <Select value={senderPhone} onValueChange={handlePickMember}>
                    <SelectTrigger><SelectValue placeholder="Escolha um membro..." /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.phone_e164}>
                          {m.phone_e164}{m.display_name ? ` — ${m.display_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="+5511999999999"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    className="font-mono"
                  />
                )}
              </div>
              <div className="grid gap-2">
                <Label>Nome do remetente</Label>
                <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Mensagem</Label>
              <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSender}
                onChange={(e) => setIncludeSender(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              Incluir o próprio remetente na entrega (útil para testes com 1 membro só)
            </label>

            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                {selectedGroup
                  ? includeSender
                    ? `Será entregue a ${members.length} membro(s) do grupo "${selectedGroup.name}" (incluindo o remetente).`
                    : `Será entregue a ${Math.max(0, members.length - 1)} membro(s) do grupo "${selectedGroup.name}" (exceto o remetente).`
                  : 'Selecione um grupo.'}
              </p>
              <Button onClick={handleSend} disabled={sending || !selectedGroupId || !senderPhone || !content.trim()}>
                {sending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enviando...</>
                         : <><Send className="h-4 w-4 mr-1" />Enviar teste</>}
              </Button>
            </div>

            {lastResult && (
              <div className="mt-3 p-3 rounded-lg border bg-muted/30 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {lastResult.success ? (
                    <Badge className="gap-1 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" variant="outline">
                      <CheckCircle2 className="h-3 w-3" /> {totalDelivered}/{totalAttempts} entregues
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 bg-destructive/15 text-destructive border-destructive/30">
                      <AlertCircle className="h-3 w-3" /> Falhou
                    </Badge>
                  )}
                  {lastResult.routing && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      Roteamento: <span className="font-mono">{lastResult.routing.method}</span>
                      {lastResult.routing.target ? ` → ${lastResult.routing.target}` : ''}
                      {typeof lastResult.routing.confidence === 'number' ? ` (${Math.round(lastResult.routing.confidence * 100)}%)` : ''}
                    </Badge>
                  )}
                </div>
                {lastResult.error && (
                  <p className="text-xs text-destructive">{lastResult.error}</p>
                )}
                {lastResult.skipped && (
                  <p className="text-xs text-amber-600">
                    Roteamento ignorado: {lastResult.reason}
                  </p>
                )}
                {lastResult.results?.map((r) => (
                  <div key={r.group_id} className="space-y-1">
                    {r.delivered.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-mono">
                        <span>{d.phone}</span>
                        {d.ok
                          ? <span className="text-green-600">✓ {d.status}</span>
                          : <span className="text-destructive">✗ {d.error || d.status}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
