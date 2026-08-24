import { useMemo, useState } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  TrendingDown,
  Truck,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  BadgeCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EstoqueRecord, GiroRecord } from '@/types/estoque';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText } from 'lucide-react';


interface Props {
  estoqueData: EstoqueRecord[];
  giroData: GiroRecord[];
}

const FORNECEDOR_NOMES: Record<string, string> = {
  'FORN-0101': 'Atlas Suprimentos Ltda',
  'FORN-0202': 'Nova Era Distribuidora',
  'FORN-0303': 'Horizonte Comercial',
  'FORN-0404': 'Prime Logística Industrial',
};

const nomeFornecedor = (cod: string) => FORNECEDOR_NOMES[cod] || cod || 'Não informado';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const fmtInt = (v: number) => Math.round(v).toLocaleString('pt-BR');

/** Hash determinístico simples para gerar variações estáveis por produto/fornecedor. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 1000) / 1000;
}

type Urgencia = 'critico' | 'atencao' | 'planejado';

interface Cotacao {
  cod_fornecedor: string;
  fornecedor: string;
  preco: number;
  prazoDias: number;
  ultimaCompra: string | null;
  principal: boolean;
}

interface ItemCotacao {
  cod_produto: number;
  produto: string;
  marca: string;
  grupo: string;
  estoque: number;
  demandaMensal: number;
  coberturaMeses: number;
  sugestaoQtd: number;
  urgencia: Urgencia;
  cotacoes: Cotacao[];
  melhor: Cotacao;
  economia: number;
  valorEstimado: number;
}

const MESES_ALVO = 2;

export function EstoqueCotacaoTab({ estoqueData, giroData }: Props) {
  const [search, setSearch] = useState('');
  const [urgenciaFiltro, setUrgenciaFiltro] = useState<string>('todas');
  const [fornecedorFiltro, setFornecedorFiltro] = useState<string>('todos');
  const [expandido, setExpandido] = useState<number | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [escolha, setEscolha] = useState<Record<number, string>>({});
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);


  const itens = useMemo<ItemCotacao[]>(() => {
    // Demanda: total de saída por venda no período disponível do giro
    const vendasPorProduto = new Map<number, number>();
    const datas: number[] = [];
    for (const g of giroData) {
      vendasPorProduto.set(g.cod_produto, (vendasPorProduto.get(g.cod_produto) || 0) + (g.saida_venda || 0));
      const t = new Date(g.data_movimento).getTime();
      if (!Number.isNaN(t)) datas.push(t);
    }
    const meses =
      datas.length > 1
        ? Math.max(1, (Math.max(...datas) - Math.min(...datas)) / (1000 * 60 * 60 * 24 * 30))
        : 1;

    // Consolida estoque por produto (soma filiais)
    const porProduto = new Map<number, EstoqueRecord & { qtd: number }>();
    for (const r of estoqueData) {
      const atual = porProduto.get(r.cod_produto);
      if (atual) atual.qtd += r.quantidade_estoque;
      else porProduto.set(r.cod_produto, { ...r, qtd: r.quantidade_estoque });
    }

    const lista: ItemCotacao[] = [];
    porProduto.forEach((r) => {
      const demandaMensal = (vendasPorProduto.get(r.cod_produto) || 0) / meses;
      if (demandaMensal <= 0) return; // sem consumo, não precisa comprar

      const cobertura = r.qtd > 0 ? r.qtd / demandaMensal : 0;
      if (cobertura >= MESES_ALVO) return; // estoque suficiente

      const sugestaoQtd = Math.max(1, Math.ceil(demandaMensal * MESES_ALVO - r.qtd));
      const urgencia: Urgencia = cobertura < 0.5 ? 'critico' : cobertura < 1 ? 'atencao' : 'planejado';

      const base = r.custo_ultima_compra > 0 ? r.custo_ultima_compra : r.custo_medio || r.custo || 0;
      const principalCod = r.cod_fornecedor || 'FORN-0101';

      const alternativos = Object.keys(FORNECEDOR_NOMES)
        .filter((c) => c !== principalCod)
        .slice(0, 2);

      const cotacoes: Cotacao[] = [
        {
          cod_fornecedor: principalCod,
          fornecedor: nomeFornecedor(principalCod),
          preco: base,
          prazoDias: 5 + Math.round(hash(`${r.cod_produto}${principalCod}p`) * 10),
          ultimaCompra: r.data_ultima_compra,
          principal: true,
        },
        ...alternativos.map((cod) => {
          const h = hash(`${r.cod_produto}${cod}`);
          return {
            cod_fornecedor: cod,
            fornecedor: nomeFornecedor(cod),
            preco: Number((base * (0.9 + h * 0.25)).toFixed(2)),
            prazoDias: 4 + Math.round(hash(`${cod}${r.cod_produto}d`) * 14),
            ultimaCompra: null,
            principal: false,
          };
        }),
      ];

      const melhor = cotacoes.reduce((a, b) => (b.preco < a.preco ? b : a), cotacoes[0]);
      const pior = cotacoes.reduce((a, b) => (b.preco > a.preco ? b : a), cotacoes[0]);

      lista.push({
        cod_produto: r.cod_produto,
        produto: r.produto,
        marca: r.marca,
        grupo: r.grupo,
        estoque: r.qtd,
        demandaMensal,
        coberturaMeses: cobertura,
        sugestaoQtd,
        urgencia,
        cotacoes,
        melhor,
        economia: (pior.preco - melhor.preco) * sugestaoQtd,
        valorEstimado: melhor.preco * sugestaoQtd,
      });
    });

    return lista.sort((a, b) => a.coberturaMeses - b.coberturaMeses);
  }, [estoqueData, giroData]);

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    return itens.filter((i) => {
      if (urgenciaFiltro !== 'todas' && i.urgencia !== urgenciaFiltro) return false;
      if (fornecedorFiltro !== 'todos' && !i.cotacoes.some((c) => c.cod_fornecedor === fornecedorFiltro)) return false;
      if (term && !`${i.produto} ${i.cod_produto} ${i.marca} ${i.grupo}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [itens, search, urgenciaFiltro, fornecedorFiltro]);

  const fornecedorEscolhido = (item: ItemCotacao): Cotacao =>
    item.cotacoes.find((c) => c.cod_fornecedor === escolha[item.cod_produto]) || item.melhor;

  const kpis = useMemo(() => {
    const criticos = itens.filter((i) => i.urgencia === 'critico').length;
    const investimento = filtrados.reduce((s, i) => s + fornecedorEscolhido(i).preco * i.sugestaoQtd, 0);
    const economia = filtrados.reduce((s, i) => s + i.economia, 0);
    const fornecedores = new Set(filtrados.map((i) => fornecedorEscolhido(i).cod_fornecedor)).size;
    return { criticos, investimento, economia, fornecedores };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, filtrados, escolha]);

  const toggleSel = (cod: number) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(cod) ? next.delete(cod) : next.add(cod);
      return next;
    });
  };

  const gerarPdf = () => {
    const alvo = selecionados.size > 0 ? filtrados.filter((i) => selecionados.has(i.cod_produto)) : filtrados;
    if (alvo.length === 0) {
      toast.error('Nenhum item para gerar o PDF.');
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const hoje = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(14);
    doc.text('Cotação de Compras', 40, 40);
    doc.setFontSize(9);
    doc.text(`Emitido em ${hoje} • ${alvo.length} itens`, 40, 56);

    const body = alvo.map((i) => {
      const c = fornecedorEscolhido(i);
      return [
        String(i.cod_produto), i.produto, i.marca, i.grupo,
        fmtInt(i.estoque), i.demandaMensal.toFixed(1).replace('.', ','),
        i.coberturaMeses.toFixed(1).replace('.', ','), String(i.sugestaoQtd),
        c.fornecedor, fmtBRL(c.preco), String(c.prazoDias),
        fmtBRL(c.preco * i.sugestaoQtd),
        i.urgencia,
      ];
    });
    const totalGeral = alvo.reduce((s, i) => s + fornecedorEscolhido(i).preco * i.sugestaoQtd, 0);

    autoTable(doc, {
      startY: 70,
      head: [[
        'Código', 'Produto', 'Marca', 'Grupo', 'Estoque', 'Demanda/mês',
        'Cobertura', 'Qtd sugerida', 'Fornecedor', 'Preço últ. compra', 'Prazo (d)', 'Total estimado', 'Urgência',
      ]],
      body,
      foot: [['', '', '', '', '', '', '', '', '', '', 'Total', fmtBRL(totalGeral), '']],
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
      theme: 'grid',
    });

    const url = doc.output('bloburl') as unknown as string;
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(String(url));
    setPdfDoc(doc);
    setPdfOpen(true);
  };

  const salvarPdf = () => {
    if (!pdfDoc) return;
    pdfDoc.save(`cotacao_compras_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    toast.success('PDF salvo.');
  };

  const fecharPdf = () => {
    setPdfOpen(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setPdfDoc(null);
  };


  const urgenciaBadge = (u: Urgencia) => {
    const map = {
      critico: { label: 'Crítico', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
      atencao: { label: 'Atenção', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
      planejado: { label: 'Planejado', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    } as const;
    return <Badge variant="outline" className={cn('text-[11px]', map[u].cls)}>{map[u].label}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <ShoppingCart className="h-4 w-4" /> Itens a comprar
            </div>
            <p className="text-2xl font-bold mt-1">{fmtInt(filtrados.length)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <AlertTriangle className="h-4 w-4" /> Ruptura crítica
            </div>
            <p className="text-2xl font-bold mt-1 text-destructive">{fmtInt(kpis.criticos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Truck className="h-4 w-4" /> Investimento estimado
            </div>
            <p className="text-2xl font-bold mt-1">{fmtBRL(kpis.investimento)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingDown className="h-4 w-4" /> Economia na melhor cotação
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{fmtBRL(kpis.economia)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto, código, marca ou grupo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={urgenciaFiltro} onValueChange={setUrgenciaFiltro}>
            <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as urgências</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="atencao">Atenção</SelectItem>
              <SelectItem value="planejado">Planejado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fornecedorFiltro} onValueChange={setFornecedorFiltro}>
            <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os fornecedores</SelectItem>
              {Object.entries(FORNECEDOR_NOMES).map(([cod, nome]) => (
                <SelectItem key={cod} value={cod}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={gerarPdf} className="gap-2">
            <FileText className="h-4 w-4" />
            Visualizar PDF{selecionados.size > 0 ? ` (${selecionados.size})` : ''}
          </Button>

        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sugestão de compra e cotações por fornecedor</CardTitle>
          <p className="text-xs text-muted-foreground">
            Baseado na demanda média mensal e cobertura alvo de {MESES_ALVO} meses. Preços referentes à última compra de cada fornecedor.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-xs uppercase tracking-wide">
                  <th className="p-3 w-10"></th>
                  <th className="p-3 text-left">Produto</th>
                  <th className="p-3 text-center">Estoque</th>
                  <th className="p-3 text-center">Demanda/mês</th>
                  <th className="p-3 text-center">Cobertura</th>
                  <th className="p-3 text-center">Comprar</th>
                  <th className="p-3 text-left">Fornecedor sugerido</th>
                  <th className="p-3 text-right">Total estimado</th>
                  <th className="p-3 text-center">Urgência</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      Nenhum item com necessidade de compra para os filtros aplicados.
                    </td>
                  </tr>
                )}
                {filtrados.map((item) => {
                  const c = fornecedorEscolhido(item);
                  const aberto = expandido === item.cod_produto;
                  return (
                    <>
                      <tr
                        key={item.cod_produto}
                        className="border-t border-border hover:bg-muted/30 cursor-pointer"
                        onClick={() => setExpandido(aberto ? null : item.cod_produto)}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selecionados.has(item.cod_produto)}
                            onCheckedChange={() => toggleSel(item.cod_produto)}
                          />
                        </td>
                        <td className="p-3">
                          <p className="font-medium">{item.produto}</p>
                          <p className="text-xs text-muted-foreground">
                            #{item.cod_produto} · {item.marca} · {item.grupo}
                          </p>
                        </td>
                        <td className="p-3 text-center">{fmtInt(item.estoque)}</td>
                        <td className="p-3 text-center">{item.demandaMensal.toFixed(1)}</td>
                        <td className="p-3 text-center">{item.coberturaMeses.toFixed(1)} m</td>
                        <td className="p-3 text-center font-semibold">{fmtInt(item.sugestaoQtd)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span>{c.fornecedor}</span>
                            {c.cod_fornecedor === item.melhor.cod_fornecedor && (
                              <BadgeCheck className="h-4 w-4 text-emerald-600" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {fmtBRL(c.preco)} / un · entrega {c.prazoDias} dias
                          </p>
                        </td>
                        <td className="p-3 text-right font-semibold">{fmtBRL(c.preco * item.sugestaoQtd)}</td>
                        <td className="p-3 text-center">{urgenciaBadge(item.urgencia)}</td>
                        <td className="p-3 text-muted-foreground">
                          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                      </tr>
                      {aberto && (
                        <tr key={`${item.cod_produto}-det`} className="bg-muted/20 border-t border-border">
                          <td colSpan={10} className="p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                              Cotações — última compra por fornecedor
                            </p>
                            <div className="grid gap-2 md:grid-cols-3">
                              {item.cotacoes
                                .slice()
                                .sort((a, b) => a.preco - b.preco)
                                .map((cot) => {
                                  const ativo = cot.cod_fornecedor === c.cod_fornecedor;
                                  return (
                                    <button
                                      key={cot.cod_fornecedor}
                                      onClick={() =>
                                        setEscolha((prev) => ({ ...prev, [item.cod_produto]: cot.cod_fornecedor }))
                                      }
                                      className={cn(
                                        'text-left rounded-lg border p-3 transition-colors',
                                        ativo ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                                      )}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium text-sm">{cot.fornecedor}</span>
                                        {cot.cod_fornecedor === item.melhor.cod_fornecedor && (
                                          <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                                            Melhor preço
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-lg font-bold mt-1">{fmtBRL(cot.preco)}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Total: {fmtBRL(cot.preco * item.sugestaoQtd)} · entrega {cot.prazoDias} dias
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {cot.principal ? 'Fornecedor habitual' : 'Fornecedor alternativo'}
                                        {cot.ultimaCompra
                                          ? ` · última compra ${new Date(cot.ultimaCompra).toLocaleDateString('pt-BR')}`
                                          : ''}
                                      </p>
                                    </button>
                                  );
                                })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={pdfOpen} onOpenChange={(o) => (o ? setPdfOpen(true) : fecharPdf())}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Pré-visualização da cotação
            </DialogTitle>
          </DialogHeader>
          <div className="h-[65vh] w-full rounded-md border overflow-hidden bg-muted">
            {pdfUrl && <iframe src={pdfUrl} title="Cotação PDF" className="h-full w-full" />}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={fecharPdf}>Fechar sem salvar</Button>
            <Button onClick={salvarPdf} className="gap-2">
              <Download className="h-4 w-4" /> Salvar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
