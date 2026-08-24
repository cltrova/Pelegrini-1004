import { useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Inbox, Paperclip, Send, CheckCircle2, AlertCircle, MessageSquare, User as UserIcon, Phone,
  ArrowRight, Bot, Filter,
} from 'lucide-react';
import { useCobrancaIntervencoes, CobrancaIntervencao } from '@/hooks/useCobrancaIntervencoes';
import { formatCurrency } from '@/utils/formatters';

const TIPO_LABEL: Record<string, string> = {
  pix: 'Gerar Pix',
  boleto: 'Enviar boleto',
  segunda_via: '2ª via',
  negociacao: 'Negociação',
  comprovante: 'Comprovante recebido',
  outro: 'Outro',
};

const TIPO_COLOR: Record<string, string> = {
  pix: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  boleto: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  segunda_via: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  negociacao: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  comprovante: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  outro: 'bg-muted text-foreground border-border',
};

const PRI_COLOR: Record<string, string> = {
  alta: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  normal: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  baixa: 'bg-muted text-muted-foreground border-border',
};

const STATUS_COLOR: Record<string, string> = {
  pendente: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  respondido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  resolvido: 'bg-muted text-muted-foreground border-border',
  cancelado: 'bg-muted text-muted-foreground border-border line-through',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function AcompanhamentoTab() {
  const { intervencoes, pendentes, isLoading, respond, uploadAttachment } = useCobrancaIntervencoes();
  const [filter, setFilter] = useState<'pendente' | 'todos'>('pendente');
  const [open, setOpen] = useState<CobrancaIntervencao | null>(null);
  const [msg, setMsg] = useState('');
  const [attachment, setAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    return filter === 'pendente' ? intervencoes.filter(i => i.status === 'pendente') : intervencoes;
  }, [intervencoes, filter]);

  const counts = useMemo(() => ({
    pendentes: intervencoes.filter(i => i.status === 'pendente').length,
    respondidos: intervencoes.filter(i => i.status === 'respondido').length,
    resolvidos: intervencoes.filter(i => i.status === 'resolvido').length,
    alta: intervencoes.filter(i => i.status === 'pendente' && i.prioridade === 'alta').length,
  }), [intervencoes]);

  const openItem = (it: CobrancaIntervencao) => {
    setOpen(it);
    setMsg(suggestedMessage(it));
    setAttachment(null);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const r = await uploadAttachment(file);
      setAttachment({ url: r.url, type: r.type, name: file.name });
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (markResolved: boolean) => {
    if (!open) return;
    await respond.mutateAsync({
      intervencao_id: open.id,
      message: msg || undefined,
      attachment_url: attachment?.url,
      attachment_type: attachment?.type,
      mark_resolved: markResolved,
    });
    setOpen(null);
  };

  const handleClose = async () => {
    if (!open) return;
    await respond.mutateAsync({ intervencao_id: open.id, mark_resolved: true });
    setOpen(null);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-indigo-500/5 to-sky-500/5 border-indigo-500/20">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <Inbox className="size-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Central de acompanhamento</h3>
            <p className="text-sm text-muted-foreground">
              O agente identifica solicitações dos clientes (Pix, boleto, comprovante…) e abre uma ação aqui. Você responde com o código/anexo e o agente devolve a mensagem ao cliente automaticamente.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Pendentes" value={counts.pendentes} accent="text-amber-500" icon={<AlertCircle className="size-4" />} />
        <SummaryCard label="Alta prioridade" value={counts.alta} accent="text-rose-500" icon={<AlertCircle className="size-4" />} />
        <SummaryCard label="Respondidas" value={counts.respondidos} accent="text-emerald-500" icon={<CheckCircle2 className="size-4" />} />
        <SummaryCard label="Resolvidas" value={counts.resolvidos} accent="text-sky-500" icon={<CheckCircle2 className="size-4" />} />
      </div>

      <div className="flex items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        <Button size="sm" variant={filter === 'pendente' ? 'default' : 'outline'} onClick={() => setFilter('pendente')}>
          Pendentes ({pendentes.length})
        </Button>
        <Button size="sm" variant={filter === 'todos' ? 'default' : 'outline'} onClick={() => setFilter('todos')}>
          Todas
        </Button>
      </div>

      {isLoading ? (
        <div className="h-32 rounded-lg bg-muted animate-pulse" />
      ) : list.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Bot className="size-10 mx-auto mb-2 opacity-50" />
          Nenhuma solicitação no momento. O agente está monitorando as conversas.
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((it) => (
            <Card
              key={it.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openItem(it)}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={TIPO_COLOR[it.tipo] || TIPO_COLOR.outro}>
                    {TIPO_LABEL[it.tipo] || it.tipo}
                  </Badge>
                  <Badge variant="outline" className={PRI_COLOR[it.prioridade]}>{it.prioridade}</Badge>
                  <Badge variant="outline" className={STATUS_COLOR[it.status]}>{it.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground ml-auto">{fmtDate(it.created_at)}</div>
              </div>

              <div className="mt-3 grid md:grid-cols-[1fr_auto] gap-3 items-center">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <UserIcon className="size-4 text-muted-foreground" />
                    {it.cliente_nome || 'Cliente'}
                    {it.contact_phone && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Phone className="size-3" /> {it.contact_phone}
                      </span>
                    )}
                  </div>
                  {it.pedido_numero && (
                    <div className="text-xs text-muted-foreground mt-1">Pedido #{it.pedido_numero}</div>
                  )}
                  {typeof it.valor === 'number' && (
                    <div className="text-xs text-muted-foreground">Valor: {formatCurrency(it.valor)}</div>
                  )}
                  <p className="text-sm mt-2">{it.agent_summary}</p>
                  {it.ultima_mensagem_cliente && (
                    <div className="mt-2 text-xs italic text-muted-foreground border-l-2 border-border pl-2">
                      "{it.ultima_mensagem_cliente}"
                    </div>
                  )}
                </div>
                <Button size="sm" variant="default">
                  <ArrowRight className="size-4" /> Atender
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="size-5 text-sky-500" />
              {open ? (TIPO_LABEL[open.tipo] || open.tipo) : ''} — {open?.cliente_nome}
            </DialogTitle>
            <DialogDescription>
              Responda com a mensagem e/ou anexo. O agente envia ao cliente pela instância WhatsApp da empresa.
            </DialogDescription>
          </DialogHeader>

          {open && (
            <div className="space-y-4">
              {/* pipeline */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <PipelineStep active label="Cliente solicitou" />
                <ArrowRight className="size-3 text-muted-foreground" />
                <PipelineStep active label="Agente identificou" />
                <ArrowRight className="size-3 text-muted-foreground" />
                <PipelineStep active label="Sua resposta" />
                <ArrowRight className="size-3 text-muted-foreground" />
                <PipelineStep label="Enviada ao cliente" />
              </div>

              <Card className="p-3 bg-muted/30">
                <div className="text-xs uppercase text-muted-foreground mb-1">Resumo do agente</div>
                <p className="text-sm">{open.agent_summary}</p>
                {open.ultima_mensagem_cliente && (
                  <div className="mt-2 text-xs italic text-muted-foreground">
                    Última mensagem do cliente: "{open.ultima_mensagem_cliente}"
                  </div>
                )}
              </Card>

              <div>
                <label className="text-sm font-medium">Mensagem para o cliente</label>
                <Textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  rows={5}
                  placeholder={
                    open.tipo === 'pix'
                      ? 'Cole aqui o código Pix copia-e-cola ou anexe o QR Code abaixo.'
                      : 'Escreva a resposta para o cliente…'
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Paperclip className="size-4" /> {uploading ? 'Enviando…' : 'Anexar QR / boleto'}
                </Button>
                {attachment && (
                  <span className="text-xs text-muted-foreground truncate max-w-[260px]">📎 {attachment.name}</span>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={respond.isPending}>
              Marcar como resolvido
            </Button>
            <Button variant="outline" onClick={() => handleSend(false)} disabled={respond.isPending || (!msg && !attachment)}>
              <Send className="size-4" /> Enviar
            </Button>
            <Button onClick={() => handleSend(true)} disabled={respond.isPending || (!msg && !attachment)}>
              <CheckCircle2 className="size-4" /> Enviar e resolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: React.ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between text-muted-foreground text-xs uppercase">
        <span>{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}

function PipelineStep({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className={`flex-1 text-center py-1.5 rounded border ${active ? 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300' : 'bg-muted/30 border-border text-muted-foreground'}`}>
      {label}
    </div>
  );
}

function suggestedMessage(it: CobrancaIntervencao): string {
  const nome = (it.cliente_nome || 'cliente').split(' ')[0];
  switch (it.tipo) {
    case 'pix':
      return `Olá ${nome}! Segue abaixo o código Pix para pagamento:\n\n[COLE O CÓDIGO AQUI]\n\nApós o pagamento, nosso sistema confirma automaticamente. Qualquer dúvida estou à disposição. 🙏`;
    case 'boleto':
      return `Olá ${nome}! Segue em anexo o boleto solicitado. Caso prefira o link, é só responder. 🙌`;
    case 'segunda_via':
      return `Olá ${nome}! Segue em anexo a 2ª via do documento solicitado.`;
    case 'comprovante':
      return `Olá ${nome}! Recebemos seu comprovante, obrigado! Vamos confirmar a baixa e te aviso por aqui. ✅`;
    case 'negociacao':
      return `Olá ${nome}! Recebi sua mensagem sobre negociação. Posso te oferecer as seguintes condições: [DESCREVA]. Faz sentido pra você?`;
    default:
      return `Olá ${nome}!`;
  }
}
