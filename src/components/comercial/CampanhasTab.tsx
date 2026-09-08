import { useCallback, useMemo, useState, useEffect } from 'react';
import { useCampanhas, type Campanha, type CampanhaInput, type CampanhaMarca } from '@/hooks/useCampanhas';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Trophy, Plus, Pencil, Trash2, Target, Sparkles, Calendar, Gift,
  TrendingUp, AlertTriangle, ArrowUpRight, Minus, Crown, Medal,
  Award, DollarSign, Wallet, Filter, X, MessageSquare, Info, ChevronDown,
  Calculator, Zap, Flame,
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { nomePertenceEquipe } from '@/utils/filialFilter';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { valorFaturamentoCampanha, valorFaturamentoMwmFat1004 } from '@/utils/campanhasValores';
import {
  VENDEDORES_CT_CAMPANHA_1004,
  VENDEDORES_EXTRAS_CAMPANHA_1004,
  vendedorExtraCampanha1004Selecionavel,
  vendedorPertenceCampanha1004,
} from '@/utils/campanhasVendedores';
import {
  VENDEDORES_EXTRAS_CAMPANHA_1004 as VENDEDORES_EXTRAS_CAMPANHA_1004_LABELS,
} from '@/utils/vendedores1004';
import {
  fimConsolidadoCampanha1004,
  mesesCampanha1004,
  periodoBuscaCampanha1004,
} from '@/utils/campanhasPeriodo1004';

const VENDEDORES_CT_CAMPANHA_1004_LABELS = [
  { codigo: '78', nome: 'BRUNO' },
  { codigo: '98', nome: 'DANIEL' },
  { codigo: '59', nome: 'ERLAN' },
  { codigo: '63', nome: 'FABIO R' },
  { codigo: '71', nome: 'PAULO HENRIQUE' },
];

type CampanhaItem = Record<string, unknown> & {
  tipo?: string;
  data_faturamento?: string;
  data_pedido?: string;
  nome_externo?: string;
  nome_interno?: string;
  vendedor_nome?: string;
  marca?: string;
  descricao?: string;
  produto?: string;
  grupo?: string;
  grupo_produto?: string;
  cliente_razao?: string;
  nome_grupo?: string;
  cod_produto?: string | number;
  quantidade?: number;
  cod_pedido?: string | number;
  id?: string | number;
};

// Input monetário BRL: digita como cents, mostra 1.234.567,89
function MoneyInputBRL({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: {
  value: number | undefined | null;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const formatted = (() => {
    const n = Number(value || 0);
    if (!n) return '';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  })();
  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={formatted}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        if (!digits) { onChange(0); return; }
        onChange(Number(digits) / 100);
      }}
    />
  );
}

interface MarcaCalculada extends CampanhaMarca {
  realizado: number;
  progresso: number;
  premio: number;
  atingiu: boolean;
}

interface CampanhaCalculada extends Campanha {
  marcasCalc: MarcaCalculada[];
  realizadoTotal: number;
  vendasTotaisMes: number;
  metaCampanhaTotal: number;
  progressoGeral: number;
  premioTotal: number;
  diasRestantes: number;
  bonusGanho: boolean;
  encerrada: boolean;
  vendedoresContrib: { nome: string; valor: number }[];
  statusVisual: 'on-track' | 'risk' | 'achieved' | 'expired';
  itensPeriodo: CampanhaItem[];
  rankingCodEmpresaBi?: string | null;
  rankingFilialAtiva?: string | null;
  rankingVendedoresExtras1004?: string[];
}

function diffDays(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

function monthsBetween(ini: Date, fim: Date) {
  return Math.max(1, (fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

function campanhaEstaEncerrada(campanha: Pick<Campanha, 'data_fim' | 'status'> & { statusVisual?: CampanhaCalculada['statusVisual'] }) {
  const fim = dateLocalCampanha(campanha.data_fim, true);
  const hoje = new Date();
  const hojeInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const status = normalizarTextoCampanha(campanha.status);
  return campanha.statusVisual === 'expired' || status === 'ENCERRADA' || status === 'ENCERRADO' || fim < hojeInicio;
}

function valorBrutoCampanha(
  p: CampanhaItem,
  _codEmpresaBi?: string | null,
  marcasCampanha?: Array<Pick<CampanhaMarca, 'marca'>>,
) {
  const isMwmCampanha1004 = String(_codEmpresaBi || '') === '1004'
    && (marcasCampanha || []).some(m => normalizarTextoCampanha(m.marca) === 'MWM')
    && itemPertenceMarcaCampanha(p, 'MWM', _codEmpresaBi);

  if (isMwmCampanha1004) {
    return valorFaturamentoMwmFat1004(p ?? {}, _codEmpresaBi);
  }

  return valorFaturamentoCampanha(p ?? {}, _codEmpresaBi);
}

function normalizarTextoCampanha(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function dateKeyCampanha(value: unknown) {
  const s = String(value ?? '');
  const match = s.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateLocalCampanha(value: unknown, fimDoDia = false) {
  const key = dateKeyCampanha(value);
  if (!key) return new Date(String(value ?? ''));
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, fimDoDia ? 23 : 0, fimDoDia ? 59 : 0, fimDoDia ? 59 : 0, fimDoDia ? 999 : 0);
}

function itemFaturadoNoPeriodoCampanha(p: CampanhaItem, inicioKey: string, fimKey: string) {
  // Inclui PEDIDO e DEVOLUCAO; o tratamento do valor depende da empresa.
  if (p.tipo !== 'PEDIDO' && p.tipo !== 'DEVOLUCAO') return false;
  const dt = dateKeyCampanha(p.data_faturamento);
  return !!dt && dt >= inicioKey && dt <= fimKey;
}

function nomeVendedorCampanha(p: CampanhaItem) {
  return (p.nome_externo || p.nome_interno || p.vendedor_nome || '').toString().trim();
}

function pertenceEquipeCampanha(p: CampanhaItem, codEmpresaBi?: string | null, filialAtiva?: string | null) {
  const nome = nomeVendedorCampanha(p);
  return !!nome && nomePertenceEquipe(nome, codEmpresaBi, filialAtiva);
}

function normalizarVendedorExtraFiltroCampanha1004(value: unknown): string | null {
  const code = vendedorExtraCampanha1004Selecionavel(value);
  if (code) return code;

  const nome = normalizarTextoCampanha(value);
  if (!nome) return null;
  if (nome.includes('ELIANE')) return '99';
  if (nome.includes('MARCIO')) return '11';
  if (nome.includes('FERNANDO')) return '34';
  if (nome.includes('RAFAEL')) return '47';
  return null;
}

function getVendedoresExtrasCampanha1004(item: Pick<CampanhaCalculada, 'rankingVendedoresExtras1004'>) {
  return new Set(item.rankingVendedoresExtras1004 || []);
}

function campanhaMwm1004(campanha: Pick<Campanha, 'cod_empresa_bi' | 'nome' | 'marcas'>) {
  const codEmpresa = String(campanha.cod_empresa_bi ?? '').trim();
  const nome = normalizarTextoCampanha(campanha.nome);
  const marcas = (campanha.marcas || [])
    .map((marca) => normalizarTextoCampanha(typeof marca === 'string' ? marca : marca?.marca))
    .join(' ');

  return codEmpresa === '1004' && (nome.includes('MWM') || marcas.includes('MWM'));
}

function vendedoresExtrasPadraoCampanha1004(_campanha: Pick<Campanha, 'cod_empresa_bi' | 'nome' | 'data_fim' | 'marcas'>) {
  return [] as string[];
}

function vendedoresExtrasEfetivosCampanha1004(
  campanha: Pick<Campanha, 'cod_empresa_bi' | 'nome' | 'data_fim' | 'marcas'>,
  selecionados?: Set<string>,
) {
  const base = new Set<string>(vendedoresExtrasPadraoCampanha1004(campanha));
  selecionados?.forEach(codigo => base.add(codigo));
  return base;
}

function itemElegivelTotalCampanha(
  p: CampanhaItem,
  codEmpresaBi?: string | null,
  vendedoresExtrasSelecionados1004?: Set<string>,
) {
  const vendedor = normalizarTextoCampanha(nomeVendedorCampanha(p));
  if (!vendedor) return false;
  if (vendedor.includes('ESTOQUE')) return false;
  if (String(codEmpresaBi || '') === '1004') {
    if (!vendedorPertenceCampanha1004(p, vendedoresExtrasSelecionados1004)) return false;
  }
  return true;
}

function itemPertenceEscopoCampanha(
  p: CampanhaItem,
  codEmpresaBi?: string | null,
  filialAtiva?: string | null,
  vendedoresExtrasSelecionados1004?: Set<string>,
) {
  if (usaTotalBrutoApiCampanha(codEmpresaBi)) return true;
  if (String(codEmpresaBi || '') === '1004') {
    return vendedorPertenceCampanha1004(p, vendedoresExtrasSelecionados1004);
  }
  return pertenceEquipeCampanha(p, codEmpresaBi, filialAtiva);
}

function itemPertenceMarcaCampanha(
  p: CampanhaItem,
  marca: string,
  codEmpresaBi?: string | null,
) {
  const marcaCampanha = normalizarTextoCampanha(marca);
  const marcaItem = normalizarTextoCampanha(p?.marca);
  const produto = normalizarTextoCampanha(p?.descricao || p?.produto);
  const grupo = normalizarTextoCampanha(p?.grupo || p?.grupo_produto);

  // Cliente 1004: o relatório oficial da campanha MWM é por grupo de produto
  // (MWM, MWM SPRINT, MWM INTERNATIONAL, MASTER PARTS etc.), não só pela marca.
  // EATON aceita adicionalmente DESATIVADO/SUBSTITUIDO com "EATON" no nome do produto,
  // mas o relatorio oficial da campanha nao considera VW nem CASCOS DE EMBREAGENS.
  if (String(codEmpresaBi || '') === '1004') {
    if (marcaCampanha === 'MWM') return grupo.startsWith('MWM');
    if (marcaCampanha === 'EATON' && (grupo === 'VW' || grupo === 'CASCOS DE EMBREAGENS')) return false;
    if (marcaCampanha === 'EATON' && grupo.startsWith('EATON')) return true;
    if (marcaItem === marcaCampanha) {
      return true;
    }
    if (marcaCampanha === 'EATON' && marcaItem === 'DESATIVADO/SUBSTITUIDO' && produto.includes('EATON')) return true;
    return false;
  }

  if (marcaItem === marcaCampanha) {
    // A planilha oficial nao classifica itens dos grupos VW/CASCOS dentro da campanha EATON.
    if (marcaCampanha === 'EATON' && (grupo === 'VW' || grupo === 'CASCOS DE EMBREAGENS')) return false;
    return true;
  }

  // No JSON alguns retentores EATON vêm com marca DESATIVADO/SUBSTITUIDO,
  // mas o Excel da campanha classifica pelo nome do produto.
  if (marcaCampanha === 'EATON' && marcaItem === 'DESATIVADO/SUBSTITUIDO' && produto.includes('EATON')) {
    return true;
  }

  // Para MWM, a planilha oficial também classifica itens cujo GRUPO começa com "MWM"
  // mesmo quando a marca do item é INTERNATIONAL, MASTER PARTS, DESATIVADO/SUBSTITUIDO, etc.
  if (marcaCampanha === 'MWM' && grupo.startsWith('MWM')) {
    return true;
  }

  return false;
}

function usaTotalBrutoApiCampanha(_codEmpresaBi?: string | null) {
  // Passamos a aplicar filtro estrito de equipe também para 1004,
  // eliminando vendedores CCH/ESTOQUE/fora de equipe do ranking e totais.
  return false;
}
function clampPeriodo(
  campanhaInicio: Date,
  campanhaFim: Date,
  filtroInicio?: string,
  filtroFim?: string,
) {
  const inicioFiltro = filtroInicio ? dateLocalCampanha(filtroInicio) : null;
  const fimFiltro = filtroFim ? dateLocalCampanha(filtroFim, true) : null;

  const inicio = inicioFiltro && !isNaN(inicioFiltro.getTime()) && inicioFiltro > campanhaInicio
    ? inicioFiltro
    : campanhaInicio;
  const fim = fimFiltro && !isNaN(fimFiltro.getTime()) && fimFiltro < campanhaFim
    ? fimFiltro
    : campanhaFim;

  if (inicio > fim) return null;

  return { inicio, fim };
}

function normalizeMarcaCampanha(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function marcaCampanhaMatches(itemMarca: unknown, campanhaMarca: unknown): boolean {
  const item = normalizeMarcaCampanha(itemMarca);
  const campanha = normalizeMarcaCampanha(campanhaMarca);

  if (!item || !campanha) return false;
  if (item === campanha) return true;

  return item.includes(campanha) || campanha.includes(item);
}
interface CampanhasTabProps {
  periodoFiltro?: { inicio: string; fim: string };
  vendedoresFiltro?: Array<string | number>;
  vendedorFiltro?: string | number;
}

export function CampanhasTab({ periodoFiltro }: CampanhasTabProps = {}) {
  const { campanhas, isLoading, create, update, remove, isMutating } = useCampanhas();
  const [statusFilter, setStatusFilter] = useState<string>('todas');
  const [marcaFilter, setMarcaFilter] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [vendedoresExtras1004, setVendedoresExtras1004] = useState<string[]>([]);
  const [vendedoresExtras1004Inicializados, setVendedoresExtras1004Inicializados] = useState(false);
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const vendedoresExtrasSelecionados1004 = useMemo(
    () => new Set(vendedoresExtras1004),
    [vendedoresExtras1004],
  );

  useEffect(() => {
    if (vendedoresExtras1004Inicializados) return;
    if (!campanhas.some(campanhaMwm1004)) return;
    setVendedoresExtras1004([...VENDEDORES_EXTRAS_CAMPANHA_1004]);
    setVendedoresExtras1004Inicializados(true);
  }, [campanhas, vendedoresExtras1004Inicializados]);

  // Período usado no cálculo: respeita o filtro do dashboard quando houver interseção,
  // mas não deixa uma campanha histórica zerar quando o dashboard está em outro mês.
  const periodoCampanhas = useMemo(() => {
    if (periodoFiltro?.inicio && periodoFiltro?.fim) return periodoFiltro;
    if (campanhas.length === 0) return undefined;
    const inicios = campanhas.map(c => c.data_inicio).sort();
    const fins = campanhas.map(c => c.data_fim).sort();
    return { inicio: inicios[0], fim: fins[fins.length - 1] };
  }, [campanhas, periodoFiltro]);

  // Período usado na busca dos itens: precisa cobrir as datas das campanhas.
  // Antes ele usava só o filtro do dashboard; no cliente 1004 o filtro padrão estava em julho,
  // enquanto a campanha cadastrada é maio/junho, então /comercial/produtos voltava itens de julho
  // e o realizado das campanhas ficava todo zerado.
  const periodoProdutosCampanhas = useMemo(() => {
    if (campanhas.length === 0) return periodoCampanhas;
    const periodos = campanhas.map(c => periodoBuscaCampanha1004(c));
    const inicios = periodos.map(p => p.inicio).sort();
    const fins = periodos.map(p => p.fim).sort();
    return { inicio: inicios[0], fim: fins[fins.length - 1] };
  }, [campanhas, periodoCampanhas]);

  const { produtos } = useComercialProdutos(
    periodoProdutosCampanhas ? { periodo: periodoProdutosCampanhas, ignorarEquipePadrao: true } : { ignorarEquipePadrao: true },
  );

  // Calcula progresso por marca em cada campanha
  const campanhasCalc = useMemo<CampanhaCalculada[]>(() => {
    const hoje = new Date();
    return campanhas.map(c => {
      const ini = dateLocalCampanha(c.data_inicio);
      const fim = dateLocalCampanha(c.data_fim, true);
      const periodoAnalise = clampPeriodo(ini, fim, periodoCampanhas?.inicio, periodoCampanhas?.fim);
      const inicioAnalise = periodoAnalise?.inicio ?? ini;
      const fimAnalise = periodoAnalise?.fim ?? fim;
      const fimAnaliseConsolidado = fimConsolidadoCampanha1004(c, fimAnalise, hoje);
      const inicioKey = dateKeyCampanha(inicioAnalise);
      const fimKey = dateKeyCampanha(fimAnaliseConsolidado);
      const meses = monthsBetween(inicioAnalise, fimAnalise);

      // Compat: se não tiver marcas[], usa o campo legado marca/meta_valor
      const marcasArr: CampanhaMarca[] = c.marcas && c.marcas.length > 0
        ? c.marcas
        : c.marca
          ? [{ marca: c.marca, meta_mensal: Number(c.meta_valor || 0) / meses, percentual_premio: 0 }]
          : [];

      // Filtra produtos do período — SOMENTE PEDIDOS FATURADOS (venda bruta)
      const itensPeriodo = produtos.filter(p => {
        return itemFaturadoNoPeriodoCampanha(p, inicioKey, fimKey);
      });

      const vendedoresExtrasCampanha1004 = vendedoresExtrasEfetivosCampanha1004(c, vendedoresExtrasSelecionados1004);
      const itensCampanha = itensPeriodo.filter(
        p => itemElegivelTotalCampanha(p, codEmpresaAtiva, vendedoresExtrasCampanha1004)
          && itemPertenceEscopoCampanha(p, codEmpresaAtiva, filialAtiva, vendedoresExtrasCampanha1004)
          && marcasArr.some(m => itemPertenceMarcaCampanha(p, m.marca, codEmpresaAtiva)),
      );
      const itensTotalPeriodo = itensPeriodo.filter(
        p => itemElegivelTotalCampanha(p, codEmpresaAtiva, vendedoresExtrasCampanha1004)
          && itemPertenceEscopoCampanha(p, codEmpresaAtiva, filialAtiva, vendedoresExtrasCampanha1004),
      );
      const itensRanking = itensCampanha;

      // Calcula realizado por marca (venda bruta = valor absoluto)
      const marcasCalc: MarcaCalculada[] = marcasArr.map(m => {
        const marcaUpper = m.marca.trim().toUpperCase();
        const itensMarca = itensCampanha.filter(p => itemPertenceMarcaCampanha(p, marcaUpper, codEmpresaAtiva));
        const realizado = itensMarca.reduce((acc, p) => acc + valorBrutoCampanha(p, codEmpresaAtiva, marcasArr), 0);
        const metaPeriodo = Number(m.meta_mensal) * meses;
        const progresso = metaPeriodo > 0 ? Math.min(150, (realizado / metaPeriodo) * 100) : 0;
        const atingiu = realizado >= metaPeriodo && metaPeriodo > 0;
        const percent = Number(m.percentual_premio || 0);
        const fixo = Number(m.premio_fixo || 0);
        const premio = atingiu ? (percent > 0 ? metaPeriodo * (percent / 100) : fixo) : 0;
        return { ...m, realizado, progresso, premio, atingiu };
      });

      const realizadoTotal = itensCampanha.reduce((acc, p) => acc + valorBrutoCampanha(p, codEmpresaAtiva, marcasArr), 0);
      const vendasTotaisMes = itensTotalPeriodo.reduce((acc, p) => acc + valorBrutoCampanha(p, codEmpresaAtiva, marcasArr), 0);
      const metaCampanhaTotal = Number(c.meta_geral_mensal || 0) * meses;
      const progressoGeral = metaCampanhaTotal > 0 ? Math.min(150, (vendasTotaisMes / metaCampanhaTotal) * 100) : 0;
      const bonusGanho = vendasTotaisMes >= metaCampanhaTotal && metaCampanhaTotal > 0;
      const premioTotal = marcasCalc.reduce((a, m) => a + m.premio, 0) + (bonusGanho ? Number(c.bonus_meta_geral || 0) : 0);
      const encerrada = campanhaEstaEncerrada(c);

      // Ranking vendedores (apenas itens das marcas da campanha — venda bruta)
      const vendMap = new Map<string, number>();
      itensRanking.forEach(p => {
        const nome = nomeVendedorCampanha(p);
        if (!nome) return;
        vendMap.set(nome, (vendMap.get(nome) || 0) + valorBrutoCampanha(p, codEmpresaAtiva, marcasArr));
      });
      const vendedoresContrib = Array.from(vendMap.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor);

      const diasRestantes = hoje > fim ? 0 : diffDays(hoje, fim);
      let statusVisual: CampanhaCalculada['statusVisual'] = 'on-track';
      if (encerrada) statusVisual = 'expired';
      else if (progressoGeral >= 100) statusVisual = 'achieved';
      else if (progressoGeral < 60 && diasRestantes < diffDays(ini, fim) / 2) statusVisual = 'risk';

      return {
        ...c,
        marcasCalc,
        realizadoTotal,
        vendasTotaisMes,
        metaCampanhaTotal,
        progressoGeral,
        premioTotal,
        diasRestantes,
        bonusGanho,
        encerrada,
        vendedoresContrib,
        statusVisual,
        itensPeriodo,
        rankingCodEmpresaBi: codEmpresaAtiva,
        rankingFilialAtiva: filialAtiva,
        rankingVendedoresExtras1004: Array.from(vendedoresExtrasCampanha1004),
      };
    });
  }, [campanhas, produtos, codEmpresaAtiva, filialAtiva, periodoCampanhas, vendedoresExtrasSelecionados1004]);

  const marcasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    // Marcas de todas as vendas no banco
    produtos.forEach(p => {
      const m = (p.marca || '').toString().trim();
      if (m) set.add(m);
    });
    // Garante marcas já cadastradas em campanhas mesmo sem venda no período
    campanhasCalc.forEach(c => c.marcasCalc.forEach(m => m.marca && set.add(m.marca.trim())));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [produtos, campanhasCalc]);

  const campanhasFiltradas = useMemo(() => {
    const marcasSel = marcaFilter.map(m => m.trim().toUpperCase());
    return campanhasCalc.filter(c => {
      if (statusFilter !== 'todas' && c.status !== statusFilter) return false;
      if (marcasSel.length > 0 && !c.marcasCalc.some(m => marcasSel.includes(m.marca.trim().toUpperCase()))) return false;
      return true;
    });
  }, [campanhasCalc, statusFilter, marcaFilter]);

  const campanhasAtivasResumo = useMemo(
    () => campanhasFiltradas.filter(c => !c.encerrada),
    [campanhasFiltradas],
  );

  // KPIs gerais + comparativo (mês anterior usando produtos histórico)
  const kpis = useMemo(() => {
    const hoje = new Date();
    const metaMensal = campanhasAtivasResumo.reduce((acc, c) => acc + Number(c.meta_geral_mensal || 0), 0);
    const metaTotal = campanhasAtivasResumo.reduce((acc, c) => acc + c.metaCampanhaTotal, 0);
    const realizadoTotal = campanhasAtivasResumo.reduce((acc, c) => acc + c.vendasTotaisMes, 0);
    const premioTotal = campanhasAtivasResumo.reduce((acc, c) => {
      const porMarca = c.marcasCalc.reduce((a, m) => {
        if (m.percentual_premio > 0) return a + (Number(m.meta_mensal) * monthsBetween(new Date(c.data_inicio), new Date(c.data_fim)) * (m.percentual_premio / 100));
        return a + Number(m.premio_fixo || 0);
      }, 0);
      return acc + porMarca + Number(c.bonus_meta_geral || 0);
    }, 0);
    const progressoGeral = metaTotal > 0 ? (realizadoTotal / metaTotal) * 100 : 0;
    const faltante = Math.max(0, metaTotal - realizadoTotal);

    // Comparativo: realizado mês atual vs mês anterior (todas as vendas no produtos)
    const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioMesAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fimMesAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    let realMesAtual = 0, realMesAnt = 0;
    produtos.forEach(p => {
      const dt = p.data_faturamento || p.data_pedido;
      if (!dt) return;
      const d = new Date(dt);
      if (isNaN(d.getTime())) return;
      const v = p.valor_total || 0;
      if (d >= inicioMesAtual && d <= hoje) realMesAtual += v;
      else if (d >= inicioMesAnt && d <= fimMesAnt) realMesAnt += v;
    });
    const variacaoMes = realMesAnt > 0 ? ((realMesAtual - realMesAnt) / realMesAnt) * 100 : 0;
    const campanhasAtivasCount = campanhasAtivasResumo.length;

    // Diário sugerido para bater meta no horizonte das ativas
    const diasMaxRest = campanhasAtivasResumo.reduce((m, c) => Math.max(m, c.diasRestantes), 0) || 1;
    const diarioSugerido = faltante / diasMaxRest;

    return { metaMensal, metaTotal, realizadoTotal, premioTotal, progressoGeral, faltante, variacaoMes, campanhasAtivasCount, diarioSugerido };
  }, [campanhasAtivasResumo, produtos]);

  // Insights IA (consolidados)
  const insightsQuery = useQuery({
    queryKey: ['campanhas-insights', campanhasFiltradas.map(c => `${c.id}:${Math.round(c.realizadoTotal)}`).join(',')],
    enabled: campanhasFiltradas.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const payload = campanhasFiltradas.map(c => ({
        id: c.id, nome: c.nome, status: c.status,
        meta_geral: c.metaCampanhaTotal, realizado: c.realizadoTotal,
        progresso: c.progressoGeral, dias_restantes: c.diasRestantes,
        marcas: c.marcasCalc.map(m => ({
          marca: m.marca, meta: Number(m.meta_mensal) * monthsBetween(new Date(c.data_inicio), new Date(c.data_fim)),
          realizado: m.realizado, progresso: m.progresso,
        })),
      }));
      const { data, error } = await supabase.functions.invoke('campanhas-insights', { body: { campanhas: payload } });
      if (error) throw error;
      return (data?.insights || []) as Array<{ tipo: string; titulo: string; descricao: string }>;
    },
  });

  if (isLoading) return <CampanhasSkeleton />;

  return (
    <TooltipProvider>
      <div className="space-y-4 animate-fade-in">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Trophy className="h-7 w-7 text-primary" />
              Campanhas
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Gestão de metas por marca, premiação e performance comercial
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
              <Filter className="h-3.5 w-3.5" /> Filtros:
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9 rounded-lg">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos status</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="pausada">Rascunho</SelectItem>
                <SelectItem value="encerrada">Encerrada</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-lg gap-1.5 min-w-[160px] justify-between font-normal">
                  <span className="truncate">
                    {marcaFilter.length === 0
                      ? 'Todas as marcas'
                      : marcaFilter.length === 1
                        ? marcaFilter[0]
                        : `${marcaFilter.length} marcas`}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Marcas</span>
                  {marcaFilter.length > 0 && (
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => setMarcaFilter([])}>
                      Limpar
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {marcasDisponiveis.length === 0 && (
                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">Sem marcas disponíveis</p>
                  )}
                  {marcasDisponiveis.map(m => {
                    const checked = marcaFilter.includes(m);
                    return (
                      <label key={m} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/60 cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setMarcaFilter(prev => v ? [...prev, m] : prev.filter(x => x !== m));
                          }}
                        />
                        <span className="truncate">{m}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            {String(codEmpresaAtiva || '') === '1004' && (
              <CampanhaVendedoresFiltro1004
                selectedExtras={vendedoresExtras1004}
                onChange={setVendedoresExtras1004}
              />
            )}
            <CampanhaDialog
              onSubmit={async (input) => { await create(input); }}
              isPending={isMutating}
              marcasDisponiveis={marcasDisponiveis}
              trigger={
                <Button size="sm" className="h-9 gap-1.5 rounded-lg">
                  <Plus className="h-4 w-4" /> Nova Campanha
                </Button>
              }
            />
          </div>
        </div>

        {/* HERO PROGRESSO */}
        <ProgressHero
          progresso={kpis.progressoGeral}
          realizado={kpis.realizadoTotal}
          meta={kpis.metaTotal}
          faltante={kpis.faltante}
          diarioSugerido={kpis.diarioSugerido}
          premioTotal={kpis.premioTotal}
          campanhas={campanhasAtivasResumo}
        />


        {/* INSIGHTS IA */}
        {(insightsQuery.data && insightsQuery.data.length > 0) && (
          <Card className="rounded-lg border-primary/20 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10"><Sparkles className="h-4 w-4 text-primary" /></div>
                Insights Inteligentes
                <Badge variant="outline" className="ml-1 text-[10px] border-primary/30 text-primary">IA</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {insightsQuery.data.map((ins, i) => (
                <div key={i} className={cn(
                  'rounded-lg border p-4 transition-colors animate-fade-in',
                  ins.tipo === 'alerta' && 'bg-destructive/5 border-destructive/20',
                  ins.tipo === 'oportunidade' && 'bg-emerald-500/5 border-emerald-500/20',
                  (ins.tipo !== 'alerta' && ins.tipo !== 'oportunidade') && 'bg-primary/5 border-primary/20',
                )} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-start gap-2.5">
                    {ins.tipo === 'alerta' && <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                    {ins.tipo === 'oportunidade' && <ArrowUpRight className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />}
                    {ins.tipo !== 'alerta' && ins.tipo !== 'oportunidade' && <Minus className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight">{ins.titulo}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">{ins.descricao}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* LISTA DE CAMPANHAS */}
        {campanhasFiltradas.length === 0 ? (
          <EmptyCampanhas onCreate={async (i) => { await create(i); }} isPending={isMutating} />
        ) : (
          <div className="space-y-3">
            {campanhasFiltradas.map(c => (
              <CampanhaFullCard
                key={c.id}
                c={c}
                expanded={expandedId === c.id}
                onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                onUpdate={async (input) => { await update({ id: c.id, ...input }); }}
                onDelete={async () => { await remove(c.id); }}
                isMutating={isMutating}
                marcasDisponiveis={marcasDisponiveis}
                vendedoresExtras1004={vendedoresExtras1004}
              />
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// =================== Progress Hero ===================

function ProgressHero({ progresso, realizado, meta, faltante, diarioSugerido, premioTotal, campanhas }: {
  progresso: number; realizado: number; meta: number; faltante: number; diarioSugerido: number; premioTotal: number;
  campanhas: CampanhaCalculada[];
}) {
  const campanhasAtivas = useMemo(
    () => campanhas.filter(c => !c.encerrada && !campanhaEstaEncerrada(c)),
    [campanhas],
  );
  const heroResumo = useMemo(() => {
    const metaAtiva = campanhasAtivas.reduce((acc, c) => {
      const meses = Math.max(1, monthsBetween(new Date(c.data_inicio), new Date(c.data_fim)));
      const metaMarcas = c.marcasCalc.reduce((total, marca) => total + (Number(marca.meta_mensal || 0) * meses), 0);
      return acc + (metaMarcas || c.metaCampanhaTotal);
    }, 0);
    const realizadoAtivo = campanhasAtivas.reduce((acc, c) => acc + c.realizadoTotal, 0);
    const faltanteAtivo = Math.max(0, metaAtiva - realizadoAtivo);
    const diasMaxRest = campanhasAtivas.reduce((m, c) => Math.max(m, c.diasRestantes), 0) || 1;
    const progressoAtivo = metaAtiva > 0 ? (realizadoAtivo / metaAtiva) * 100 : 0;
    return {
      progresso: progressoAtivo,
      realizado: realizadoAtivo,
      meta: metaAtiva,
      faltante: faltanteAtivo,
      diarioSugerido: faltanteAtivo / diasMaxRest,
    };
  }, [campanhasAtivas]);
  const campanhaAtivaLabel = campanhasAtivas.length === 1
    ? campanhasAtivas[0].nome
    : `${campanhasAtivas.length} campanhas ativas`;
  const progressoCt = meta > 0 ? (realizado / meta) * 100 : 0;
  const faltanteCt = Math.max(0, meta - realizado);
  const cor = getCampaignProgressTone(heroResumo.progresso);
  const corCt = getCampaignProgressTone(progressoCt);

  if (heroResumo.meta === 0) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <CampaignSummaryCard
        icon={<Target className="h-3.5 w-3.5 text-primary" />}
        title="Meta total da CT"
        subtitle="Todas as marcas do período"
        value={realizado}
        meta={meta}
        progresso={progressoCt}
        faltante={faltanteCt}
        diarioSugerido={diarioSugerido}
        tone={corCt}
      />

      <CampaignSummaryCard
        icon={<Flame className="h-3.5 w-3.5 text-amber-400" />}
        title="Campanha ativa"
        subtitle={campanhaAtivaLabel}
        value={heroResumo.realizado}
        meta={heroResumo.meta}
        progresso={heroResumo.progresso}
        faltante={heroResumo.faltante}
        diarioSugerido={heroResumo.diarioSugerido}
        tone={cor}
      />
    </div>
  );
}

function getCampaignProgressTone(progresso: number) {
  if (progresso >= 80) {
    return {
      ring: 'stroke-emerald-500',
      text: 'text-emerald-400',
      label: 'Excelente',
      bar: 'bg-emerald-500',
    };
  }
  if (progresso >= 40) {
    return {
      ring: 'stroke-amber-400',
      text: 'text-amber-400',
      label: 'Atenção',
      bar: 'bg-amber-500',
    };
  }
  return {
    ring: 'stroke-red-500',
    text: 'text-red-400',
    label: 'Crítico',
    bar: 'bg-red-500',
  };
}

function CampaignSummaryCard({
  icon,
  title,
  subtitle,
  value,
  meta,
  progresso,
  faltante,
  diarioSugerido,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: number;
  meta: number;
  progresso: number;
  faltante: number;
  diarioSugerido: number;
  tone: ReturnType<typeof getCampaignProgressTone>;
}) {
  const pct = Math.min(100, progresso);
  const progressBarClass = progresso >= 80 ? 'bg-emerald-500' : progresso >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <Card className="relative overflow-hidden border-border/60 bg-card/80 transition-colors hover:ring-1 hover:ring-primary/20">
      <div className={cn('absolute inset-x-0 top-0 h-1', tone.bar)} />
      <CardContent className="relative p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium flex items-center gap-1.5">
              {icon} {title}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className={cn('text-4xl font-extrabold tabular-nums leading-none', tone.text)}>
                {progresso.toFixed(0)}%
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums leading-none">
                {formatCurrency(value)}
              </p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-1">{subtitle}</p>
          </div>

          <Badge variant="outline" className={cn('shrink-0 border-border/70 bg-background/30', tone.text)}>
            {tone.label}
          </Badge>
        </div>

        <div className="mt-5">
          <div className="h-2.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn('h-full transition-all duration-700', progressBarClass)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-muted-foreground">
            <span>Meta {formatCurrency(meta)}</span>
            <span>{pct.toFixed(1)}% atingido</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-md border border-border/60 bg-background/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Falta</p>
            <p className="text-base font-bold font-mono text-amber-300 tabular-nums">{formatCurrency(faltante)}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-background/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Ritmo diário</p>
            <p className="text-base font-bold font-mono text-emerald-300 tabular-nums">{formatCurrency(diarioSugerido)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCard({ icon, label, value, sub, color, trendPositive }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string; trendPositive?: boolean; }) {
  return (
    <Card className="overflow-hidden rounded-lg border-border/60 bg-card">
      <CardContent className="p-5">
        <div className={cn('mb-3 inline-block rounded-lg p-2.5 text-white', color)}>{icon}</div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
        {sub && (
          <p className={cn(
            'text-xs mt-0.5 truncate',
            trendPositive === true && 'text-emerald-500 font-semibold',
            trendPositive === false && 'text-red-500 font-semibold',
            trendPositive === undefined && 'text-muted-foreground',
          )}>{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCardPremium({ icon, label, value, sub, campanhas, premioTotal }: { icon: React.ReactNode; label: string; value: string; sub?: string; campanhas: CampanhaCalculada[]; premioTotal: number; }) {
  const [open, setOpen] = useState(false);

  const detalhes = campanhas.map(c => {
    const meses = monthsBetween(new Date(c.data_inicio), new Date(c.data_fim));
    const marcasDet = c.marcasCalc.map(m => {
      const metaPeriodo = Number(m.meta_mensal) * meses;
      const percent = Number(m.percentual_premio || 0);
      const fixo = Number(m.premio_fixo || 0);
      const premioPotencial = percent > 0 ? metaPeriodo * (percent / 100) : fixo;
      return {
        marca: m.marca,
        metaPeriodo,
        realizado: m.realizado,
        progresso: m.progresso,
        atingiu: m.atingiu,
        tipo: percent > 0 ? `${percent}% sobre vendas` : 'Prêmio fixo',
        premioPotencial,
        premioAtual: m.premio,
      };
    });
    return {
      campanha: c,
      marcas: marcasDet,
      bonusGeral: Number(c.bonus_meta_geral || 0),
      bonusGanho: c.bonusGanho,
      meses,
    };
  });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-left w-full">
        <Card className="relative cursor-pointer overflow-hidden rounded-lg border-amber-500/30 bg-card transition-colors hover:border-amber-500/45">
          <CardContent className="p-5 relative">
            <div className="mb-3 inline-block rounded-lg bg-amber-500/10 p-3 text-amber-500 ring-1 ring-amber-500/25">{icon}</div>
            <p className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-300 font-bold">{label}</p>
            <p className="text-2xl font-extrabold mt-1 tabular-nums text-amber-700 dark:text-amber-300">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Detalhamento da Premiação
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-amber-500/30 bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 font-bold">Potencial total a ganhar</p>
            <p className="text-3xl font-extrabold tabular-nums text-amber-700 dark:text-amber-300 mt-1">{formatCurrency(premioTotal)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Soma de todos os prêmios (% sobre marcas atingidas + bônus de meta geral) das campanhas no filtro atual.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Info className="h-4 w-4 text-primary" /> Como a premiação é calculada
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
              <li><strong>Por marca:</strong> ao bater a meta da marca no período, paga o prêmio configurado — pode ser <em>% sobre o realizado</em> ou um <em>valor fixo</em>.</li>
              <li><strong>Bônus de meta geral:</strong> valor fixo adicional pago apenas quando a soma de todas as marcas da campanha atinge a meta geral.</li>
              <li>O cálculo considera o <em>período inteiro</em> da campanha (meta mensal × número de meses).</li>
              <li>Cada marca é independente: você pode bater algumas e perder outras.</li>
            </ul>
          </div>

          {detalhes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma campanha no filtro atual.</p>
          )}
          {detalhes.map(({ campanha, marcas, bonusGeral, bonusGanho, meses }) => {
            const totalCamp = marcas.reduce((a, m) => a + m.premioPotencial, 0) + bonusGeral;
            const totalGanho = marcas.reduce((a, m) => a + m.premioAtual, 0) + (bonusGanho ? bonusGeral : 0);
            return (
              <div key={campanha.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold">{campanha.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(campanha.data_inicio).toLocaleDateString('pt-BR')} → {new Date(campanha.data_fim).toLocaleDateString('pt-BR')} • {meses.toFixed(1)} meses
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-muted-foreground">Já garantido / Potencial</p>
                    <p className="text-sm font-bold">
                      <span className="text-emerald-500">{formatCurrency(totalGanho)}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-amber-500">{formatCurrency(totalCamp)}</span>
                    </p>
                  </div>
                </div>

                {marcas.length > 0 && (
                  <div className="space-y-2">
                    {marcas.map((m, i) => (
                      <div key={i} className={cn(
                        'flex items-center justify-between gap-3 p-2.5 rounded-lg border text-sm',
                        m.atingiu ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-muted/30 border-border',
                      )}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{m.marca}</span>
                            <Badge variant="outline" className="text-[10px]">{m.tipo}</Badge>
                            {m.atingiu && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-600 border-emerald-500/40">âœ“ Batida</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatCurrency(m.realizado)} de {formatCurrency(m.metaPeriodo)} ({m.progresso.toFixed(0)}%)
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('text-sm font-bold tabular-nums', m.atingiu ? 'text-emerald-500' : 'text-amber-600')}>
                            {formatCurrency(m.atingiu ? m.premioAtual : m.premioPotencial)}
                          </p>
                          {!m.atingiu && <p className="text-[10px] text-muted-foreground">se bater</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {bonusGeral > 0 && (
                  <div className={cn(
                    'flex items-center justify-between gap-3 p-2.5 rounded-lg border text-sm',
                    bonusGanho ? 'bg-amber-500/10 border-amber-500/40' : 'bg-muted/30 border-dashed',
                  )}>
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold">Bônus meta geral</span>
                      {bonusGanho && <Badge className="text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/40">✓ Conquistado</Badge>}
                    </div>
                    <p className={cn('text-sm font-bold tabular-nums', bonusGanho ? 'text-amber-600' : 'text-muted-foreground')}>
                      {formatCurrency(bonusGeral)}
                    </p>
                  </div>
                )}

                {campanha.premiacao && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    <span className="font-semibold">Premiação descrita:</span> {campanha.premiacao}
                  </div>
                )}
              </div>
            );
          })}
        </DialogContent>
      </Dialog>
    </>
  );
}

function KpiCardProgress({ icon, label, value, sub, progress }: { icon: React.ReactNode; label: string; value: string; sub?: string; progress: number; }) {
  return (
    <Card className="overflow-hidden rounded-lg border-border/60 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-500 ring-1 ring-emerald-500/20">{icon}</div>
          <span className="text-xs font-bold text-emerald-600">{value}</span>
        </div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-2 truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// =================== Campanha Full Card ===================

function CampanhaVendedoresFiltro1004({
  selectedExtras,
  onChange,
}: {
  selectedExtras: string[];
  onChange: (codes: string[]) => void;
}) {
  const selecionados = new Set(selectedExtras);

  const toggleExtra = (codigo: string) => {
    const next = new Set(selecionados);
    if (next.has(codigo)) next.delete(codigo);
    else next.add(codigo);
    onChange(Array.from(next));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-lg gap-1.5 min-w-[170px] justify-between font-normal">
          <span className="truncate">
            Vendedores: {VENDEDORES_CT_CAMPANHA_1004.length + selectedExtras.length}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendedores no cálculo</p>
            <p className="text-[11px] text-muted-foreground">CT sempre entra. Chevrolet é opcional.</p>
          </div>
          {selectedExtras.length > 0 && (
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange([])}>
              Limpar
            </button>
          )}
        </div>
        <div className="p-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
              Padrão CT
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VENDEDORES_CT_CAMPANHA_1004_LABELS.map((vendedor) => (
                <Badge
                  key={vendedor.codigo}
                  className="gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {vendedor.nome}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
              Chevrolet opcionais
            </p>
            <div className="grid grid-cols-1 gap-2">
              {VENDEDORES_EXTRAS_CAMPANHA_1004_LABELS.map((vendedor) => {
                const checked = selecionados.has(vendedor.codigo);
                return (
                  <button
                    key={vendedor.codigo}
                    type="button"
                    onClick={() => toggleExtra(vendedor.codigo)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all',
                      checked
                        ? 'border-primary/50 bg-primary/15 text-primary'
                        : 'border-border/70 bg-background/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-primary/30',
                    )}
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{vendedor.nome}</span>
                    <span className="text-[10px] tabular-nums opacity-70">#{vendedor.codigo}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CampanhaFullCard({
  c, expanded, onToggle, onUpdate, onDelete, isMutating, marcasDisponiveis, vendedoresExtras1004,
}: {
  c: CampanhaCalculada;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (input: Partial<CampanhaInput>) => Promise<void>;
  onDelete: () => Promise<void>;
  isMutating: boolean;
  marcasDisponiveis: string[];
  vendedoresExtras1004: string[];
}) {
  const campanhaVisual = useMemo<CampanhaCalculada>(
    () => ({
      ...c,
      rankingVendedoresExtras1004: vendedoresExtras1004,
    }),
    [c, vendedoresExtras1004],
  );
  const statusBadge = {
    'achieved': { label: 'Meta batida', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    'on-track': { label: 'No ritmo', cls: 'bg-primary/15 text-primary border-primary/30' },
    'risk': { label: 'Em risco', cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
    'expired': { label: 'Encerrada', cls: 'bg-muted text-muted-foreground border-border' },
  }[c.statusVisual];

  const progressoCompacto = Math.min(100, Math.max(0, c.progressoGeral || 0));
  return (
    <Card className={cn(
      'group relative overflow-hidden border-border/60 bg-card transition-colors hover:ring-1 hover:ring-primary/20',
      expanded && 'ring-1 ring-primary/25',
      c.statusVisual === 'expired' && 'opacity-80',
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 relative overflow-hidden text-left transition-all"
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 relative">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-background/60 ring-1 ring-border/50">
                <ChevronDown className={cn('h-4 w-4 transition-transform shrink-0', expanded && 'rotate-180')} />
              </span>
              <h3 className="text-lg font-bold tracking-tight">{c.nome}</h3>
              <Badge variant="outline" className={cn('text-[10px] font-semibold', statusBadge.cls)}>{statusBadge.label}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />
                {new Date(c.data_inicio).toLocaleDateString('pt-BR')} – {new Date(c.data_fim).toLocaleDateString('pt-BR')}
              </span>
              {c.diasRestantes > 0 && <span>• {c.diasRestantes} dia(s) restante(s)</span>}
              {c.marcasCalc.length > 0 && (
                <span className="flex items-center gap-1">• Marcas: {c.marcasCalc.map(m => m.marca).join(' + ')}</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:flex xl:items-center gap-2 shrink-0">
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 min-w-[130px]">
              <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Realizado</p>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(c.realizadoTotal)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 min-w-[130px]">
              <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Meta</p>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(c.metaCampanhaTotal)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 min-w-[110px]">
              <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Progresso</p>
              <p className="text-sm font-bold tabular-nums text-primary">{c.progressoGeral.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 min-w-[110px]">
              <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Prêmio</p>
              <p className="text-sm font-bold tabular-nums text-emerald-400">{formatCurrency(c.premioTotal)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <CampanhaDialog
              initial={c}
              onSubmit={async (input) => { await onUpdate(input); }}
              isPending={isMutating}
              marcasDisponiveis={marcasDisponiveis}
              trigger={<Button size="sm" variant="ghost" className="h-8 gap-1 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Editar</Button>}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                  <AlertDialogDescription>"{c.nome}" será removida permanentemente.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="rounded-lg bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="relative mt-4 h-1.5 rounded-full bg-muted/60 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              c.statusVisual === 'achieved' ? 'bg-emerald-500' : c.statusVisual === 'risk' ? 'bg-red-500' : 'bg-primary',
            )}
            style={{ width: `${progressoCompacto}%` }}
          />
        </div>
      </button>

      {expanded && (
      <>

      <CardContent className="p-4 lg:p-5 space-y-5 border-t border-border/60">
        <CampanhaMesesTabs cOrig={campanhaVisual} />

        {(c.mensagem_equipe || c.observacoes) && (
          <details className="rounded-lg border border-border/60 bg-card px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              Notas e regras da campanha
            </summary>
            <div className="mt-3 grid gap-3 text-sm leading-relaxed text-muted-foreground">
              {c.mensagem_equipe && (
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="whitespace-pre-wrap">{c.mensagem_equipe}</p>
                </div>
              )}
              {c.observacoes && (
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="whitespace-pre-wrap">{c.observacoes}</p>
                </div>
              )}
            </div>
          </details>
        )}
      </CardContent>
      </>
      )}
    </Card>
  );
}

// ============= Sub-abas mensais da campanha =============

function enumerarMeses(campanha: CampanhaCalculada) {
  return mesesCampanha1004(campanha);
}

function computeMesCalc(c: CampanhaCalculada, mesInicio: Date, mesFim: Date): CampanhaCalculada {
  const inicioKey = dateKeyCampanha(mesInicio);
  const mesFimConsolidado = fimConsolidadoCampanha1004(
    { cod_empresa_bi: c.rankingCodEmpresaBi ?? c.cod_empresa_bi },
    mesFim,
  );
  const fimKey = dateKeyCampanha(mesFimConsolidado);
  const vendedoresExtras1004 = getVendedoresExtrasCampanha1004(c);
  const itensMes = c.itensPeriodo.filter((p: CampanhaItem) => {
    return itemFaturadoNoPeriodoCampanha(p, inicioKey, fimKey);
  });
  const itensMesCampanha = itensMes.filter((p: CampanhaItem) => itemElegivelTotalCampanha(p, c.rankingCodEmpresaBi, vendedoresExtras1004)
    && itemPertenceEscopoCampanha(p, c.rankingCodEmpresaBi, c.rankingFilialAtiva, vendedoresExtras1004)
    && c.marcasCalc.some(m => itemPertenceMarcaCampanha(p, m.marca, c.rankingCodEmpresaBi)));
  const itensTotalMes = itensMes.filter((p: CampanhaItem) => itemElegivelTotalCampanha(p, c.rankingCodEmpresaBi, vendedoresExtras1004)
    && itemPertenceEscopoCampanha(p, c.rankingCodEmpresaBi, c.rankingFilialAtiva, vendedoresExtras1004));
  const itensMesRanking = itensMesCampanha;
  const marcasCalc: MarcaCalculada[] = c.marcasCalc.map(m => {
    const marcaUpper = m.marca.trim().toUpperCase();
    const itensMarca = itensMesCampanha.filter((p: CampanhaItem) => itemPertenceMarcaCampanha(p, marcaUpper, c.rankingCodEmpresaBi));
    const realizado = itensMarca.reduce((acc, p: CampanhaItem) => acc + valorBrutoCampanha(p, c.rankingCodEmpresaBi, c.marcasCalc), 0);
    const metaMes = Number(m.meta_mensal);
    const progresso = metaMes > 0 ? Math.min(150, (realizado / metaMes) * 100) : 0;
    const atingiu = realizado >= metaMes && metaMes > 0;
    const percent = Number(m.percentual_premio || 0);
    const fixo = Number(m.premio_fixo || 0);
    const premio = atingiu ? (percent > 0 ? metaMes * (percent / 100) : fixo) : 0;
    return { ...m, realizado, progresso, premio, atingiu };
  });
  const realizadoTotal = itensMesCampanha.reduce((acc, p: CampanhaItem) => acc + valorBrutoCampanha(p, c.rankingCodEmpresaBi, c.marcasCalc), 0);
  const vendasTotaisMes = itensTotalMes.reduce((acc, p: CampanhaItem) => acc + valorBrutoCampanha(p, c.rankingCodEmpresaBi, c.marcasCalc), 0);
  const metaMesGeral = Number(c.meta_geral_mensal || 0);
  const progressoGeral = metaMesGeral > 0 ? Math.min(150, (vendasTotaisMes / metaMesGeral) * 100) : 0;
  const bonusGanho = vendasTotaisMes >= metaMesGeral && metaMesGeral > 0;
  const premioTotal = marcasCalc.reduce((a, m) => a + m.premio, 0) + (bonusGanho ? Number(c.bonus_meta_geral || 0) : 0);
  const vendMap = new Map<string, number>();
  itensMesRanking.forEach((p: CampanhaItem) => {
    const nome = nomeVendedorCampanha(p);
    if (!nome) return;
    vendMap.set(nome, (vendMap.get(nome) || 0) + valorBrutoCampanha(p, c.rankingCodEmpresaBi, c.marcasCalc));
  });
  const vendedoresContrib = Array.from(vendMap.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
  const hoje = new Date();
  const diasRestantes = hoje > mesFim ? 0 : diffDays(hoje, mesFim);
  let statusVisual: CampanhaCalculada['statusVisual'] = 'on-track';
  if (progressoGeral >= 100) statusVisual = 'achieved';
  else if (hoje > mesFim) statusVisual = 'expired';
  else if (progressoGeral < 60 && diasRestantes < diffDays(mesInicio, mesFim) / 2) statusVisual = 'risk';

  const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    ...c,
    data_inicio: toIso(mesInicio),
    data_fim: toIso(mesFim),
    marcasCalc,
    realizadoTotal,
    vendasTotaisMes,
    metaCampanhaTotal: metaMesGeral,
    progressoGeral,
    premioTotal,
    diasRestantes,
    bonusGanho,
    vendedoresContrib,
    statusVisual,
    itensPeriodo: itensMes,
  };
}

function CampanhaMesesTabs({ cOrig }: { cOrig: CampanhaCalculada }) {
  const meses = useMemo(() => enumerarMeses(cOrig), [cOrig]);
  const defaultKey = useMemo(() => {
    const ativo = meses.find(m => m.status === 'ativo');
    if (ativo) return ativo.key;
    const fechados = meses.filter(m => m.status === 'fechado');
    if (fechados.length > 0) return fechados[fechados.length - 1].key;
    return meses[0]?.key;
  }, [meses]);

  if (meses.length === 0) return null;

  const statusStyle = (s: 'fechado' | 'ativo' | 'futuro') =>
    s === 'ativo'
      ? 'bg-primary/15 text-primary border-primary/40'
      : s === 'fechado'
        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
        : 'bg-muted text-muted-foreground border-border';

  const statusLabel = (s: 'fechado' | 'ativo' | 'futuro') =>
    s === 'ativo' ? 'Em andamento' : s === 'fechado' ? 'Fechado' : 'Futuro';

  return (
    <Tabs defaultValue={defaultKey} className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1 rounded-lg border border-border/60 bg-muted/25 p-1">
        {meses.map(m => (
          <TabsTrigger key={m.key} value={m.key} className="gap-2 rounded-md px-4 py-2 data-[state=active]:bg-background">
            <span className="font-semibold capitalize">{m.label}</span>
            <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4', statusStyle(m.status))}>
              {statusLabel(m.status)}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      {meses.map(m => (
        <TabsContent key={m.key} value={m.key} className="space-y-5 mt-4">
          <CampanhaMesView cOrig={cOrig} mesInicio={m.inicio} mesFim={m.fim} status={m.status} label={m.label} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CampanhaMesView({
  cOrig, mesInicio, mesFim, status, label,
}: {
  cOrig: CampanhaCalculada;
  mesInicio: Date;
  mesFim: Date;
  status: 'fechado' | 'ativo' | 'futuro';
  label: string;
}) {
  const c = useMemo(() => computeMesCalc(cOrig, mesInicio, mesFim), [cOrig, mesInicio, mesFim]);
  const [vendedorSel, setVendedorSel] = useState<string | null>(null);
  const metaGeral = Number(c.meta_geral_mensal || 0);
  const metaMarcasCampanha = c.marcasCalc.reduce((acc, marca) => acc + Number(marca.meta_mensal || 0), 0);
  const metaCampanhaCard = metaMarcasCampanha > 0 ? metaMarcasCampanha : Number(c.metaCampanhaTotal || 0);
  const pctMetaGeral = metaGeral > 0 ? (c.vendasTotaisMes / metaGeral) * 100 : 0;
  const pctCampanha = metaCampanhaCard > 0 ? (c.realizadoTotal / metaCampanhaCard) * 100 : 0;
  const valorFaltaCampanha = Math.max(0, metaCampanhaCard - c.realizadoTotal);
  const marcasTexto = c.marcasCalc.map((m) => m.marca).filter(Boolean).join(' + ') || 'campanha';
  const potencialPremio = c.marcasCalc.reduce((a, m) => {
    return a + (m.percentual_premio > 0
      ? Number(m.meta_mensal) * (m.percentual_premio / 100)
      : Number(m.premio_fixo || 0));
  }, 0) + Number(c.bonus_meta_geral || 0);
  const totalRanking = c.vendedoresContrib.reduce((a, v) => a + v.valor, 0) || 1;
  const topVendedores = c.vendedoresContrib.slice(0, 3).map((v) => ({
    ...v,
    contrib: (v.valor / totalRanking) * 100,
  }));
  const vendedoresRestantes = c.vendedoresContrib.slice(3, 8);
  const campanhaTone = pctCampanha >= 100
    ? { text: 'text-emerald-400', bg: 'from-emerald-500/15', bar: 'bg-emerald-500', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', label: 'Meta atingida' }
    : pctCampanha >= 70
      ? { text: 'text-amber-400', bg: 'from-amber-500/15', bar: 'bg-amber-500', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300', label: 'Acompanhar' }
      : { text: 'text-red-400', bg: 'from-red-500/15', bar: 'bg-red-500', badge: 'border-red-500/30 bg-red-500/10 text-red-300', label: 'Abaixo da meta' };

  return (
    <>
      {status === 'futuro' && (
        <div className="rounded-lg border border-dashed border-border/70 p-3 text-center text-xs text-muted-foreground">
          Mês ainda não iniciado.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-4">
        <div className={cn('rounded-lg border border-border/60 bg-card p-5 relative overflow-hidden', campanhaTone.bg)}>
          <div className="relative flex flex-col md:flex-row md:items-center gap-5">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-background/50 ring-[12px] ring-muted/50">
              <div className="text-center">
                <p className={cn('text-2xl font-bold font-mono leading-none', campanhaTone.text)}>{pctCampanha.toFixed(0)}%</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{campanhaTone.label}</p>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('text-[10px]', campanhaTone.badge)}>{label}</Badge>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{marcasTexto}</Badge>
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Realizado da campanha</p>
              <p className="mt-1 text-3xl font-bold font-mono tabular-nums">{formatCurrency(c.realizadoTotal)}</p>
              <div className="mt-4 h-2 rounded-full bg-muted/70 overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-700', campanhaTone.bar)} style={{ width: `${Math.min(100, pctCampanha)}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>Meta: <strong className="text-foreground">{formatCurrency(metaCampanhaCard)}</strong></span>
                <span>Falta: <strong className={valorFaltaCampanha > 0 ? 'text-amber-400' : 'text-emerald-400'}>{formatCurrency(valorFaltaCampanha)}</strong></span>
                <span>{c.marcasCalc.length} marca(s)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold">Valor total</p>
            </div>
            <p className="mt-3 text-xl font-bold font-mono tabular-nums">{formatCurrency(c.vendasTotaisMes)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{pctMetaGeral.toFixed(1)}% da meta total</p>
          </div>
          <div className="rounded-lg border border-amber-500/25 bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gift className="h-4 w-4 text-amber-500" />
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold">Premiação</p>
            </div>
            <p className="mt-3 text-xl font-bold font-mono tabular-nums text-amber-400">{formatCurrency(potencialPremio)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.premioTotal > 0 ? `${formatCurrency(c.premioTotal)} conquistado` : 'Aguardando metas'}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card p-4 col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Meta total das marcas</p>
                <p className="mt-2 text-xl font-bold font-mono tabular-nums">{formatCurrency(metaCampanhaCard)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Meta total CT</p>
                <p className="mt-2 text-sm font-bold font-mono tabular-nums text-primary">{formatCurrency(metaGeral)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {c.marcasCalc.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 ring-1 ring-primary/20">
                <Trophy className="h-4 w-4 text-primary" />
              </span>
              Progresso por marca
            </h4>
            <span className="text-xs text-muted-foreground">Clique para ver detalhes</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {c.marcasCalc.map((m, idx) => (
              <MarcaInteractiveCard key={idx} c={c} m={m} index={idx} />
            ))}
          </div>
        </div>
      )}

      {c.vendedoresContrib.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/20">
                <Crown className="h-4 w-4 text-amber-500" />
              </span>
              Ranking do mês
            </h4>
            <span className="text-xs text-muted-foreground">{c.vendedoresContrib.length} vendedor(es)</span>
          </div>
          {topVendedores.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topVendedores.map((v, idx) => (
                <TopVendedorCard key={v.nome} v={v} position={idx + 1} onClick={() => setVendedorSel(v.nome)} />
              ))}
            </div>
          )}
          {vendedoresRestantes.length > 0 && (
            <div className="divide-y divide-border/60 rounded-lg border border-border/50 overflow-hidden">
              {vendedoresRestantes.map((v, idx) => {
                const pct = (v.valor / totalRanking) * 100;
                const pos = idx + 4;
              return (
                <button
                  key={v.nome}
                  type="button"
                  onClick={() => setVendedorSel(v.nome)}
                    className="w-full grid grid-cols-[auto,1fr,auto] items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/30"
                >
                  <span className={cn(
                      'grid h-7 w-7 place-items-center rounded-md text-xs font-bold bg-muted text-muted-foreground',
                  )}>
                      {pos}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{v.nome}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-primary tabular-nums">{formatCurrency(v.valor)}</p>
                    <p className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</p>
                  </div>
                </button>
              );
            })}
            </div>
          )}
        </div>
      )}

      {vendedorSel && (
        <VendedorDetalheDialog
          open={!!vendedorSel}
          onOpenChange={(o) => !o && setVendedorSel(null)}
          cOrig={cOrig}
          campanhaMes={c}
          vendedorNome={vendedorSel}
          mesLabel={label}
          status={status}
        />
      )}
    </>
  );
}


function MarcaInteractiveCard({ c, m, index }: { c: CampanhaCalculada; m: MarcaCalculada; index: number }) {
  const [open, setOpen] = useState(false);
  const ini = new Date(c.data_inicio);
  const fim = new Date(c.data_fim);
  const meses = monthsBetween(ini, fim);
  const metaPeriodo = Number(m.meta_mensal) * meses;
  const faltaMeta = Math.max(0, metaPeriodo - m.realizado);
  const colors = m.atingiu
    ? { bar: 'bg-emerald-500', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Excelente' }
    : m.progresso >= 60
      ? { bar: 'bg-amber-500', text: 'text-amber-600', dot: 'bg-amber-500', label: 'Médio' }
      : { bar: 'bg-red-500', text: 'text-red-600', dot: 'bg-red-500', label: 'Baixo' };
  const vendedoresExtrasCampanha = useMemo(() => getVendedoresExtrasCampanha1004(c), [c]);

  const itensMarca = useMemo(
    () => c.itensPeriodo.filter((p: CampanhaItem) => itemElegivelTotalCampanha(p, c.rankingCodEmpresaBi, vendedoresExtrasCampanha)
      && itemPertenceEscopoCampanha(p, c.rankingCodEmpresaBi, c.rankingFilialAtiva, vendedoresExtrasCampanha)
      && itemPertenceMarcaCampanha(p, m.marca, c.rankingCodEmpresaBi)),
    [c.itensPeriodo, m.marca, c.rankingCodEmpresaBi, c.rankingFilialAtiva, vendedoresExtrasCampanha]
  );

  const topVendedores = useMemo(() => {
    const map = new Map<string, number>();
    itensMarca.forEach((p: CampanhaItem) => {
      const nome = (p.nome_externo || p.nome_interno || p.vendedor_nome || '').toString().trim();
      if (!nome) return;
      map.set(nome, (map.get(nome) || 0) + valorBrutoCampanha(p, c.rankingCodEmpresaBi, c.marcasCalc));
    });
    return Array.from(map.entries()).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [itensMarca, c.rankingCodEmpresaBi, c.marcasCalc]);

  const topClientes = useMemo(() => {
    const map = new Map<string, number>();
    itensMarca.forEach((p: CampanhaItem) => {
      const nome = (p.cliente_razao || p.nome_grupo || '').toString().trim();
      if (!nome) return;
      map.set(nome, (map.get(nome) || 0) + valorBrutoCampanha(p, c.rankingCodEmpresaBi, c.marcasCalc));
    });
    return Array.from(map.entries()).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [itensMarca, c.rankingCodEmpresaBi, c.marcasCalc]);

  const topProdutos = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number }>();
    itensMarca.forEach((p: CampanhaItem) => {
      const nome = (p.descricao || p.cod_produto || '').toString().trim();
      if (!nome) return;
      const cur = map.get(nome) || { valor: 0, qtd: 0 };
      cur.valor += valorBrutoCampanha(p, c.rankingCodEmpresaBi, c.marcasCalc);
      cur.qtd += p.quantidade || 0;
      map.set(nome, cur);
    });
    return Array.from(map.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [itensMarca, c.rankingCodEmpresaBi, c.marcasCalc]);

  const evolucaoMensal = useMemo(() => {
    const map = new Map<string, number>();
    itensMarca.forEach((p: CampanhaItem) => {
      const dt = p.data_faturamento || p.data_pedido;
      if (!dt) return;
      const d = new Date(dt);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + valorBrutoCampanha(p, c.rankingCodEmpresaBi, c.marcasCalc));
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [itensMarca, c.rankingCodEmpresaBi, c.marcasCalc]);

  const maxMes = Math.max(1, ...evolucaoMensal.map(([, v]) => v));
  const totalVendedores = topVendedores.reduce((a, v) => a + v.valor, 0) || 1;
  const totalClientes = topClientes.reduce((a, v) => a + v.valor, 0) || 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group relative overflow-hidden rounded-lg border border-border/60 bg-card p-4 text-left transition-colors hover:ring-1 hover:ring-primary/20 animate-fade-in"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className="flex items-center justify-between gap-2 mb-2 relative">
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full', colors.dot)} />
              <span className="font-semibold text-sm">{m.marca}</span>
              <Badge variant="outline" className={cn('text-[10px]', colors.text, 'border-current/30')}>{colors.label}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-lg font-bold tabular-nums', colors.text)}>{m.progresso.toFixed(0)}%</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
          <div className="h-2 bg-muted/60 rounded-full overflow-hidden mb-3 relative">
            <div className={cn('h-full rounded-full transition-all duration-1000', m.atingiu ? 'bg-emerald-500' : m.progresso >= 60 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.min(100, m.progresso)}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs relative">
            <div>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Meta</p>
              <p className="font-semibold tabular-nums">{formatCurrency(metaPeriodo)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Real</p>
              <p className="font-semibold tabular-nums">{formatCurrency(m.realizado)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Falta</p>
              <p className={cn('font-bold tabular-nums', faltaMeta <= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {faltaMeta <= 0 ? 'Batida' : formatCurrency(faltaMeta)}
              </p>
            </div>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl rounded-lg p-0 overflow-hidden border border-border/60 shadow-xl">
        <div className="relative overflow-hidden border-b border-border/60 bg-card px-6 pb-7 pt-6">
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-3">
              <span className="p-2.5 rounded-md bg-primary/10 ring-1 ring-primary/20 text-primary">
                <Trophy className="h-5 w-5" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Marca</p>
                <p className="text-2xl font-bold mt-0.5">{m.marca}</p>
              </div>
              <div className="text-right">
                <p className={cn('text-3xl font-bold tabular-nums', colors.text)}>{m.progresso.toFixed(0)}%</p>
                <p className="text-[11px] text-muted-foreground">da meta</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 mt-4 relative">
            <div className="bg-background/40 rounded-lg p-3 border border-border/60">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Meta período</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{formatCurrency(metaPeriodo)}</p>
            </div>
            <div className="bg-background/40 rounded-lg p-3 border border-border/60">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Realizado</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{formatCurrency(m.realizado)}</p>
            </div>
            <div className="bg-background/40 rounded-lg p-3 border border-border/60">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Falta</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{formatCurrency(Math.max(0, metaPeriodo - m.realizado))}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto bg-background space-y-5">
          {/* Evolução mensal */}
          {evolucaoMensal.length > 0 && (
            <div className="animate-fade-in">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Evolução mensal
              </h4>
              <div className="flex items-end gap-2 h-32">
                {evolucaoMensal.map(([key, valor]) => {
                  const h = Math.max(4, (valor / maxMes) * 100);
                  const [y, mo] = key.split('-');
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <div className="flex-1 flex flex-col items-center gap-1 cursor-help group/bar">
                          <div className="text-[10px] font-semibold text-muted-foreground opacity-0 group-hover/bar:opacity-100 transition-opacity">
                            {formatCurrency(valor)}
                          </div>
                          <div className="w-full bg-muted rounded-t-md relative overflow-hidden" style={{ height: '100%' }}>
                            <div
                              className={cn('absolute bottom-0 left-0 right-0 rounded-t-md transition-all duration-700 group-hover/bar:opacity-90', colors.bar)}
                              style={{ height: `${h}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-muted-foreground">{mo}/{y.slice(2)}</div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs font-semibold">{mo}/{y}</p>
                        <p className="text-xs">{formatCurrency(valor)}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Top vendedores */}
            {topVendedores.length > 0 && (
              <div className="animate-fade-in">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" /> Top Vendedores
                </h4>
                <div className="space-y-2">
                  {topVendedores.map((v, i) => (
                    <div key={v.nome} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 truncate min-w-0">
                          <span className="w-5 h-5 rounded-full bg-muted font-bold flex items-center justify-center text-[10px] shrink-0">{i + 1}</span>
                          <span className="truncate font-medium">{v.nome}</span>
                        </span>
                        <span className="font-semibold tabular-nums shrink-0">{formatCurrency(v.valor)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full', colors.bar)} style={{ width: `${(v.valor / totalVendedores) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top clientes */}
            {topClientes.length > 0 && (
              <div className="animate-fade-in">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" /> Top Clientes
                </h4>
                <div className="space-y-2">
                  {topClientes.map((v, i) => (
                    <div key={v.nome} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 truncate min-w-0">
                          <span className="w-5 h-5 rounded-full bg-muted font-bold flex items-center justify-center text-[10px] shrink-0">{i + 1}</span>
                          <span className="truncate font-medium">{v.nome}</span>
                        </span>
                        <span className="font-semibold tabular-nums shrink-0">{formatCurrency(v.valor)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${(v.valor / totalClientes) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top produtos */}
          {topProdutos.length > 0 && (
            <div className="animate-fade-in">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Top Produtos
              </h4>
              <div className="overflow-hidden rounded-lg border">
                {topProdutos.map((p, i) => (
                  <div key={p.nome} className={cn('flex items-center justify-between gap-2 px-3 py-2 text-xs', i % 2 === 0 ? 'bg-muted/30' : '')}>
                    <span className="flex items-center gap-2 truncate min-w-0">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0">{i + 1}</span>
                      <span className="truncate font-medium">{p.nome}</span>
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground">{p.qtd.toLocaleString('pt-BR')} un</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(p.valor)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topVendedores.length === 0 && topClientes.length === 0 && topProdutos.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Sem vendas registradas para esta marca no período.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResumoBox({ label, valor, sub, icon, highlight, premium, details }: { label: string; valor: string; sub?: string; icon: React.ReactNode; highlight?: boolean; premium?: boolean; details?: React.ReactNode; }) {
  const [open, setOpen] = useState(false);
  const clickable = !!details;
  const content = (
    <div className={cn(
      'group relative overflow-hidden rounded-lg border border-border/60 bg-card p-4 h-full transition-all',
      premium && 'border-amber-500/25',
      highlight && 'border-emerald-500/25',
      clickable && 'cursor-pointer text-left hover:ring-1 hover:ring-primary/20',
    )}>
      <div className="relative">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn('p-1.5 rounded-md ring-1', premium ? 'bg-amber-500/10 text-amber-500 ring-amber-500/20' : highlight ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' : 'bg-primary/10 text-primary ring-primary/20')}>{icon}</span>
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold truncate">{label}</p>
      </div>
      <p className={cn('text-xl font-bold font-mono tabular-nums', premium && 'text-amber-500')}>{valor}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  if (!clickable) return content;

  const theme = premium
    ? { text: 'text-amber-500', chip: 'bg-amber-500/10 text-amber-500 border-amber-500/25', icon: 'bg-amber-500/10 text-amber-500 ring-amber-500/20' }
    : highlight
      ? { text: 'text-emerald-500', chip: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25', icon: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' }
      : { text: 'text-primary', chip: 'bg-primary/10 text-primary border-primary/25', icon: 'bg-primary/10 text-primary ring-primary/20' };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="block w-full">{content}</button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-lg p-0 overflow-hidden border border-border/60 shadow-xl">
        <div className="relative overflow-hidden border-b border-border/60 bg-card px-6 pb-8 pt-6">
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-3">
              <span className={cn('p-2.5 rounded-md ring-1', theme.icon)}>{icon}</span>
              <div className="flex-1 text-left">
                <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">{label}</p>
                <p className={cn('text-3xl font-bold font-mono tabular-nums mt-1', theme.text)}>{valor}</p>
              </div>
            </DialogTitle>
            {sub && (
              <span className={cn('inline-flex items-center self-start gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border mt-2', theme.chip)}>
                <Sparkles className="h-3 w-3" /> {sub}
              </span>
            )}
          </DialogHeader>
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto bg-background">
          <div className="animate-fade-in">
            {details}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TopVendedorCard({ v, position, onClick }: { v: { nome: string; valor: number; contrib: number }; position: number; onClick?: () => void }) {
  const styles = position === 1
    ? { icon: <Crown className="h-4 w-4" />, accent: 'from-amber-500/15 via-transparent to-transparent', text: 'text-amber-500', ring: 'ring-amber-500/20 bg-amber-500/10' }
    : position === 2
      ? { icon: <Medal className="h-4 w-4" />, accent: 'from-slate-400/15 via-transparent to-transparent', text: 'text-slate-300', ring: 'ring-slate-400/20 bg-slate-400/10' }
      : { icon: <Award className="h-4 w-4" />, accent: 'from-orange-500/15 via-transparent to-transparent', text: 'text-orange-500', ring: 'ring-orange-500/20 bg-orange-500/10' };

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-card p-4 text-left transition-colors hover:ring-1 hover:ring-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn('grid h-7 w-7 place-items-center rounded-md ring-1', styles.ring, styles.text)}>
            {styles.icon}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground">#{position}</span>
        </div>
        <p className="font-bold text-sm truncate" title={v.nome}>{v.nome}</p>
        <p className={cn('text-lg font-bold font-mono mt-1 tabular-nums', styles.text)}>{formatCurrency(v.valor)}</p>
        <p className="text-xs opacity-90">{v.contrib.toFixed(1)}% do total</p>
      </div>
    </button>
  );
}

// =================== Dialog Detalhe do Vendedor ===================

function VendedorDetalheDialog({
  open, onOpenChange, cOrig, campanhaMes, vendedorNome, mesLabel, status,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cOrig: CampanhaCalculada;
  campanhaMes: CampanhaCalculada;
  vendedorNome: string;
  mesLabel: string;
  status: 'fechado' | 'ativo' | 'futuro';
}) {
  const nomeMatch = useCallback((p: CampanhaItem) => nomeVendedorCampanha(p) === vendedorNome, [vendedorNome]);
  const vendedoresExtrasMes = useMemo(
    () => getVendedoresExtrasCampanha1004(campanhaMes),
    [campanhaMes],
  );

  // Itens do vendedor no mês (já filtrados por marcas da campanha em campanhaMes.itensPeriodo? Não — itensPeriodo em computeMesCalc é itensMes, não itensMesCampanha.)
  // Precisamos filtrar por marcas da campanha aqui:
  const itensVend = useMemo(
    () => campanhaMes.itensPeriodo.filter((p: CampanhaItem) => nomeMatch(p)
      && itemElegivelTotalCampanha(p, campanhaMes.rankingCodEmpresaBi, vendedoresExtrasMes)
      && itemPertenceEscopoCampanha(p, campanhaMes.rankingCodEmpresaBi, campanhaMes.rankingFilialAtiva, vendedoresExtrasMes)
      && campanhaMes.marcasCalc.some(m => itemPertenceMarcaCampanha(p, m.marca, campanhaMes.rankingCodEmpresaBi))),
    [campanhaMes.itensPeriodo, campanhaMes.marcasCalc, campanhaMes.rankingCodEmpresaBi, campanhaMes.rankingFilialAtiva, nomeMatch, vendedoresExtrasMes]
  );

  const totalVend = itensVend.reduce((a, p: CampanhaItem) => a + valorBrutoCampanha(p, campanhaMes.rankingCodEmpresaBi, campanhaMes.marcasCalc), 0);
  const pedidosSet = new Set(itensVend.map((p: CampanhaItem) => p.cod_pedido || p.id).filter(Boolean));
  const nPedidos = pedidosSet.size || itensVend.length;
  const ticketMedio = nPedidos > 0 ? totalVend / nPedidos : 0;
  const usaPedido = pedidosSet.size > 0;

  // Breakdown por marca
  const breakdown = campanhaMes.marcasCalc.map(m => {
    const marcaUpper = m.marca.trim().toUpperCase();
    const vendidoMarca = itensVend
      .filter((p: CampanhaItem) => itemPertenceMarcaCampanha(p, marcaUpper, campanhaMes.rankingCodEmpresaBi))
      .reduce((a: number, p: CampanhaItem) => a + valorBrutoCampanha(p, campanhaMes.rankingCodEmpresaBi, campanhaMes.marcasCalc), 0);
    const contrib = m.realizado > 0 ? (vendidoMarca / m.realizado) * 100 : 0;
    const premioPotencial = m.percentual_premio > 0
      ? Number(m.meta_mensal) * (m.percentual_premio / 100)
      : Number(m.premio_fixo || 0);
    const premioIndividual = m.atingiu && m.realizado > 0 ? m.premio * (vendidoMarca / m.realizado) : 0;
    const premioSeAtingir = m.realizado > 0 ? premioPotencial * (vendidoMarca / m.realizado) : 0;
    return { marca: m.marca, vendidoMarca, contrib, atingiu: m.atingiu, premioIndividual, premioSeAtingir, metaMarca: Number(m.meta_mensal), realizadoMarca: m.realizado };
  });

  // Bônus geral rateado
  const bonusGeral = Number(cOrig.bonus_meta_geral || 0);
  const bonusRateado = campanhaMes.bonusGanho && campanhaMes.realizadoTotal > 0
    ? bonusGeral * (totalVend / campanhaMes.realizadoTotal)
    : 0;
  const bonusPotencial = campanhaMes.realizadoTotal > 0 ? bonusGeral * (totalVend / campanhaMes.realizadoTotal) : 0;

  const totalReceber = breakdown.reduce((a, b) => a + b.premioIndividual, 0) + bonusRateado;

  // Posição e gap
  const posicao = campanhaMes.vendedoresContrib.findIndex(v => v.nome === vendedorNome) + 1;
  const totalRanking = campanhaMes.vendedoresContrib.reduce((a, x) => a + x.valor, 0) || 1;
  const contribCampanha = (totalVend / totalRanking) * 100;
  const acima = posicao > 1 ? campanhaMes.vendedoresContrib[posicao - 2] : null;
  const abaixo = posicao < campanhaMes.vendedoresContrib.length ? campanhaMes.vendedoresContrib[posicao] : null;
  const gapAcima = acima ? acima.valor - totalVend : 0;
  const distAbaixo = abaixo ? totalVend - abaixo.valor : 0;

  // Histórico da campanha
  const historico = useMemo(() => {
    const meses = enumerarMeses(cOrig);
    return meses.map(m => {
      const calc = computeMesCalc(cOrig, m.inicio, m.fim);
      const itensV = calc.itensPeriodo.filter((p: CampanhaItem) => {
        const nome = nomeVendedorCampanha(p);
        const marcaOk = calc.marcasCalc.some(x => itemPertenceMarcaCampanha(p, x.marca, calc.rankingCodEmpresaBi));
        return nome === vendedorNome
          && itemElegivelTotalCampanha(p, calc.rankingCodEmpresaBi, getVendedoresExtrasCampanha1004(calc))
          && itemPertenceEscopoCampanha(p, calc.rankingCodEmpresaBi, calc.rankingFilialAtiva, getVendedoresExtrasCampanha1004(calc))
          && marcaOk;
      });
      const total = itensV.reduce((a: number, p: CampanhaItem) => a + valorBrutoCampanha(p, calc.rankingCodEmpresaBi, calc.marcasCalc), 0);
      const pos = calc.vendedoresContrib.findIndex(v => v.nome === vendedorNome) + 1;
      const premio = calc.marcasCalc.reduce((acc, mm) => {
        if (!mm.atingiu || mm.realizado <= 0) return acc;
        const vendMarca = itensV
          .filter((p: CampanhaItem) => itemPertenceMarcaCampanha(p, mm.marca, calc.rankingCodEmpresaBi))
          .reduce((a: number, p: CampanhaItem) => a + valorBrutoCampanha(p, calc.rankingCodEmpresaBi, calc.marcasCalc), 0);
        return acc + mm.premio * (vendMarca / mm.realizado);
      }, 0) + (calc.bonusGanho && calc.realizadoTotal > 0 ? Number(cOrig.bonus_meta_geral || 0) * (total / calc.realizadoTotal) : 0);
      return { label: m.label, status: m.status, total, pos, premio };
    });
  }, [cOrig, vendedorNome]);

  const totalHistorico = historico.reduce((a, h) => a + h.premio, 0);

  const statusBadge = status === 'fechado' ? { txt: 'Fechado', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' }
    : status === 'ativo' ? { txt: 'Em andamento', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' }
    : { txt: 'Futuro', cls: 'bg-muted text-muted-foreground border-border' };

  const medal = posicao === 1 ? '1' : posicao === 2 ? '2' : posicao === 3 ? '3' : `${posicao}`;
  const principalMarca = breakdown.slice().sort((a, b) => b.vendidoMarca - a.vendidoMarca)[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 rounded-lg border-border/70">
        <div className="relative overflow-hidden border-b border-border/60 bg-card px-6 py-5">
          <DialogHeader className="relative">
            <DialogTitle className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                  <Crown className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xl font-bold">{vendedorNome}</p>
                    <Badge variant="outline" className={cn('text-[10px]', statusBadge.cls)}>{statusBadge.txt}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    {mesLabel} · #{posicao} no ranking · {contribCampanha.toFixed(1)}% do realizado
                  </p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Total vendido</p>
                <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-primary">{formatCurrency(totalVend)}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-6 py-5 space-y-4 bg-background">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-card p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Posição</p>
              <p className="mt-2 text-xl font-bold">#{medal}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{usaPedido ? 'Pedidos' : 'Itens'}</p>
              <p className="mt-2 text-xl font-bold tabular-nums">{nPedidos}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Ticket médio</p>
              <p className="mt-2 text-xl font-bold font-mono tabular-nums">{formatCurrency(ticketMedio)}</p>
            </div>
            <div className="rounded-lg border border-amber-500/25 bg-card p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Prêmio mês</p>
              <p className={cn('mt-2 text-xl font-bold font-mono tabular-nums', totalReceber > 0 ? 'text-emerald-400' : 'text-muted-foreground')}>
                {formatCurrency(totalReceber)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.85fr]">
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Marcas da campanha
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {principalMarca ? `${principalMarca.marca} lidera o volume do vendedor` : 'Sem vendas no período'}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                  {breakdown.filter((b) => b.vendidoMarca > 0).length} ativa(s)
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {breakdown.map((b, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold">{b.marca}</span>
                      <span className="font-mono font-bold tabular-nums">{formatCurrency(b.vendidoMarca)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/70 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', b.atingiu ? 'bg-emerald-500' : b.vendidoMarca > 0 ? 'bg-primary' : 'bg-muted-foreground/30')}
                        style={{ width: `${Math.min(100, b.contrib)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{b.contrib.toFixed(1)}% da marca</span>
                      <span>{b.atingiu ? 'meta atingida' : `prêmio potencial ${formatCurrency(b.premioSeAtingir)}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-4">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                Disputa no ranking
              </p>
              <div className="mt-4 rounded-lg bg-muted/25 p-3">
                {posicao === 1 ? (
                  <div>
                    <p className="text-lg font-bold text-emerald-400">Líder do mês</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {abaixo ? `Vantagem de ${formatCurrency(distAbaixo)} sobre ${abaixo.nome}.` : 'Sem vendedor abaixo no ranking.'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-bold">#{posicao}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Faltam <strong className="text-amber-400">{formatCurrency(gapAcima)}</strong> para passar {acima?.nome}.
                    </p>
                    {abaixo && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Vantagem sobre {abaixo.nome}: <span className="font-mono">{formatCurrency(distAbaixo)}</span>.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {bonusGeral > 0 && (
                <div className="mt-3 rounded-lg border border-border/50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Bônus geral</p>
                  <p className="mt-1 text-sm font-bold font-mono tabular-nums">
                    {formatCurrency(bonusRateado)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {campanhaMes.bonusGanho ? 'Bônus já rateado pelo desempenho.' : `Se bater, potencial de ${formatCurrency(bonusPotencial)}.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <details className="rounded-lg border border-border/60 bg-card">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-500" />
              Composição da premiação
            </summary>
            <div className="border-t border-border/60 px-4 py-3 space-y-2">
              {breakdown.map((b, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-border/40 last:border-0">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{b.marca}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {b.atingiu
                        ? `Rateio ${b.contrib.toFixed(1)}% do prêmio da marca`
                        : `Se atingir: ${formatCurrency(b.premioSeAtingir)}`}
                    </p>
                  </div>
                  <span className={cn('font-bold font-mono tabular-nums', b.premioIndividual > 0 ? 'text-emerald-400' : 'text-muted-foreground')}>
                    {formatCurrency(b.premioIndividual)}
                  </span>
                </div>
              ))}
            </div>
          </details>

          {historico.length > 1 && (
            <details className="rounded-lg border border-border/60 bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Histórico da campanha
              </summary>
              <div className="border-t border-border/60">
                <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-muted/35 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  <span>Mês</span>
                  <span className="text-right">Vendido</span>
                  <span className="text-center">Posição</span>
                  <span className="text-right">Prêmio</span>
                </div>
                {historico.map((h, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 px-4 py-2 text-xs border-t border-border/40 items-center">
                    <span className="font-medium capitalize">{h.label}</span>
                    <span className="text-right font-semibold font-mono tabular-nums">{formatCurrency(h.total)}</span>
                    <span className="text-center">{h.pos > 0 ? `#${h.pos}` : '-'}</span>
                    <span className={cn('text-right font-bold font-mono tabular-nums', h.premio > 0 ? 'text-emerald-400' : 'text-muted-foreground')}>
                      {formatCurrency(h.premio)}
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs border-t border-border/60 bg-muted/25 font-bold">
                  <span>Total campanha</span>
                  <span />
                  <span />
                  <span className="text-right text-emerald-400 font-mono tabular-nums">{formatCurrency(totalHistorico)}</span>
                </div>
              </div>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyCampanhas({ onCreate, isPending }: { onCreate: (i: CampanhaInput) => Promise<void>; isPending: boolean }) {
  return (
    <Card className="rounded-lg border-dashed">
      <CardContent className="py-14 flex flex-col items-center text-center gap-3">
        <div className="rounded-lg bg-primary/5 p-4"><Trophy className="h-10 w-10 text-primary/40" /></div>
        <div>
          <p className="font-semibold">Nenhuma campanha ainda</p>
          <p className="text-sm text-muted-foreground">Crie sua primeira campanha por marca para engajar o time.</p>
        </div>
        <CampanhaDialog onSubmit={onCreate} isPending={isPending}
          trigger={<Button size="sm" className="gap-1.5 rounded-lg"><Plus className="h-4 w-4" /> Criar campanha</Button>} />
      </CardContent>
    </Card>
  );
}

// =================== Dialog Criar/Editar (modelo "Força Total") ===================

function emptyMarca(): CampanhaMarca {
  return { marca: '', meta_mensal: 0, percentual_premio: 0 };
}

function CampanhaDialog({ initial, onSubmit, isPending, trigger, marcasDisponiveis = [] }: {
  initial?: Campanha;
  onSubmit: (input: CampanhaInput) => Promise<void>;
  isPending: boolean;
  trigger: React.ReactNode;
  marcasDisponiveis?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampanhaInput>({
    nome: '',
    marca: null,
    marcas: [emptyMarca(), emptyMarca()],
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
    meta_valor: 0,
    meta_geral_mensal: 0,
    bonus_meta_geral: 0,
    premiacao: '',
    descricao: '',
    mensagem_equipe: '',
    observacoes: '',
    status: 'ativa',
  });

  useEffect(() => {
    if (open && initial) {
      setForm({
        nome: initial.nome,
        marca: initial.marca,
        marcas: initial.marcas && initial.marcas.length > 0 ? initial.marcas : [emptyMarca()],
        data_inicio: initial.data_inicio,
        data_fim: initial.data_fim,
        meta_valor: Number(initial.meta_valor || 0),
        meta_geral_mensal: Number(initial.meta_geral_mensal || 0),
        bonus_meta_geral: Number(initial.bonus_meta_geral || 0),
        premiacao: initial.premiacao || '',
        descricao: initial.descricao || '',
        mensagem_equipe: initial.mensagem_equipe || '',
        observacoes: initial.observacoes || '',
        status: initial.status,
      });
    } else if (open && !initial) {
      setForm({
        nome: '',
        marca: null,
        marcas: [emptyMarca(), emptyMarca()],
        data_inicio: new Date().toISOString().slice(0, 10),
        data_fim: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
        meta_valor: 0,
        meta_geral_mensal: 0,
        bonus_meta_geral: 0,
        premiacao: '',
        descricao: '',
        mensagem_equipe: '',
        observacoes: '',
        status: 'ativa',
      });
    }
  }, [open, initial]);

  const updateMarca = (idx: number, patch: Partial<CampanhaMarca>) => {
    setForm(f => ({ ...f, marcas: f.marcas.map((m, i) => i === idx ? { ...m, ...patch } : m) }));
  };
  const addMarca = () => setForm(f => ({ ...f, marcas: [...f.marcas, emptyMarca()] }));
  const removeMarca = (idx: number) => setForm(f => ({ ...f, marcas: f.marcas.filter((_, i) => i !== idx) }));

  const totalMetaMarcas = form.marcas.reduce((a, m) => a + Number(m.meta_mensal || 0), 0);

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const marcasValidas = form.marcas.filter(m => m.marca.trim() && Number(m.meta_mensal) > 0);
    if (marcasValidas.length === 0 && !form.meta_geral_mensal) return;
    await onSubmit({ ...form, marcas: marcasValidas });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-primary" />
            {initial ? 'Editar campanha' : 'Nova campanha'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Identificação */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-primary text-white text-[10px] flex items-center justify-center font-bold">1</span>
              Identificação
            </h3>
            <div>
              <Label className="text-xs">Nome da campanha *</Label>
              <Input className="rounded-lg" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Força Total — MWM + Eaton" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Início</Label>
                <Input className="rounded-lg" type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input className="rounded-lg" type="date" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} />
              </div>
            </div>
          </section>

          {/* Meta geral + bônus */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-primary text-white text-[10px] flex items-center justify-center font-bold">2</span>
              Meta geral da empresa
            </h3>
              <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1"><DollarSign className="h-3 w-3 text-emerald-600" /> Meta mensal geral</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">R$</span>
                  <MoneyInputBRL className="rounded-lg pl-8" value={form.meta_geral_mensal} onChange={n => setForm({ ...form, meta_geral_mensal: n })} placeholder="1.500.000,00" />
                </div>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Gift className="h-3 w-3 text-amber-500" /> Bônus se bater meta geral</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">R$</span>
                  <MoneyInputBRL className="rounded-lg pl-8" value={form.bonus_meta_geral} onChange={n => setForm({ ...form, bonus_meta_geral: n })} placeholder="2.000,00" />
                </div>
              </div>
            </div>
          </section>

          {/* Marcas */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-primary text-white text-[10px] flex items-center justify-center font-bold">3</span>
                Metas por marca
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addMarca} className="h-7 gap-1 rounded-lg text-xs">
                <Plus className="h-3 w-3" /> Adicionar marca
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Para cada marca, defina a meta mensal e a premiação. Use <strong>%</strong> sobre a meta <em>ou</em> um <strong>valor fixo em R$</strong> (se preencher os dois, o % tem prioridade).
            </p>
            <div className="space-y-2">
              {form.marcas.map((m, idx) => {
                const metaPeriodo = Number(m.meta_mensal || 0) * Math.max(1, monthsBetween(new Date(form.data_inicio), new Date(form.data_fim)));
                const premioCalc = Number(m.percentual_premio || 0) > 0
                  ? metaPeriodo * (Number(m.percentual_premio) / 100)
                  : Number(m.premio_fixo || 0);
                return (
                  <div key={idx} className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-12 sm:col-span-5">
                        <Label className="text-[10px]">Marca</Label>
                        {(() => {
                          const opcoes = Array.from(new Set([...(marcasDisponiveis || []), ...(m.marca ? [m.marca] : [])])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
                          if (opcoes.length === 0) {
                            return <Input className="rounded-lg h-9" value={m.marca} onChange={e => updateMarca(idx, { marca: e.target.value })} placeholder="Nome da marca" />;
                          }
                          return (
                            <Select value={m.marca || undefined} onValueChange={v => updateMarca(idx, { marca: v })}>
                              <SelectTrigger className="rounded-lg h-9"><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
                              <SelectContent className="max-h-64">
                                {opcoes.map(op => (
                                  <SelectItem key={op} value={op}>{op}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </div>
                      <div className="col-span-11 sm:col-span-6">
                        <Label className="text-[10px] flex items-center gap-1"><DollarSign className="h-3 w-3 text-emerald-600" /> Meta mensal</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">R$</span>
                          <MoneyInputBRL className="rounded-lg h-9 pl-7" value={m.meta_mensal} onChange={n => updateMarca(idx, { meta_mensal: n })} placeholder="500.000,00" />
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {form.marcas.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => removeMarca(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6 sm:col-span-4">
                        <Label className="text-[10px] flex items-center gap-1"><Calculator className="h-3 w-3 text-primary" /> % sobre a meta</Label>
                        <div className="relative">
                          <Input className="rounded-lg h-9 pr-7" type="number" min="0" step="0.01" value={m.percentual_premio || ''} onChange={e => updateMarca(idx, { percentual_premio: Number(e.target.value) })} placeholder="0,5" />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">%</span>
                        </div>
                      </div>
                      <div className="col-span-6 sm:col-span-4">
                        <Label className="text-[10px] flex items-center gap-1"><Gift className="h-3 w-3 text-amber-500" /> Prêmio fixo</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">R$</span>
                          <MoneyInputBRL
                            className="rounded-lg h-9 pl-7"
                            value={m.premio_fixo}
                            onChange={n => updateMarca(idx, { premio_fixo: n })}
                            placeholder="1.000,00"
                            disabled={Number(m.percentual_premio || 0) > 0}
                          />

                        </div>
                      </div>
                      <div className="col-span-12 sm:col-span-4 text-right sm:text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-end gap-1">
                          <Gift className="h-3 w-3 text-amber-500" /> Prêmio no período
                        </p>
                        <p className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(premioCalc)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalMetaMarcas > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                Soma das metas de marca/mês: <strong className="text-foreground">{formatCurrency(totalMetaMarcas)}</strong>
              </p>
            )}
          </section>

          {/* Descrição da premiação */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                <Gift className="h-3 w-3" />
              </span>
              Descrição da premiação
            </h3>
            <div>
              <Label className="text-xs">Como a premiação será paga / entregue</Label>
              <Textarea
                className="rounded-lg"
                rows={3}
                value={form.premiacao || ''}
                onChange={e => setForm({ ...form, premiacao: e.target.value })}
                placeholder="Ex: 0,5% sobre o faturamento MWM + R$ 2.000 de bônus se bater a meta geral. Pago junto com a comissão do mês seguinte."
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Este texto aparece para a equipe no card da campanha. Os valores acima (% ou R$) são o que o sistema usa para calcular automaticamente.
              </p>
            </div>
          </section>

          {/* Mensagem + observações */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-primary text-white text-[10px] flex items-center justify-center font-bold">4</span>
              Comunicação
            </h3>
            <div>
              <Label className="text-xs">Mensagem para a equipe</Label>
              <Textarea className="rounded-lg" rows={3} value={form.mensagem_equipe || ''} onChange={e => setForm({ ...form, mensagem_equipe: e.target.value })} placeholder="Pessoal, estamos lançando a campanha..." />
            </div>
            <div>
              <Label className="text-xs">Observações finais / regras</Label>
              <Textarea className="rounded-lg" rows={2} value={form.observacoes || ''} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Ex: bônus pago mesmo se metas específicas não atingidas..." />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="pausada">Rascunho</SelectItem>
                  <SelectItem value="encerrada">Encerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-lg" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button className="rounded-lg" onClick={handleSave} disabled={isPending || !form.nome.trim()}>
            {isPending ? 'Salvando...' : 'Salvar campanha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampanhasSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-36" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
