import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpsertAgent, type WhatsappAgent } from '@/hooks/useWhatsappAgents';
import { GroupsManager } from './GroupsManager';
import { SupervisionRules } from './SupervisionRules';
import { AgentHistory } from './AgentHistory';
import { AgentConnection } from './AgentConnection';
import { Sparkles, User, Users, Shield, History, Plug } from 'lucide-react';

interface Props {
  open: boolean;
  agent: WhatsappAgent | null;
  onClose: () => void;
}

const TONES = [
  { v: 'neutro', l: 'Neutro' },
  { v: 'formal', l: 'Formal' },
  { v: 'casual', l: 'Casual' },
  { v: 'amigavel', l: 'Amigável' },
  { v: 'tecnico', l: 'Técnico' },
  { v: 'corporativo', l: 'Corporativo' },
];

export function AgentEditor({ open, agent, onClose }: Props) {
  const upsert = useUpsertAgent();
  const isNew = !agent;

  const [form, setForm] = useState({
    name: '',
    description: '',
    phone_e164: '',
    persona_prompt: '',
    tone: 'neutro',
    supervises_clients: false,
    is_active: true,
  });
  const [tab, setTab] = useState('identity');
  const [savedId, setSavedId] = useState<string | null>(agent?.id ?? null);

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        description: agent.description ?? '',
        phone_e164: agent.phone_e164 ?? '',
        persona_prompt: agent.persona_prompt ?? '',
        tone: agent.tone ?? 'neutro',
        supervises_clients: agent.supervises_clients,
        is_active: agent.is_active,
      });
      setSavedId(agent.id);
    } else {
      setForm({
        name: '', description: '', phone_e164: '', persona_prompt: '',
        tone: 'neutro', supervises_clients: false, is_active: true,
      });
      setSavedId(null);
      setTab('identity');
    }
  }, [agent, open]);

  const handleSave = async () => {
    const result: any = await upsert.mutateAsync({
      id: savedId ?? undefined,
      ...form,
    });
    if (result?.id) setSavedId(result.id);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Novo Agente' : `Editar: ${agent?.name}`}</DialogTitle>
          <DialogDescription>
            Configure identidade, personalidade, departamentos e regras do agente.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="identity"><User className="h-4 w-4 mr-1" />Identidade</TabsTrigger>
            <TabsTrigger value="connection" disabled={!savedId}><Plug className="h-4 w-4 mr-1" />Conexão</TabsTrigger>
            <TabsTrigger value="persona"><Sparkles className="h-4 w-4 mr-1" />Personalidade</TabsTrigger>
            <TabsTrigger value="groups" disabled={!savedId}><Users className="h-4 w-4 mr-1" />Grupos</TabsTrigger>
            <TabsTrigger value="rules" disabled={!savedId}><Shield className="h-4 w-4 mr-1" />Supervisão</TabsTrigger>
            <TabsTrigger value="history" disabled={!savedId}><History className="h-4 w-4 mr-1" />Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="space-y-4 pt-4">
            <div className="grid gap-2">
              <Label>Nome do agente *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Centralizador Vendas"
              />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Para que serve este agente?"
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label>Número WhatsApp do agente</Label>
              <Input
                value={form.phone_e164 || ''}
                placeholder="Será preenchido automaticamente ao conectar"
                readOnly
                className="bg-muted/40"
              />
              <p className="text-xs text-muted-foreground">
                {savedId
                  ? 'Vá até a aba "Conexão" para vincular uma instância da Evolution API e conectar o WhatsApp via QR Code.'
                  : 'Salve o agente primeiro, depois conecte uma instância na aba "Conexão".'}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Agente ativo</Label>
                <p className="text-xs text-muted-foreground">Quando pausado, não distribui mensagens.</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </TabsContent>

          <TabsContent value="persona" className="space-y-4 pt-4">
            <div className="grid gap-2">
              <Label>Tom de voz</Label>
              <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Prompt do agente</Label>
              <Textarea
                value={form.persona_prompt}
                onChange={(e) => setForm({ ...form, persona_prompt: e.target.value })}
                placeholder={`Ex: Você é o assistente centralizador da equipe Vendas.
- Sempre prefixe mensagens com [Nome do autor].
- Roteie assuntos financeiros para o departamento Financeiro.
- Se um cliente está aguardando há mais de 30min, alerte o grupo.`}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Instruções livres que definem comportamento, regras de roteamento e responsabilidades.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="connection" className="pt-4">
            {savedId && agent && <AgentConnection agent={agent} />}
            {savedId && !agent && (
              <p className="text-sm text-muted-foreground">Recarregue para configurar a conexão.</p>
            )}
          </TabsContent>

          <TabsContent value="groups" className="pt-4">
            {savedId && <GroupsManager agentId={savedId} />}
          </TabsContent>

          <TabsContent value="rules" className="pt-4">
            {savedId && (
              <SupervisionRules
                agentId={savedId}
                supervisesClients={form.supervises_clients}
                onToggleSupervises={(v) => {
                  setForm({ ...form, supervises_clients: v });
                  upsert.mutate({ id: savedId, supervises_clients: v });
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            {savedId && <AgentHistory agentId={savedId} />}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {(tab === 'identity' || tab === 'persona') && (
            <Button onClick={handleSave} disabled={!form.name || upsert.isPending}>
              {upsert.isPending ? 'Salvando...' : (savedId ? 'Salvar alterações' : 'Criar agente')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
