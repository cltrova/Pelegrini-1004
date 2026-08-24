import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Send, Save, Phone, Bot, AlertTriangle, Calendar, MessageSquare, Sparkles, RefreshCw, User } from 'lucide-react';
import { DuplicataAgregada } from '@/types/resumo';
import { formatCurrency } from '@/utils/formatters';
import {
  useCobrancaConfig, useCobrancaTelefones, useEnviarCobranca, CobrancaConfig,
} from '@/hooks/useCobrancaAgente';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  duplicatas: DuplicataAgregada[];
}

type Gatilho = 'd3' | 'd1' | 'd0' | 'atrasado';

function fmtBR(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function classifyGatilho(d: DuplicataAgregada): Gatilho | null {
  if (d.status === 'PAGO') return null;
  if (d.situacao === 'vencida') return 'atrasado';
  if (d.situacao === 'vence_hoje') return 'd0';
  if (!d.dataVencimento) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(d.dataVencimento); venc.setHours(0, 0, 0, 0);
  const dias = Math.round((venc.getTime() - hoje.getTime()) / 86400000);
  if (dias === 1) return 'd1';
  if (dias === 3) return 'd3';
  return null;
}

function renderTemplate(tpl: string, d: DuplicataAgregada, rodape: string): string {
  const out = tpl
    .replace(/\{cliente\}/g, d.cliente || 'cliente')
    .replace(/\{valor\}/g, formatCurrency(d.valor))
    .replace(/\{vencimento\}/g, fmtBR(d.dataVencimento))
    .replace(/\{dias_atraso\}/g, String(d.diasAtraso || 0));
  return rodape ? `${out}\n\n${rodape}` : out;
}

const GATILHO_LABEL: Record<Gatilho, string> = {
  d3: 'Vence em 3 dias',
  d1: 'Vence amanhã',
  d0: 'Vence hoje',
  atrasado: 'Atrasado',
};

const GATILHO_COLOR: Record<Gatilho, string> = {
  d3: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  d1: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  d0: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  atrasado: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

export function AgenteCobrancaTab({ duplicatas }: Props) {
  const { config, isLoading: cfgLoading, save } = useCobrancaConfig();
  const { telefones, upsert: upsertTel } = useCobrancaTelefones();
  const enviar = useEnviarCobranca();

  const [draft, setDraft] = useState<CobrancaConfig | null>(null);
  const cfg = draft ?? config;

  const [previewItem, setPreviewItem] = useState<{ d: DuplicataAgregada; gatilho: Gatilho } | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewPhone, setPreviewPhone] = useState('');

  const [phoneEditId, setPhoneEditId] = useState<string | null>(null);
  const [phoneEditValue, setPhoneEditValue] = useState('');

  const itens = useMemo(() => {
    const list: { d: DuplicataAgregada; gatilho: Gatilho }[] = [];
    for (const d of duplicatas) {
      const g = classifyGatilho(d);
      if (!g) continue;
      if (cfg) {
        if (g === 'd3' && !cfg.enviar_d3) continue;
        if (g === 'd1' && !cfg.enviar_d1) continue;
        if (g === 'd0' && !cfg.enviar_d0) continue;
        if (g === 'atrasado' && !cfg.enviar_atrasado) continue;
      }
      list.push({ d, gatilho: g });
    }
    const ord: Record<Gatilho, number> = { atrasado: 0, d0: 1, d1: 2, d3: 3 };
    return list.sort((a, b) => ord[a.gatilho] - ord[b.gatilho] || (b.d.valor - a.d.valor));
  }, [duplicatas, cfg]);

  const counts = useMemo(() => {
    const c = { d3: 0, d1: 0, d0: 0, atrasado: 0 };
    itens.forEach(i => { c[i.gatilho]++; });
    return c;
  }, [itens]);

  if (cfgLoading || !cfg) {
    return <div className="h-40 rounded-lg bg-muted animate-pulse" />;
  }

  const set = <K extends keyof CobrancaConfig>(k: K, v: CobrancaConfig[K]) =>
    setDraft({ ...cfg, [k]: v });

  const openPreview = (d: DuplicataAgregada, g: Gatilho) => {
    const tpl = g === 'd3' ? cfg.template_d3 : g === 'd1' ? cfg.template_d1 : g === 'd0' ? cfg.template_d0 : cfg.template_atrasado;
    setPreviewItem({ d, gatilho: g });
    setPreviewContent(renderTemplate(tpl, d, cfg.rodape));
    setPreviewPhone(telefones[d.codCliente]?.phone_e164 || '');
  };

  const handleSend = async () => {
    if (!previewItem) return;
    if (!previewPhone.trim()) return;
    await enviar.mutateAsync({
      phone_e164: previewPhone.trim(),
      content: previewContent,
      duplicata_id: previewItem.d.id,
      cod_cliente: previewItem.d.codCliente,
      cliente_nome: previewItem.d.cliente,
      gatilho: previewItem.gatilho,
      valor: previewItem.d.valor,
      data_vencimento: previewItem.d.dataVencimento || undefined,
      dias_atraso: previewItem.d.diasAtraso,
    });
    // salva telefone se ainda não cadastrado
    if (!telefones[previewItem.d.codCliente]) {
      upsertTel.mutate({
        cod_empresa_bi: cfg.cod_empresa_bi,
        cod_cliente: previewItem.d.codCliente,
        cliente_nome: previewItem.d.cliente,
        phone_e164: previewPhone.trim(),
      });
    }
    setPreviewItem(null);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 border-sky-500/20">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-sky-500/15 flex items-center justify-center">
            <Bot className="size-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{cfg.agente_nome}</h3>
            <p className="text-sm text-muted-foreground">
              Especialista em cobrança. Configure o prompt, os gatilhos e os templates abaixo. Ao enviar, a mensagem é despachada pela instância WhatsApp da empresa e fica registrada no histórico.
            </p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="fila" className="w-full">
        <TabsList>
          <TabsTrigger value="fila">
            Fila de cobranças ({itens.length})
          </TabsTrigger>
          <TabsTrigger value="config">Configuração do agente</TabsTrigger>
          <TabsTrigger value="simulador">
            <Sparkles className="size-3.5 mr-1" /> Simulador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Atrasados" value={counts.atrasado} color="text-rose-500" icon={<AlertTriangle className="size-4" />} />
            <SummaryCard label="Vencem hoje" value={counts.d0} color="text-orange-500" icon={<Calendar className="size-4" />} />
            <SummaryCard label="Vencem amanhã" value={counts.d1} color="text-amber-500" icon={<Calendar className="size-4" />} />
            <SummaryCard label="Vencem em 3 dias" value={counts.d3} color="text-sky-500" icon={<Calendar className="size-4" />} />
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Cliente</th>
                    <th className="text-left px-3 py-2">Gatilho</th>
                    <th className="text-right px-3 py-2">Valor</th>
                    <th className="text-left px-3 py-2">Vencimento</th>
                    <th className="text-left px-3 py-2">Telefone</th>
                    <th className="text-right px-3 py-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum cliente para cobrar agora 🎉</td></tr>
                  )}
                  {itens.map(({ d, gatilho }) => {
                    const tel = telefones[d.codCliente];
                    const editing = phoneEditId === d.codCliente;
                    return (
                      <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <div className="font-medium">{d.cliente}</div>
                          <div className="text-xs text-muted-foreground">#{d.codCliente}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={GATILHO_COLOR[gatilho]}>{GATILHO_LABEL[gatilho]}{gatilho === 'atrasado' ? ` (${d.diasAtraso}d)` : ''}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(d.valor)}</td>
                        <td className="px-3 py-2">{fmtBR(d.dataVencimento)}</td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <div className="flex gap-1">
                              <Input
                                value={phoneEditValue}
                                onChange={(e) => setPhoneEditValue(e.target.value)}
                                placeholder="+55 11 99999-9999"
                                className="h-8 w-44"
                              />
                              <Button size="sm" variant="ghost" onClick={() => {
                                upsertTel.mutate({
                                  cod_empresa_bi: cfg.cod_empresa_bi,
                                  cod_cliente: d.codCliente,
                                  cliente_nome: d.cliente,
                                  phone_e164: phoneEditValue.trim(),
                                });
                                setPhoneEditId(null);
                              }}>OK</Button>
                            </div>
                          ) : tel?.phone_e164 ? (
                            <button
                              className="inline-flex items-center gap-1 text-sm hover:underline"
                              onClick={() => { setPhoneEditId(d.codCliente); setPhoneEditValue(tel.phone_e164); }}
                            >
                              <Phone className="size-3" /> {tel.phone_e164}
                            </button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7"
                              onClick={() => { setPhoneEditId(d.codCliente); setPhoneEditValue(''); }}>
                              <Phone className="size-3 mr-1" /> Adicionar
                            </Button>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" onClick={() => openPreview(d, gatilho)}>
                            <MessageSquare className="size-4 mr-1" /> Cobrar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4 mt-4">
          <Card className="p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do agente</Label>
                <Input value={cfg.agente_nome} onChange={(e) => set('agente_nome', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rodapé (assinatura, opcional)</Label>
                <Input value={cfg.rodape} onChange={(e) => set('rodape', e.target.value)} placeholder="Ex.: Equipe Financeira – Cyft" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Persona / Prompt do agente</Label>
              <Textarea
                rows={4}
                value={cfg.persona_prompt}
                onChange={(e) => set('persona_prompt', e.target.value)}
                placeholder="Descreva como o agente deve se comportar, o tom, regras, limites..."
              />
              <p className="text-xs text-muted-foreground">
                Usado como contexto base do agente. Variáveis disponíveis nos templates: <code>{'{cliente}'}</code>, <code>{'{valor}'}</code>, <code>{'{vencimento}'}</code>, <code>{'{dias_atraso}'}</code>.
              </p>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <TemplateCard
              title="Vence em 3 dias (D-3)" enabled={cfg.enviar_d3}
              onToggle={(v) => set('enviar_d3', v)}
              value={cfg.template_d3} onChange={(v) => set('template_d3', v)}
            />
            <TemplateCard
              title="Vence amanhã (D-1)" enabled={cfg.enviar_d1}
              onToggle={(v) => set('enviar_d1', v)}
              value={cfg.template_d1} onChange={(v) => set('template_d1', v)}
            />
            <TemplateCard
              title="Vence hoje (D0)" enabled={cfg.enviar_d0}
              onToggle={(v) => set('enviar_d0', v)}
              value={cfg.template_d0} onChange={(v) => set('template_d0', v)}
            />
            <TemplateCard
              title="Atrasado (D+N)" enabled={cfg.enviar_atrasado}
              onToggle={(v) => set('enviar_atrasado', v)}
              value={cfg.template_atrasado} onChange={(v) => set('template_atrasado', v)}
            />
          </div>

          <div className="flex justify-end gap-2">
            {draft && <Button variant="outline" onClick={() => setDraft(null)}>Descartar</Button>}
            <Button
              disabled={!draft || save.isPending}
              onClick={() => draft && save.mutate(draft, { onSuccess: () => setDraft(null) })}
            >
              <Save className="size-4 mr-1" /> Salvar configuração
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="simulador" className="mt-4">
          <SimuladorPanel cfg={cfg} duplicatas={duplicatas} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!previewItem} onOpenChange={(o) => !o && setPreviewItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar cobrança</DialogTitle>
            <DialogDescription>
              {previewItem?.d.cliente} — {previewItem && GATILHO_LABEL[previewItem.gatilho]}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Telefone (com DDD)</Label>
              <Input value={previewPhone} onChange={(e) => setPreviewPhone(e.target.value)} placeholder="+55 11 99999-9999" />
            </div>
            <div className="space-y-1">
              <Label>Mensagem</Label>
              <Textarea rows={8} value={previewContent} onChange={(e) => setPreviewContent(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewItem(null)}>Cancelar</Button>
            <Button onClick={handleSend} disabled={!previewPhone.trim() || enviar.isPending}>
              <Send className="size-4 mr-1" /> Enviar pelo WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}

function TemplateCard({
  title, enabled, onToggle, value, onChange,
}: {
  title: string; enabled: boolean; onToggle: (v: boolean) => void;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{title}</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{enabled ? 'Ativo' : 'Inativo'}</span>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
      </div>
      <Textarea rows={6} value={value} onChange={(e) => onChange(e.target.value)} />
    </Card>
  );
}

interface SimMsg { id: string; role: 'assistant' | 'user'; content: string; ts: number }

const GATILHO_OPCOES: { value: Gatilho; label: string }[] = [
  { value: 'd3', label: 'Vence em 3 dias (D-3)' },
  { value: 'd1', label: 'Vence amanhã (D-1)' },
  { value: 'd0', label: 'Vence hoje (D0)' },
  { value: 'atrasado', label: 'Atrasado (D+N)' },
];

function SimuladorPanel({ cfg, duplicatas }: { cfg: CobrancaConfig; duplicatas: DuplicataAgregada[] }) {
  const { toast } = useToast();
  const [gatilho, setGatilho] = useState<Gatilho>('atrasado');
  const [cliente, setCliente] = useState('Maria Silva');
  const [valor, setValor] = useState('1250.90');
  const [vencimento, setVencimento] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 5);
    return d.toISOString().slice(0, 10);
  });
  const [diasAtraso, setDiasAtraso] = useState('5');
  const [messages, setMessages] = useState<SimMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const aplicarDuplicata = (id: string) => {
    const d = duplicatas.find(x => x.id === id);
    if (!d) return;
    setCliente(d.cliente || '');
    setValor(String(d.valor || 0));
    setVencimento(d.dataVencimento || '');
    setDiasAtraso(String(d.diasAtraso || 0));
    if (d.situacao === 'vencida') setGatilho('atrasado');
    else if (d.situacao === 'vence_hoje') setGatilho('d0');
  };

  const callAgent = async (history: SimMsg[]) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cobranca-simulate', {
        body: {
          persona_prompt: cfg.persona_prompt,
          agente_nome: cfg.agente_nome,
          gatilho,
          cenario: {
            cliente,
            valor: Number(valor) || 0,
            vencimento: vencimento ? new Date(vencimento).toLocaleDateString('pt-BR') : '',
            dias_atraso: Number(diasAtraso) || 0,
          },
          templates: {
            d3: cfg.template_d3, d1: cfg.template_d1, d0: cfg.template_d0, atrasado: cfg.template_atrasado,
          },
          messages: history.map(m => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply: string = (data as any)?.reply || '';
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: reply, ts: Date.now() }]);
    } catch (e: any) {
      toast({ title: 'Erro no simulador', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const iniciar = async () => {
    setMessages([]);
    // Mensagem inicial: pedir ao agente para abrir a conversa (lista vazia faz com que ele inicie)
    await callAgent([]);
  };

  const enviar = async () => {
    if (!input.trim() || loading) return;
    const userMsg: SimMsg = { id: crypto.randomUUID(), role: 'user', content: input.trim(), ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    await callAgent(next);

    // Dispara detecção de intenção (Pix, boleto, negociação, etc.) para criar
    // intervenção real na aba Acompanhamento — espelha o fluxo de produção.
    try {
      const last10 = next.slice(-10).map(m => ({
        role: (m.role === 'user' ? 'cliente' : 'agente') as 'cliente' | 'agente',
        content: m.content,
      }));
      await supabase.functions.invoke('cobranca-detect-intent', {
        body: {
          cod_empresa_bi: cfg.cod_empresa_bi,
          cliente_nome: cliente,
          contact_phone: `sim-${cfg.cod_empresa_bi}-${cliente}`.toLowerCase().replace(/\s+/g, '-'),
          valor: Number(valor) || 0,
          data_vencimento: vencimento || null,
          last_messages: last10,
          ultima_mensagem_cliente: userMsg.content,
        },
      });
    } catch (e) {
      console.warn('[simulador] detect-intent falhou', e);
    }
  };

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4">
      {/* Painel de cenário */}
      <Card className="p-4 space-y-3 h-fit">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-500" />
          <h4 className="font-semibold">Cenário da simulação</h4>
        </div>

        <div className="space-y-2">
          <Label>Gatilho</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={gatilho}
            onChange={(e) => setGatilho(e.target.value as Gatilho)}
          >
            {GATILHO_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Cliente</Label>
          <Input value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Dias atraso</Label>
            <Input value={diasAtraso} onChange={(e) => setDiasAtraso(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Vencimento</Label>
          <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </div>

        {duplicatas.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs text-muted-foreground">Usar dados de uma duplicata real</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              defaultValue=""
              onChange={(e) => e.target.value && aplicarDuplicata(e.target.value)}
            >
              <option value="">Selecione…</option>
              {duplicatas.slice(0, 100).map(d => (
                <option key={d.id} value={d.id}>{d.cliente} — {formatCurrency(d.valor)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={iniciar} disabled={loading} className="flex-1">
            <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {messages.length === 0 ? 'Iniciar conversa' : 'Reiniciar'}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O simulador usa a persona, templates e cenário acima. Ideal para testar o tom e a abordagem antes de enviar de verdade.
        </p>
      </Card>

      {/* Chat */}
      <Card className="flex flex-col h-[560px] overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <div className="size-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <Bot className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{cfg.agente_nome}</div>
            <div className="text-[11px] text-muted-foreground">Simulação — nada é enviado</div>
          </div>
          <Badge variant="outline" className={GATILHO_COLOR[gatilho]}>{GATILHO_LABEL[gatilho]}</Badge>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[hsl(var(--muted)/0.3)]">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2">
              <MessageSquare className="size-8 opacity-40" />
              <p>Configure o cenário e clique em <b>Iniciar conversa</b>.</p>
              <p className="text-xs">Você responderá como o cliente; o agente seguirá a persona configurada.</p>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                m.role === 'assistant'
                  ? 'bg-card border border-border rounded-tl-sm'
                  : 'bg-emerald-500 text-white rounded-tr-sm'
              }`}>
                <div className="flex items-center gap-1 mb-0.5 text-[10px] uppercase tracking-wider opacity-70">
                  {m.role === 'assistant' ? <Bot className="size-3" /> : <User className="size-3" />}
                  {m.role === 'assistant' ? cfg.agente_nome : 'Cliente'}
                </div>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-muted-foreground">
                digitando…
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <Input
            placeholder={messages.length === 0 ? 'Inicie a conversa primeiro…' : 'Responda como o cliente…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            disabled={loading || messages.length === 0}
          />
          <Button onClick={enviar} disabled={loading || !input.trim() || messages.length === 0}>
            <Send className="size-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
