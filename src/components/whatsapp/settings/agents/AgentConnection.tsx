import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Plug, Plus, Link as LinkIcon, RefreshCw, QrCode, Power, RotateCw, Unlink,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import {
  useAvailableInstances, useInstanceById, useCreateInstanceForAgent,
  useLinkInstanceToAgent, useUnlinkInstanceFromAgent, useInstanceAction,
  syncAgentPhoneFromInstance,
} from '@/hooks/useAgentInstance';
import type { WhatsappAgent } from '@/hooks/useWhatsappAgents';
import { AgentTestMessage } from './AgentTestMessage';

interface Props {
  agent: WhatsappAgent;
}

export function AgentConnection({ agent }: Props) {
  const [mode, setMode] = useState<'choose' | 'create' | 'link'>('choose');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [form, setForm] = useState({ name: '', instance_name: '', api_url: '', api_key: '' });
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const { data: available = [] } = useAvailableInstances(agent.id);
  const { data: instance } = useInstanceById(agent.instance_id);
  const createInstance = useCreateInstanceForAgent();
  const linkInstance = useLinkInstanceToAgent();
  const unlink = useUnlinkInstanceFromAgent();
  const action = useInstanceAction();

  const pollRef = useRef<number | null>(null);

  // Auto-sync agent phone when instance connects
  useEffect(() => {
    if (instance?.status === 'connected' && instance.phone_e164 && agent.instance_id) {
      if (instance.phone_e164 !== agent.phone_e164) {
        syncAgentPhoneFromInstance(agent.id, agent.instance_id);
      }
    }
  }, [instance?.status, instance?.phone_e164, agent.id, agent.instance_id, agent.phone_e164]);

  // QR polling
  useEffect(() => {
    if (!qrOpen || !agent.instance_id) return;
    setQrError(null);
    const tick = async () => {
      try {
        const res = await action.mutateAsync({ instanceId: agent.instance_id!, action: 'qrcode' });
        if (res?.qrCode) {
          setQrCode(res.qrCode.startsWith('data:') ? res.qrCode : `data:image/png;base64,${res.qrCode}`);
          setQrError(null);
        } else if (res?.state === 'connected' || res?.state === 'open') {
          // Evolution diz que já está conectado mas o banco pode estar dessincronizado
          await action.mutateAsync({ instanceId: agent.instance_id!, action: 'status' });
          setQrOpen(false);
          setQrCode(null);
        } else if (!res?.qrCode && res?.state) {
          setQrError(`A Evolution não retornou QR (state: ${res.state}). Verifique se o instance_name não está duplicado em outra instância.`);
        }
      } catch (e: any) {
        setQrError(e?.message || 'Erro ao buscar QR Code');
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, 4000) as unknown as number;
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrOpen, agent.instance_id]);

  const statusBadge = () => {
    const s = instance?.status || 'disconnected';
    const map: Record<string, { label: string; cls: string; Icon: any }> = {
      connected: { label: 'Conectado', cls: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30', Icon: CheckCircle2 },
      qr_pending: { label: 'Aguardando QR', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', Icon: QrCode },
      connecting: { label: 'Conectando...', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30', Icon: Loader2 },
      disconnected: { label: 'Desconectado', cls: 'bg-muted text-muted-foreground border-border', Icon: AlertCircle },
    };
    const m = map[s] || map.disconnected;
    return (
      <Badge variant="outline" className={`gap-1 ${m.cls}`}>
        <m.Icon className={`h-3 w-3 ${s === 'connecting' ? 'animate-spin' : ''}`} />
        {m.label}
      </Badge>
    );
  };

  // ============ CONNECTED VIEW ============
  if (agent.instance_id && instance) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plug className="h-4 w-4" /> {instance.name}
                </CardTitle>
                <CardDescription>
                  {instance.phone_e164 || 'Aguardando conexão para detectar número'}
                </CardDescription>
              </div>
              {statusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <Label className="text-xs text-muted-foreground">Instance name</Label>
                <p className="font-mono">{instance.instance_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">API URL</Label>
                <p className="font-mono truncate">{instance.api_url}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button size="sm" variant="outline"
                onClick={() => action.mutate({ instanceId: agent.instance_id!, action: 'status' })}
                disabled={action.isPending}>
                <RefreshCw className="h-3 w-3 mr-1" /> Atualizar status
              </Button>
              <Button size="sm"
                onClick={() => { setQrOpen(true); setQrCode(null); }}
                disabled={instance.status === 'connected'}>
                <QrCode className="h-3 w-3 mr-1" />
                {instance.status === 'connected' ? 'Já conectado' : 'Conectar (QR Code)'}
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => action.mutate({ instanceId: agent.instance_id!, action: 'restart' })}
                disabled={action.isPending}>
                <RotateCw className="h-3 w-3 mr-1" /> Reiniciar
              </Button>
              {instance.status === 'connected' && (
                <Button size="sm" variant="outline" className="text-destructive"
                  onClick={() => action.mutate({ instanceId: agent.instance_id!, action: 'disconnect' })}
                  disabled={action.isPending}>
                  <Power className="h-3 w-3 mr-1" /> Desconectar
                </Button>
              )}
            </div>

            <div className="pt-2">
              <Button
                variant="ghost" size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => unlink.mutate(agent.id)}
                disabled={unlink.isPending}
              >
                <Unlink className="h-3 w-3 mr-1" /> Desvincular instância deste agente
              </Button>
            </div>
          </CardContent>
        </Card>

        {instance.status === 'connected' && <AgentTestMessage agent={agent} />}

        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp</DialogTitle>
              <DialogDescription>
                Abra o WhatsApp no celular do agente → Configurações → Aparelhos conectados → Conectar aparelho.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-4 min-h-[300px]">
              {qrCode ? (
                <img src={qrCode} alt="QR Code" className="w-64 h-64 rounded border" />
              ) : qrError ? (
                <div className="flex flex-col items-center gap-2 text-center px-4">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-destructive font-medium">Não foi possível gerar o QR</p>
                  <p className="text-xs text-muted-foreground">{qrError}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Gerando QR Code...</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                A janela fechará automaticamente quando conectar.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ============ NOT CONNECTED — CHOICE VIEW ============
  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center space-y-2">
          <Plug className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Sem instância vinculada</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Este agente precisa de um número WhatsApp dedicado (instância da Evolution API)
            para receber mensagens dos membros e distribuí-las nos grupos.
          </p>
        </CardContent>
      </Card>

      {mode === 'choose' && (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setMode('create')}>
            <Plus className="h-5 w-5" />
            <div className="text-center">
              <div className="font-medium">Criar nova instância</div>
              <div className="text-xs text-muted-foreground">Configurar uma nova conexão Evolution API</div>
            </div>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2"
            onClick={() => setMode('link')}
            disabled={available.length === 0}>
            <LinkIcon className="h-5 w-5" />
            <div className="text-center">
              <div className="font-medium">Vincular existente</div>
              <div className="text-xs text-muted-foreground">
                {available.length} disponíve{available.length === 1 ? 'l' : 'is'}
              </div>
            </div>
          </Button>
        </div>
      )}

      {mode === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova instância Evolution</CardTitle>
            <CardDescription>Preencha os dados da sua Evolution API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label>Nome amigável *</Label>
              <Input placeholder="Ex: WhatsApp Vendas"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Instance name (na Evolution) *</Label>
              <Input placeholder="ex: vendas-001" className="font-mono"
                value={form.instance_name} onChange={(e) => setForm({ ...form, instance_name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>API URL *</Label>
              <Input placeholder="https://evolution.example.com" className="font-mono"
                value={form.api_url} onChange={(e) => setForm({ ...form, api_url: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>API Key *</Label>
              <Input type="password" placeholder="••••••••"
                value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                Será armazenada de forma segura e usada apenas em chamadas servidor→Evolution.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMode('choose')}>Cancelar</Button>
              <Button
                onClick={() => createInstance.mutate({ agent_id: agent.id, ...form }, {
                  onSuccess: () => setMode('choose'),
                })}
                disabled={!form.name || !form.instance_name || !form.api_url || !form.api_key || createInstance.isPending}>
                {createInstance.isPending ? 'Criando...' : 'Criar e vincular'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'link' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vincular instância existente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label>Instância</Label>
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger><SelectValue placeholder="Escolha uma instância..." /></SelectTrigger>
                <SelectContent>
                  {available.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} {i.phone_e164 ? `— ${i.phone_e164}` : '— sem número'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMode('choose')}>Cancelar</Button>
              <Button
                onClick={() => linkInstance.mutate(
                  { agent_id: agent.id, instance_id: selectedInstanceId },
                  { onSuccess: () => setMode('choose') }
                )}
                disabled={!selectedInstanceId || linkInstance.isPending}>
                {linkInstance.isPending ? 'Vinculando...' : 'Vincular'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
