import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import type { DuplicataRecord } from '@/hooks/useDuplicatasData';
import { usePedidosSaldoAVencer } from '@/hooks/usePedidosSaldoAVencer';
import { SaldoAVencerKpis, type KpiRegistro } from '@/components/financeiro/SaldoAVencerKpis';

import { formatCurrency, formatPercent } from '@/utils/formatters';
import { buildPageWindow } from '@/utils/pagination';
import {
  formatParcelaDevedor,
  getValorAReceberTitulo,
  getValorOriginalTitulo,
  getValorRecebidoTitulo,
} from '@/utils/devedoresClientes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, ArrowLeft, ArrowUpDown, CalendarDays, ChevronDown, Download, FileText, Search, Wallet } from 'lucide-react';

interface ClienteSaldo {
  codCliente: string;
  cliente: string;
  total: number;
  qtd: number;
  proximoVencimento: string | null;
  participacao: number;
  vendedor: string;
  empresa: string;
  pedidos: string;
  notas: string;
  status: string;
}

const PAGE_SIZE = 15;

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const value = String(v).trim();
  if (!value || /^0{4}-0{2}-0{2}/.test(value) || value.startsWith('0001-01-01') || value.startsWith('1899-12-30')) {
    return null;
  }
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return isNaN(d.getTime()) ? null : d;
}

function hasValidDate(v?: string | null): boolean {
  return parseDate(v) !== null;
}

function normalizeStatus(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

function numberValue(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const text = String(v ?? '').trim();
  if (!text) return 0;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateBR(v?: string | null): string {
  const d = parseDate(v);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

function formatMesAnoBR(d: Date): string {
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDateParam(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Mantém apenas operações de venda: códigos 01..16 ou tradutor 21. */
function isOperacaoVenda(rec: DuplicataRecord): boolean {
  const r = rec as unknown as Record<string, unknown>;
  const tradutorRaw =
    r.CodTradutor ?? r.Tradutor ?? r.codTradutor ?? r.CODTRADUTOR;
  if (tradutorRaw !== undefined && tradutorRaw !== null && String(tradutorRaw).trim() !== '') {
    return Number(String(tradutorRaw).replace(/\D/g, '')) === 21;
  }
  const opRaw =
    r.CodOperacao ?? r.Operacao ?? r.CodOper ?? r.codOperacao ?? r.CODOPERACAO;
  if (opRaw !== undefined && opRaw !== null && String(opRaw).trim() !== '') {
    const n = Number(String(opRaw).replace(/\D/g, ''));
    return Number.isFinite(n) && n >= 1 && n <= 16;
  }
  // Sem campo de operação no payload: considera todas as duplicatas a receber.
  return true;
}

const TODOS = '__todos__';
const SEM_VENCIMENTO_KEY = 'SEM_VENCIMENTO';
const SEM_VENCIMENTO_LABEL = 'Sem vencimento informado';

export interface SaldoAVencerFiltros {
  empresa?: string;
  codEmpresa?: string;
  vendedor?: string;
  cliente?: string;
  codCliente?: string;
  ano?: string;
  mes?: string;
}

export function SaldoAVencerTab({ filtros }: { filtros?: SaldoAVencerFiltros }) {
  // Rascunho (não aplica nada) x aplicado (usado por cards/tabela/exportação)
  const [draftBusca, setDraftBusca] = useState('');
  const [draftAteData, setDraftAteData] = useState('');
  const [busca, setBusca] = useState('');
  const [ateData, setAteData] = useState('');
  const [sortKey, setSortKey] = useState<'cliente' | 'total' | 'participacao'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [clienteSel, setClienteSel] = useState<string | null>(null);
  const [vencExpandido, setVencExpandido] = useState<string | null>(null);

  const aplicarBuscaLocal = () => {
    setBusca(draftBusca);
    setAteData(draftAteData);
    setPage(0);
  };



  // ---------- Filtros vindos da barra de filtros da página ----------
  const fEmpresa = filtros?.empresa ?? TODOS;
  const fCodEmpresa = filtros?.codEmpresa ?? TODOS;
  const fVendedor = filtros?.vendedor ?? TODOS;
  const fCliente = filtros?.cliente ?? TODOS;
  const fCodCliente = filtros?.codCliente ?? TODOS;
  const fAno = filtros?.ano ?? TODOS;
  const fMes = filtros?.mes ?? TODOS;

  // Meses selecionados (multi-seleção). "mes" chega como lista separada por vírgula.
  const mesesSel = useMemo(() => {
    if (!fMes || fMes === TODOS) return [] as number[];
    return String(fMes)
      .split(',')
      .map((m) => Number(m.trim()))
      .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12)
      .sort((a, b) => a - b);
  }, [fMes]);

  // Período (janela fechada) vindo do filtro superior
  const periodo = useMemo(() => {
    if (fAno === TODOS && mesesSel.length === 0) return null;
    const ano = fAno !== TODOS ? Number(fAno) : new Date().getFullYear();
    if (mesesSel.length === 0) {
      return { ini: new Date(ano, 0, 1, 0, 0, 0, 0), fim: new Date(ano, 11, 31, 23, 59, 59, 999) };
    }
    const min = mesesSel[0] - 1;
    const max = mesesSel[mesesSel.length - 1] - 1;
    return { ini: new Date(ano, min, 1, 0, 0, 0, 0), fim: new Date(ano, max + 1, 0, 23, 59, 59, 999) };
  }, [fAno, mesesSel]);


  const periodoApi = useMemo(() => {
    if (!periodo) return {};
    return {
      dataIni: formatDateParam(periodo.ini),
      dataFim: formatDateParam(periodo.fim),
    };
  }, [periodo]);

  // Carrega a carteira da fonte validada e aplica o período localmente pelo vencimento.
  const { data, isLoading, error, refetch } = usePedidosSaldoAVencer();
  const auditFonte = (data as unknown as { __audit?: Record<string, unknown> } | undefined)?.__audit;
  const semCamposSaldo = Boolean(auditFonte?.semCamposSaldo);

  // Saldo em aberto da parcela: valor da duplicata menos o que já foi recebido
  const saldoAberto = (d: DuplicataRecord) => getValorAReceberTitulo(d);

  const isRegistroAberto = (d: DuplicataRecord) => {
    const status = normalizeStatus(d.Status ?? d.Situacao ?? d.situacao ?? d.status ?? d.Origem);
    if (hasValidDate(d.DataPagamento) || hasValidDate(d.DataBaixa) || hasValidDate(d.DataQuitacao) || hasValidDate(d.DataCancelamento)) {
      return false;
    }
    if (/PAG|QUIT|BAIX|CANCEL|LIQUID|RECEBID/.test(status)) return false;
    return saldoAberto(d) > 0;
  };

  // Base: parcelas em aberto (não pagas) com vencimento dentro do período filtrado.
  // Sem período selecionado, mantém o comportamento "a vencer" (>= hoje).
  const baseAVencer = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = ateData ? parseDate(ateData) : null;
    if (limite) limite.setHours(23, 59, 59, 999);
    const auditoria = {
      recebidos: data?.length ?? 0,
      tipoReceber: 0,
      semPagamento: 0,
      comVencimento: 0,
      dentroPeriodo: 0,
      operacaoVenda: 0,
      saldoPositivo: 0,
      entreguesBase: 0,
      periodo: periodo
        ? {
            dataIni: formatDateParam(periodo.ini),
            dataFim: formatDateParam(periodo.fim),
          }
        : 'a partir de hoje',
      limiteAte: ateData || null,
    };
    const filtrados = (data ?? []).filter((d) => {
      if (String(d.Tipo).toUpperCase() && String(d.Tipo).toUpperCase() !== 'RECEBER') return false;
      auditoria.tipoReceber += 1;
      if (!isRegistroAberto(d)) return false;
      auditoria.semPagamento += 1;
      const venc = parseDate(d.DataVencimento);
      if (!venc) {
        if (periodo || mesesSel.length > 0 || limite) return false;
      } else {
        auditoria.comVencimento += 1;
        if (periodo) {
          if (venc < periodo.ini || venc > periodo.fim) return false;
        }
        if (mesesSel.length > 0 && !mesesSel.includes(venc.getMonth() + 1)) return false;
        if (limite && venc > limite) return false;
      }

      auditoria.dentroPeriodo += 1;
      if (!isOperacaoVenda(d)) return false;
      auditoria.operacaoVenda += 1;
      auditoria.saldoPositivo += 1;
      return true;
    });
    auditoria.entreguesBase = filtrados.length;
    console.info('[1001][Financeiro][SaldoAVencer][Auditoria]', auditoria);
    return filtrados;
  }, [data, ateData, periodo, mesesSel]);

  // Aplica filtros de dimensão (empresa, vendedor, cliente)
  const aVencer = useMemo(() => {
    const filtrados = baseAVencer.filter((d) => {
      if (fEmpresa !== TODOS && String(d.Empresa ?? '') !== fEmpresa) return false;
      if (fCodEmpresa !== TODOS && String(d.CodEmpresa_bi ?? '') !== fCodEmpresa) return false;
      if (fVendedor !== TODOS && String(d.Vendedor ?? '') !== fVendedor) return false;
      if (fCodCliente !== TODOS && String(d.CodCliente ?? '') !== fCodCliente) return false;
      if (fCliente !== TODOS && String(d.Cliente || d.CodClienteRazao || '') !== fCliente) return false;
      return true;
    });
    console.info('[1001][Financeiro][SaldoAVencer][Auditoria][Filtros]', {
      base: baseAVencer.length,
      entregues: filtrados.length,
      filtros: {
        empresa: fEmpresa,
        codEmpresa: fCodEmpresa,
        vendedor: fVendedor,
        cliente: fCliente,
        codCliente: fCodCliente,
        ano: fAno,
        mes: fMes,
      },
    });
    return filtrados;
  }, [baseAVencer, fEmpresa, fCodEmpresa, fVendedor, fCodCliente, fCliente, fAno, fMes]);


  // ---------- Totalizadores interativos ----------
  const hojeRef = useMemo(() => {
    const h = new Date();
    h.setHours(0, 0, 0, 0);
    return h;
  }, []);

  /** Classificação por data de vencimento (única data confiável na fonte). */
  const classificar = (d: DuplicataRecord): 'a_vencer' | 'vencido' => {
    const venc = parseDate(d.DataVencimento);
    return venc && venc < hojeRef ? 'vencido' : 'a_vencer';
  };

  // Mesma lista que alimenta a tabela: filtros + busca textual
  const registrosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return aVencer;
    return aVencer.filter((d) => {
      const nome = String(d.Cliente || d.CodClienteRazao || '').toLowerCase();
      const cod = String(d.CodCliente ?? '').toLowerCase();
      return nome.includes(q) || cod.includes(q);
    });
  }, [aVencer, busca]);

  const totalizadores = useMemo(() => {
    const acc = {
      a_vencer: { valor: 0, qtd: 0 },
      vencido: { valor: 0, qtd: 0 },
    };
    let total = 0;
    const clientesSet = new Set<string>();
    for (const d of registrosFiltrados) {
      const v = saldoAberto(d);
      if (!(v > 0)) continue;
      total += v;
      clientesSet.add(String(d.CodCliente ?? d.Cliente ?? '—'));
      const cat = classificar(d);
      acc[cat].valor += v;
      acc[cat].qtd += 1;
    }
    return {
      ...acc,
      total,
      clientes: clientesSet.size,
      parcelas: acc.a_vencer.qtd + acc.vencido.qtd,
    };
  }, [registrosFiltrados, hojeRef]);

  const [foco, setFoco] = useState<'a_vencer' | 'vencido' | null>(null);

  const aVencerFoco = useMemo(
    () => (foco ? registrosFiltrados.filter((d) => classificar(d) === foco) : registrosFiltrados),
    [registrosFiltrados, foco, hojeRef],
  );

  // Somente apresentação: mesma lista dos cards, normalizada para o Detalhamento
  const kpiRegistros = useMemo<KpiRegistro[]>(() => {
    const out: KpiRegistro[] = [];
    for (const d of registrosFiltrados) {
      const v = saldoAberto(d);
      if (!(v > 0)) continue;
      out.push({
        cliente: String(d.Cliente || d.CodClienteRazao || d.CodCliente || '—'),
        codCliente: String(d.CodCliente ?? d.Cliente ?? '—'),
        documento: String(d.CodDuplicata ?? d.NumNF ?? ''),
        vencimento: formatDateBR(d.DataVencimento),
        valor: v,
        categoria: classificar(d),
      });
    }
    return out;
  }, [registrosFiltrados, hojeRef]);

  const kpiContexto = useMemo(() => {
    const nomesMes = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    const mesesLabel =
      fMes && fMes !== TODOS
        ? String(fMes)
            .split(',')
            .map((m) => nomesMes[Number(m) - 1] ?? m)
            .join(', ')
        : 'Todos os meses';
    const anoLabel = fAno && fAno !== TODOS ? fAno : 'Todos os anos';
    const filtrosAtivos: string[] = [];
    if (fEmpresa !== TODOS) filtrosAtivos.push(`Empresa: ${fEmpresa}`);
    if (fCodEmpresa !== TODOS) filtrosAtivos.push(`Cód. empresa: ${fCodEmpresa}`);
    if (fVendedor !== TODOS) filtrosAtivos.push(`Vendedor: ${fVendedor}`);
    if (fCliente !== TODOS) filtrosAtivos.push(`Cliente: ${fCliente}`);
    if (fCodCliente !== TODOS) filtrosAtivos.push(`Cód. cliente: ${fCodCliente}`);
    if (busca.trim()) filtrosAtivos.push(`Busca: "${busca.trim()}"`);
    if (ateData) filtrosAtivos.push(`Vencimento até: ${formatDateBR(ateData)}`);
    return {
      periodo: `${mesesLabel} · ${anoLabel}`,
      filtrosAtivos,
      fonte: '/comercial/pedidos',
    };
  }, [fMes, fAno, fEmpresa, fCodEmpresa, fVendedor, fCliente, fCodCliente, busca, ateData]);



  const clientes = useMemo<ClienteSaldo[]>(() => {
    const map = new Map<string, ClienteSaldo>();
    for (const d of aVencerFoco) {

      const cod = String(d.CodCliente ?? '—');
      const cur = map.get(cod) ?? {
        codCliente: cod,
        cliente: d.Cliente || d.CodClienteRazao || cod,
        total: 0,
        qtd: 0,
        proximoVencimento: null,
        participacao: 0,
        vendedor: String(d.Vendedor ?? ''),
        empresa: String(d.Empresa ?? ''),
        pedidos: '',
        notas: '',
        status: String(d.Status ?? ''),
      };
      cur.total += saldoAberto(d);
      cur.qtd += 1;
      const pedido = String(d.CodDuplicata ?? '').trim();
      if (pedido && !cur.pedidos.split(', ').includes(pedido)) {
        cur.pedidos = cur.pedidos ? `${cur.pedidos}, ${pedido}` : pedido;
      }
      const nf = String((d as Record<string, unknown>).NumNF ?? '').trim();
      if (nf && nf !== 'null' && !cur.notas.split(', ').includes(nf)) {
        cur.notas = cur.notas ? `${cur.notas}, ${nf}` : nf;
      }
      const venc = d.DataVencimento;
      if (venc && (!cur.proximoVencimento || parseDate(venc)! < parseDate(cur.proximoVencimento)!)) {
        cur.proximoVencimento = venc;
      }
      map.set(cod, cur);
    }
    const arr = Array.from(map.values()).filter((c) => c.total > 0);
    const totalGeral = arr.reduce((s, c) => s + c.total, 0);
    arr.forEach((c) => (c.participacao = totalGeral > 0 ? (c.total / totalGeral) * 100 : 0));
    return arr;
  }, [aVencerFoco]);

  const totalGeral = useMemo(() => clientes.reduce((s, c) => s + c.total, 0), [clientes]);
  const maiorSaldo = useMemo(() => Math.max(1, ...clientes.map((c) => c.total)), [clientes]);

  useEffect(() => {
    if (!data) return;
    console.info('[1001][Financeiro][SaldoAVencer][Auditoria]', {
      empresa: auditFonte?.empresa ?? '1001',
      fonteUsada: auditFonte?.fonte ?? 'desconhecida',
      data_ini: periodoApi.dataIni,
      data_fim: periodoApi.dataFim,
      endpointPrincipal: auditFonte?.endpointPrincipal ?? null,
      endpointPathConfigurado: auditFonte?.endpointPathConfigurado ?? null,
      jsonPathConfigurado: auditFonte?.jsonPathConfigurado ?? null,
      usarVpsIntermediaria: auditFonte?.usarVpsIntermediaria ?? null,
      vpsBaseUrl: auditFonte?.vpsBaseUrl ?? null,
      vpsClienteIdentificador: auditFonte?.vpsClienteIdentificador ?? null,
      queryParams: auditFonte?.queryParams ?? {},
      endpoint: auditFonte?.endpoint ?? 'fonte não identificada',
      endpointFinal: auditFonte?.endpointFinal ?? auditFonte?.endpoint ?? 'fonte não identificada',
      statusHttp: auditFonte?.statusHttp ?? null,
      registrosBrutos: auditFonte?.registrosBrutos ?? data.length,
      camposDetectados: auditFonte?.camposDetectados ?? {},
      usouJsonFallback: auditFonte?.fonte === 'json_fallback',
      motivoFallback: auditFonte?.motivoFallback ?? null,
      registrosAbertos: baseAVencer.length,
      registrosNoPeriodo: aVencer.length,
      totalSaldo: totalGeral,
      clientesComSaldo: clientes.length,
      parcelasEmAberto: aVencer.length,
      amostra: aVencer.slice(0, 3).map((d) => ({
        cliente: d.Cliente || d.CodClienteRazao || d.CodCliente,
        duplicata: d.CodDuplicata,
        vencimento: d.DataVencimento,
        saldo: saldoAberto(d),
      })),
    });
  }, [data, auditFonte, periodoApi.dataIni, periodoApi.dataFim, baseAVencer, aVencer, totalGeral, clientes.length]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? clientes.filter(
          (c) => c.cliente.toLowerCase().includes(q) || c.codCliente.toLowerCase().includes(q),
        )
      : clientes;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sortKey === 'cliente') return a.cliente.localeCompare(b.cliente) * dir;
      if (sortKey === 'participacao') return (a.participacao - b.participacao) * dir;
      return (a.total - b.total) * dir;
    });
  }, [clientes, busca, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageItems = filtrados.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: 'cliente' | 'total' | 'participacao') => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'cliente' ? 'asc' : 'desc');
    }
    setPage(0);
  };

  // ---------- Detalhe do cliente ----------
  const detalhe = useMemo(() => {
    if (!clienteSel) return null;
    const docs = aVencerFoco.filter((d) => String(d.CodCliente) === clienteSel);
    const porMes = new Map<string, {
      valor: number;
      sortIndex: number;
      primeiroVencimento: Date | null;
      ultimoVencimento: Date | null;
      itens: {
        pedido: string;
        nf: string;
        parcela: string;
        vencimento: string;
        vencimentoDate: Date | null;
        vendedor: string;
        valorOriginal: number;
        valorRecebido: number;
        valor: number;
        status: string;
      }[];
    }>();
    for (const d of docs) {
      const venc = parseDate(d.DataVencimento);
      const key = venc
        ? `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, '0')}`
        : SEM_VENCIMENTO_KEY;
      const sortIndex = venc ? new Date(venc.getFullYear(), venc.getMonth(), 1).getTime() : Number.MAX_SAFE_INTEGER;
      const cur = porMes.get(key) ?? { valor: 0, sortIndex, primeiroVencimento: venc, ultimoVencimento: venc, itens: [] };
      const v = saldoAberto(d);
      cur.valor += v;
      cur.sortIndex = Math.min(cur.sortIndex, sortIndex);
      if (venc) {
        if (!cur.primeiroVencimento || venc < cur.primeiroVencimento) cur.primeiroVencimento = venc;
        if (!cur.ultimoVencimento || venc > cur.ultimoVencimento) cur.ultimoVencimento = venc;
      }
      cur.itens.push({
        pedido: String((d as any).CodDuplicata ?? '').trim() || '—',
        nf: String((d as any).NumNF ?? '').trim().replace(/^null$/, '') || '',
        parcela: formatParcelaDevedor((d as Record<string, unknown>).Parcela),
        vencimento: venc ? venc.toLocaleDateString('pt-BR') : SEM_VENCIMENTO_LABEL,
        vencimentoDate: venc,
        vendedor: String(d.Vendedor ?? '').trim() || '-',
        valorOriginal: getValorOriginalTitulo(d),
        valorRecebido: getValorRecebidoTitulo(d),
        valor: v,
        status: String(d.Status ?? '').trim() || 'Pendente',
      });
      porMes.set(key, cur);
    }
    const linhas = Array.from(porMes.entries())
      .sort(([, a], [, b]) => a.sortIndex - b.sortIndex)
      .map(([key, info]) => {
        if (key === SEM_VENCIMENTO_KEY) {
          return {
            key,
            label: SEM_VENCIMENTO_LABEL,
            periodoLabel: 'Sem data na fonte',
            primeiroVencimento: null,
            ultimoVencimento: null,
            valor: info.valor,
            itens: info.itens.sort((a, b) => b.valor - a.valor),
            vencidos: 0,
            aVencer: info.itens.length,
            acumulado: 0,
          };
        }
        const [ano, mes] = key.split('-').map(Number);
        const ultimoDia = new Date(ano, mes, 0);
        const primeiroVencimento = info.primeiroVencimento;
        const ultimoVencimento = info.ultimoVencimento;
        const vencidos = info.itens.filter((it) => it.vencimentoDate && it.vencimentoDate < hojeRef).length;
        return {
          key,
          label: `Até ${ultimoDia.toLocaleDateString('pt-BR')}`,
          periodoLabel: primeiroVencimento && ultimoVencimento
            ? `${primeiroVencimento.toLocaleDateString('pt-BR')} a ${ultimoVencimento.toLocaleDateString('pt-BR')}`
            : 'Sem datas validas',
          primeiroVencimento,
          ultimoVencimento,
          valor: info.valor,
          itens: info.itens.sort((a, b) => b.valor - a.valor),
          acumulado: 0,
        };
      });
    let acc = 0;
    linhas.forEach((l) => {
      acc += l.valor;
      l.acumulado = acc;
    });
    const info = clientes.find((c) => c.codCliente === clienteSel);
    return { linhas, total: acc, info, qtd: docs.length };
  }, [clienteSel, aVencerFoco, clientes]);


  const exportRanking = () => {
    const rows = filtrados.map((c) => ({
      'Código': c.codCliente,
      'Cliente': c.cliente,
      'Pedidos/Parcelas': c.qtd,
      'Pedido': c.pedidos,
      'Nota Fiscal': c.notas,
      'Próximo Vencimento': formatDateBR(c.proximoVencimento),
      'Total a Vencer': c.total,
      '% da Carteira': Number(c.participacao.toFixed(2)),
      'Vendedor': c.vendedor,
      'Empresa/Filial': c.empresa,
      'Status': c.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Saldo a Vencer');
    XLSX.writeFile(wb, 'saldo-a-vencer-clientes.xlsx');
  };

  const exportDetalhe = () => {
    if (!detalhe) return;
    const rows: Record<string, string | number>[] = [];
    detalhe.linhas.forEach((l) => {
      const grupo = l.key === SEM_VENCIMENTO_KEY
        ? l.label
        : formatMesAnoBR(new Date(Number(l.key.slice(0, 4)), Number(l.key.slice(5, 7)) - 1, 1));
      rows.push({ 'Mês': grupo, 'Janela de Vencimentos': l.periodoLabel, 'Pedido': '', 'Nota Fiscal': '', 'Valor': l.valor, 'Acumulado': l.acumulado });
      l.itens.forEach((it) => {
        rows.push({
          'Mês': grupo,
          'Janela de Vencimentos': l.periodoLabel,
          'Vencimento': it.vencimento,
          'Pedido': it.pedido,
          'Nota Fiscal': it.nf,
          'Parcela': it.parcela,
          'Vendedor': it.vendedor,
          'Valor Original': it.valorOriginal,
          'Valor Recebido': it.valorRecebido,
          'Valor a Receber': it.valor,
          'Status': it.status,
          'Acumulado': '',
        });
      });
    });
    rows.push({ Vencimento: 'Total', Pedido: '', 'Nota Fiscal': '', Valor: detalhe.total, Acumulado: detalhe.total });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detalhe');
    XLSX.writeFile(wb, `saldo-a-vencer-${clienteSel}.xlsx`);
  };


  if (isLoading) return <LoadingState message="Carregando saldo a vencer..." />;
  if (error)
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="mb-3 flex items-start gap-2 text-destructive">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="font-semibold">Fonte de duplicatas indisponível ou retornando erro</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Erro ao carregar duplicatas, títulos ou parcelas em aberto.'}
            </p>
          </div>
        </div>
        <ErrorState
          title="Não foi possível carregar Saldo a Vencer"
          message="A origem financeira precisa retornar duplicatas/contas a receber/parcelas em aberto. Não será exibido R$ 0,00 enquanto a fonte estiver com erro."
          onRetry={() => refetch()}
          className="py-4"
        />
      </div>
    );

  // Consulta não executada (empresa ativa não resolvida): não mascarar como R$ 0,00
  if (!data)
    return (
      <ErrorState
        title="Fonte de duplicatas não carregada"
        message="A empresa ativa ainda não foi resolvida, portanto nenhuma consulta de duplicatas foi executada. Selecione a empresa e tente novamente — os totais não são exibidos como R$ 0,00 sem dados reais."
        onRetry={() => refetch()}
      />
    );


  // ================= Dashboard 2 =================
  if (clienteSel && detalhe) {
    const primeiraLinha = detalhe.linhas[0];
    const ultimaLinha = detalhe.linhas[detalhe.linhas.length - 1];
    const tituloLinha = (linha?: { key: string; label: string }) => {
      if (!linha) return '-';
      if (linha.key === SEM_VENCIMENTO_KEY) return linha.label;
      return formatMesAnoBR(new Date(Number(linha.key.slice(0, 4)), Number(linha.key.slice(5, 7)) - 1, 1));
    };
    const maiorVencimento = detalhe.linhas.reduce(
      (maior, linha) => (linha.valor > maior.valor ? linha : maior),
      detalhe.linhas[0] ?? { label: '-', valor: 0, itens: [] as { pedido: string }[], acumulado: 0, key: 'vazio' },
    );

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-2">
          <Button variant="ghost" size="sm" onClick={() => setClienteSel(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao ranking
          </Button>
          <Button variant="outline" size="sm" className="sm:ml-auto" onClick={exportDetalhe}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>

        <Card className="overflow-hidden border-border/60">
          <CardContent className="flex flex-wrap items-end justify-between gap-6 p-5">
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold leading-tight">
                {detalhe.info?.cliente ?? clienteSel}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-normal">Código {clienteSel}</Badge>
                <Badge variant="secondary" className="font-normal">{detalhe.qtd} parcelas</Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total a vencer</p>
              <p className="text-3xl font-bold tabular-nums text-primary">{formatCurrency(detalhe.total)}</p>
            </div>
          </CardContent>
        </Card>


        <Card className="overflow-hidden border-border/60">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Auditoria mensal por vencimento</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Parcelas abertas agrupadas por mês de vencimento, com NF/pedido, parcela, original, recebido e saldo líquido.
                </p>
              </div>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                {detalhe.linhas.length} vencimento(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Wallet className="h-4 w-4 text-primary" />
                  Total auditado
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums">{formatCurrency(detalhe.total)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detalhe.qtd} parcela(s) em aberto</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Janela de vencimentos
                </div>
                <p className="mt-3 text-lg font-semibold">
                  {tituloLinha(primeiraLinha)}
                  <span className="mx-2 text-muted-foreground">até</span>
                  {tituloLinha(ultimaLinha)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Ordenado por vencimento</p>
              </div>
              <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-4 w-4 text-amber-400" />
                  Maior vencimento
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums">{formatCurrency(maiorVencimento.valor)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tituloLinha(maiorVencimento)} - {maiorVencimento.itens.length} parcela(s)
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {detalhe.linhas.map((l) => {
                const aberto = vencExpandido === null || vencExpandido === l.key;
                const percentual = detalhe.total > 0 ? (l.valor / detalhe.total) * 100 : 0;
                const mesTitulo = l.key === SEM_VENCIMENTO_KEY
                  ? l.label
                  : formatMesAnoBR(new Date(Number(l.key.slice(0, 4)), Number(l.key.slice(5, 7)) - 1, 1));
                const vencidas = l.itens.filter((it) => it.vencimentoDate && it.vencimentoDate < hojeRef).length;
                const aVencerMes = l.itens.length - vencidas;
                return (
                  <div key={l.key} className="overflow-hidden rounded-lg border border-border/60 bg-card/50">
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/30"
                      onClick={() => setVencExpandido(vencExpandido === l.key ? null : l.key)}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ChevronDown className={`h-4 w-4 transition-transform ${aberto ? '' : '-rotate-90'}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{mesTitulo}</span>
                        <span className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span>{l.periodoLabel}</span>
                          <span>{l.itens.length} parcela(s)</span>
                          <span className="text-emerald-300">{aVencerMes} a vencer</span>
                          {vencidas > 0 && <span className="text-red-300">{vencidas} vencida(s)</span>}
                          <span>{percentual.toFixed(1).replace('.', ',')}% do total</span>
                        </span>
                        <span className="hidden">
                          {l.itens.length} parcela(s) • {percentual.toFixed(1).replace('.', ',')}% do total do cliente
                        </span>
                      </span>
                      <span className="hidden min-w-[180px] sm:block">
                        <span className="block h-2 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, percentual)}%` }} />
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-lg font-bold tabular-nums">{formatCurrency(l.valor)}</span>
                        <span className="text-xs text-muted-foreground">acum. {formatCurrency(l.acumulado)}</span>
                      </span>
                    </button>

                    {aberto && (
                      <div className="border-t border-border/60 bg-background/30">
                        {l.itens.map((it, i) => (
                          <div
                            key={`${l.key}-${it.pedido}-${i}`}
                            className="grid gap-3 border-b border-border/40 px-4 py-3 last:border-b-0 md:grid-cols-[1.5fr_1fr_1fr_auto]"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">Pedido {it.pedido}</span>
                                {it.nf && <Badge variant="secondary" className="font-normal">NF {it.nf}</Badge>}
                                {it.parcela !== '-' && <Badge variant="outline" className="font-normal">Parc. {it.parcela}</Badge>}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Venc. {it.vencimento} • {it.vendedor} • {it.status}
                              </p>
                            </div>
                            <div className="text-sm">
                              <p className="text-muted-foreground">Original</p>
                              <p className="font-semibold tabular-nums">{formatCurrency(it.valorOriginal)}</p>
                            </div>
                            <div className="text-sm">
                              <p className="text-muted-foreground">Recebido</p>
                              <p className="font-semibold tabular-nums">{formatCurrency(it.valorRecebido)}</p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-muted-foreground">Saldo</p>
                              <p className="text-lg font-bold tabular-nums text-primary">{formatCurrency(it.valor)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3">
              <span className="text-sm font-semibold">Total geral auditado</span>
              <span className="text-2xl font-bold tabular-nums text-primary">{formatCurrency(detalhe.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ================= Dashboard 1 =================
  return (
    <div className="space-y-4 animate-fade-in">
      {semCamposSaldo && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Fonte de pedidos carregada, mas não foram encontrados campos de saldo/pagamento para calcular Saldo a Vencer.
          </span>
        </div>
      )}


      <SaldoAVencerKpis
        totais={{
          total: totalizadores.total,
          parcelas: totalizadores.parcelas,
          clientes: totalizadores.clientes,
          a_vencer: totalizadores.a_vencer,
          vencido: totalizadores.vencido,
        }}
        registros={kpiRegistros}
        foco={foco}
        onFocoChange={(f) => {
          setFoco(f);
          setPage(0);
        }}
        contexto={kpiContexto}
      />



      {foco && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setFoco(null)}>
            Limpar seleção
          </Button>
        </div>
      )}

      <Card className="overflow-hidden border-border/60 bg-card/70">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="rounded-lg bg-primary/15 p-2 text-primary">
                <Wallet className="h-4 w-4" />
              </span>
              Clientes com Saldo a Vencer
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Carteira ordenada pelo valor liquido a receber, com auditoria por pedido e vencimento.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={draftBusca}
                onChange={(e) => setDraftBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') aplicarBuscaLocal();
                }}
                placeholder="Buscar por nome ou código"
                className="w-[240px] pl-8"
              />
            </div>
            <Button size="sm" onClick={aplicarBuscaLocal}>
              <Search className="mr-2 h-4 w-4" /> Buscar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraftBusca('');
                setBusca('');
                setPage(0);
              }}
            >
              Limpar
            </Button>
            <Button variant="outline" size="sm" onClick={exportRanking}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
          </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Valor liquido a receber</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-emerald-300">
                {formatCurrency(filtrados.reduce((s, c) => s + c.total, 0))}
              </p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Clientes no filtro</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{filtrados.length}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Parcelas abertas</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-foreground">
                {filtrados.reduce((s, c) => s + c.qtd, 0)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleSort('total')}>
              Valor <ArrowUpDown className="ml-1 h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleSort('cliente')}>
              Cliente <ArrowUpDown className="ml-1 h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleSort('participacao')}>
              Participacao <ArrowUpDown className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/35">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2 text-center">#</th>
                <th className="cursor-pointer px-4 py-2 text-center" onClick={() => toggleSort('cliente')}>
                  <span className="inline-flex items-center justify-center gap-1">Cliente <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-4 py-2 text-center">Pedido / NF</th>
                <th className="px-4 py-2 text-center">Próx. vencimento</th>
                <th className="cursor-pointer px-4 py-2 text-center" onClick={() => toggleSort('total')}>
                  <span className="inline-flex items-center justify-center gap-1">Total a vencer <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="cursor-pointer px-4 py-2 text-center" onClick={() => toggleSort('participacao')}>
                  <span className="inline-flex items-center justify-center gap-1">% carteira <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-4 py-2 text-center">Vendedor</th>
                <th className="px-4 py-2 text-center">Empresa/Filial</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c, i) => (
                <tr
                  key={c.codCliente}
                  onClick={() => setClienteSel(c.codCliente)}
                  className="cursor-pointer border-b border-border/50 text-center transition-colors hover:bg-primary/5"
                >
                  <td className="px-4 py-2 text-center text-muted-foreground">{pageSafe * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="font-medium">{c.cliente}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.codCliente} · {c.qtd} pedidos em aberto
                    </div>
                    <div className="mx-auto mt-1 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(c.total / maiorSaldo) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center text-xs">
                    <div>{c.pedidos || '—'}</div>
                    <div className="text-muted-foreground">{c.notas ? `NF ${c.notas}` : ''}</div>
                  </td>
                  <td className="px-4 py-2 text-center">{formatDateBR(c.proximoVencimento)}</td>
                  <td className="px-4 py-2 text-center font-semibold tabular-nums">{formatCurrency(c.total)}</td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant="secondary">{formatPercent(c.participacao)}</Badge>
                  </td>
                  <td className="px-4 py-2 text-center text-xs">{c.vendedor || '—'}</td>
                  <td className="px-4 py-2 text-center text-xs">{c.empresa || '—'}</td>
                  <td className="px-4 py-2 text-center text-xs">{c.status || '—'}</td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum cliente com saldo a vencer no filtro atual.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-muted/60 text-center font-bold">
                <td className="px-4 py-2 text-center" colSpan={4}>
                  Total geral ({filtrados.length} clientes)
                </td>
                <td className="px-4 py-2 text-center tabular-nums">
                  {formatCurrency(filtrados.reduce((s, c) => s + c.total, 0))}
                </td>
                <td className="px-4 py-2" colSpan={4} />
              </tr>
            </tfoot>
          </table>
          </div>


          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1 border-t p-3">
              {buildPageWindow(pageSafe, totalPages).map((p, idx) =>
                p === '...' ? (
                  <span key={`d${idx}`} className="px-2 text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={p}
                    size="sm"
                    variant={p === pageSafe ? 'default' : 'outline'}
                    onClick={() => setPage(p)}
                  >
                    {p + 1}
                  </Button>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
