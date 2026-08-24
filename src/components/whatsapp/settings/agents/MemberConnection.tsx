import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Smartphone, QrCode, CheckCircle2, AlertCircle, Loader2, Plug, RefreshCw,
} from 'lucide-react';
import {
  useMemberInstanceByPhone, useCreateInstanceForMember,
} from '@/hooks/useMemberInstance';
import { useInstanceAction } from '@/hooks/useAgentInstance';

interface Props {
  phoneE164: string;
  displayName?: string | null;
}

export function MemberConnection({ phoneE164, displayName }: Props) {
  const { data: instance, refetch } = useMemberInstanceByPhone(phoneE164);
  const create = useCreateInstanceForMember();
  const action = useInstanceAction();

  const [createOpen, setCreateOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Pré-preenche valores convenientes para o vendedor
  const safeSlug = (displayName || phoneE164)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  const [form, setForm] = useState({
    name: displayName || phoneE164,
    instance_name: safeSlug || `vendedor_${phoneE164.replace(/\D/g, '')}`,
    api_url: '',
    api_key: '',
  });

  // QR polling
  useEffect(() => {
    if (!qrOpen || !instance?.id) return;
    setQrError(null);
    const tick = async () => {
      try {
        const res = await action.mutateAsync({ instanceId: instance.id, action: 'qrcode' });
        if (res?.qrCode) {
          setQrCode(res.qrCode.startsWith('data:') ? res.qrCode : `data:image/png;base64,${res.qrCode}`);
          setQrError(null);
        } else if (res?.state === 'connected' || res?.state === 'open') {
          await action.mutateAsync({ instanceId: instance.id, action: 'status' });
          await refetch();
          setQrOpen(false);
          setQrCode(null);
        } else if (!res?.qrCode && res?.state) {
          setQrError(`A Evolution não retornou QR (state: ${res.state}).`);
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
  }, [qrOpen, instance?.id]);

  // ============ STATUS BADGE ============
  if (instance) {
    const s = instance.status || 'disconnected';
    const map: Record<string, { label: string; cls: string; Icon: any }> = {
      connected: {
        label: 'Conectado',
        cls: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
        Icon: CheckCircle2,
      },
      qr_pending: {
        label: 'Aguardando QR',
        cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
        Icon: QrCode,
      },
      connecting: {
        label: 'Conectando',
        cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
        Icon: Loader2,
      },
      disconnected: {
        label: 'Desconectado',
        cls: 'bg-muted text-muted-foreground border-border',
        Icon: AlertCircle,
      },
    };
    const m = map[s] || map.disconnected;

    return (
      <>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className={`gap-1 text-[10px] py-0 ${m.cls}`}>
            <m.Icon className={`h-2.5 w-2.5 ${s === 'connecting' ? 'animate-spin' : ''}`} />
            {m.label}
          </Badge>
          {s !== 'connected' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => { setQrOpen(true); setQrCode(null); }}
            >
              <QrCode className="h-3 w-3 mr-1" /> QR
            </Button>
          )}
          {s === 'connected' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => action.mutate({ instanceId: instance.id, action: 'status' })}
              disabled={action.isPending}
              title="Atualizar status"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* QR Dialog */}
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp de {displayName || phoneE164}</DialogTitle>
              <DialogDescription>
                No celular do vendedor: WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho.
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
      </>
    );
  }

  // ============ SEM INSTÂNCIA — botão criar ============
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs gap-1"
        onClick={() => setCreateOpen(true)}
      >
        <Smartphone className="h-3 w-3" />
        Conectar WhatsApp
      </Button>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp do vendedor</DialogTitle>
            <DialogDescription>
              Crie uma instância da Evolution API para <strong>{displayName || phoneE164}</strong>.
              Depois você gera o QR Code para o vendedor escanear no celular dele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Nome amigável</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Instance name (único na Evolution) *</Label>
              <Input
                className="font-mono text-sm"
                value={form.instance_name}
                onChange={(e) => setForm({ ...form, instance_name: e.target.value })}
                placeholder="ex: joao_vendas"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">API URL *</Label>
              <Input
                className="font-mono text-sm"
                value={form.api_url}
                onChange={(e) => setForm({ ...form, api_url: e.target.value })}
                placeholder="https://evolution.example.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">API Key *</Label>
              <Input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Plug className="h-3 w-3 mt-0.5 shrink-0" />
              O número <strong>{phoneE164}</strong> será associado a esta instância automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={() =>
                create.mutate(
                  { phone_e164: phoneE164, display_name: displayName || undefined, ...form },
                  {
                    onSuccess: async () => {
                      setCreateOpen(false);
                      await refetch();
                      setQrOpen(true);
                      setQrCode(null);
                    },
                  }
                )
              }
              disabled={
                !form.name || !form.instance_name || !form.api_url || !form.api_key || create.isPending
              }
            >
              {create.isPending ? 'Criando...' : 'Criar e conectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
