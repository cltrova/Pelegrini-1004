import { useMemo, useState } from 'react';
import { UserPlus, Download, Users, DollarSign, ShoppingCart, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useComercialRawData } from '@/hooks/useComercialData';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { StatCard } from '@/components/common/StatCard';
import { UnifiedFilterBar } from '@/components/common/UnifiedFilterBar';
import { FilterDropdownChip, MultiSelectOptions, SingleSelectOptions } from '@/components/common/FilterDropdownChip';
import { toast } from 'sonner';

const PERIODO_OPTIONS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '15', label: 'Últimos 15 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '60', label: 'Últimos 60 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '180', label: 'Últimos 180 dias' },
  { value: '365', label: 'Últimos 12 meses' },
];

interface AggRow {
  vendedorKey: string;
  vendedor: string;
  valorTotal: number;
  qtdVendas: number;
  qtdClientesNovos: number;
  participacao: number;
}

interface Diagnostics {
  brutos: number;
  desc_devolucao: number;
  desc_pendente: number;
  desc_valor_zero: number;
  desc_sem_cliente: number;
  desc_duplicado: number;
  desc_outra_empresa: number;
  validos: number;
  clientesNovos: number;
  pedidosDeNovos: number;
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Constrói intervalo [inicio, fim] em YYYY-MM-DD para "últimos N dias" (inclui hoje). */
function buildPeriodo(dias: number): { inicio: string; fim: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - (dias - 1));
  return { inicio: toLocal(inicio), fim: toLocal(hoje) };
}

function parseDataISO(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s === 'null') return null;
  // Normaliza "YYYY-MM-DDTHH:MM:SS" e "YYYY-MM-DD"
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function EstoqueRelatorioNovosClientesTab() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();

  const [pending, setPending] = useState({
    periodoDias: '30',
    vendedores: [] as string[],
    minVendas: 1,
  });
  const [applied, setApplied] = useState(pending);

  // Período REAL enviado à API — derivado do filtro aplicado.
  const periodo = useMemo(
    () => buildPeriodo(Number(applied.periodoDias) || 30),
    [applied.periodoDias],
  );

  const { data: rawData, isLoading, error, isFetching } = useComercialRawData(periodo);
  const allPedidos = rawData?.pedidos || [];

  // Options do filtro de vendedor (usa nomes reais do pool carregado)
  const vendedorOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of allPedidos) {
      const n = String(p.vendedor_nome ?? '').trim();
      if (n) s.add(n);
    }
    return [...s].sort();
  }, [allPedidos]);

  // ---------------- Pipeline de cálculo ----------------
  const { rows, totals, diag, extras } = useMemo(() => {
    const inicio = new Date(`${periodo.inicio}T00:00:00`);
    const fim = new Date(`${periodo.fim}T23:59:59`);

    const d: Diagnostics = {
      brutos: allPedidos.length,
      desc_devolucao: 0,
      desc_pendente: 0,
      desc_valor_zero: 0,
      desc_sem_cliente: 0,
      desc_duplicado: 0,
      desc_outra_empresa: 0,
      validos: 0,
      clientesNovos: 0,
      pedidosDeNovos: 0,
    };

    // 1) Filtragem estrita: PEDIDO faturado com valor > 0, cliente válido,
    //    respeitando cod_empresa_bi da empresa ativa quando disponível.
    const dedupeIds = new Set<string>();
    const linhasValidas: typeof allPedidos = [];

    for (const p of allPedidos) {
      // Empresa ativa
      if (codEmpresaAtiva) {
        const bi = String((p as any).cod_empresa_bi ?? '').trim();
        if (bi && bi !== String(codEmpresaAtiva)) {
          d.desc_outra_empresa++;
          continue;
        }
      }
      // Devolução
      if (String((p as any).tipo ?? 'PEDIDO').toUpperCase() === 'DEVOLUCAO') {
        d.desc_devolucao++;
        continue;
      }
      // Pendente (sem data_faturamento OU status != faturado)
      const status = String(p.status ?? '').toLowerCase();
      const temFat = !!(p.data_faturamento && String(p.data_faturamento).trim() && String(p.data_faturamento) !== 'null');
      if (status !== 'faturado' || !temFat) {
        d.desc_pendente++;
        continue;
      }
      // Valor > 0 (usa valor_liquido normalizado; se zero, tenta valor_liquido_coluna/valor_bruto)
      const valor =
        Number(p.valor_liquido || 0) ||
        Number((p as any).valor_liquido_coluna || 0) ||
        Number(p.valor_bruto || 0);
      if (!(valor > 0)) {
        d.desc_valor_zero++;
        continue;
      }
      // Cliente válido
      const cli = String(p.cliente_codigo ?? '').trim();
      if (!cli) {
        d.desc_sem_cliente++;
        continue;
      }
      // Deduplicação por cod_pedido (numero) quando != 0
      const num = String(p.numero ?? '').trim();
      const idKey = num && num !== '0' ? `P:${num}:${cli}` : `L:${p.id}`;
      if (dedupeIds.has(idKey)) {
        d.desc_duplicado++;
        continue;
      }
      dedupeIds.add(idKey);
      linhasValidas.push(p);
    }
    d.validos = linhasValidas.length;

    // 2) Detecta "cliente novo" por data_cadastro_cliente ∈ [inicio, fim]
    //    Um cliente é novo se PELO MENOS uma linha válida trouxer data_cadastro
    //    dentro da janela. Consolida por cliente_codigo.
    const cadastroPorCliente = new Map<string, Date>();
    for (const p of linhasValidas) {
      const cli = String(p.cliente_codigo).trim();
      const dc = parseDataISO((p as any).data_cadastro_cliente);
      if (!dc) continue;
      const cur = cadastroPorCliente.get(cli);
      if (!cur || dc < cur) cadastroPorCliente.set(cli, dc);
    }
    const clientesNovos = new Set<string>();
    cadastroPorCliente.forEach((dc, cli) => {
      if (dc >= inicio && dc <= fim) clientesNovos.add(cli);
    });
    d.clientesNovos = clientesNovos.size;

    // 3) Pedidos válidos cujo cliente é novo
    const pedidosDeNovos = linhasValidas.filter(p =>
      clientesNovos.has(String(p.cliente_codigo).trim()),
    );
    d.pedidosDeNovos = pedidosDeNovos.length;

    // 4) Agrega por vendedor (cod fallback nome)
    const agg = new Map<string, { nome: string; valor: number; qtd: number; clientes: Set<string> }>();
    for (const p of pedidosDeNovos) {
      const cod = String(p.vendedor_codigo ?? '').trim();
      const nome = String(p.vendedor_nome ?? '').trim() || 'SEM VENDEDOR';
      const key = cod ? `C:${cod}` : `N:${nome.toUpperCase()}`;
      const cur = agg.get(key) || { nome, valor: 0, qtd: 0, clientes: new Set<string>() };
      const valor =
        Number(p.valor_liquido || 0) ||
        Number((p as any).valor_liquido_coluna || 0) ||
        Number(p.valor_bruto || 0);
      cur.valor += valor;
      cur.qtd += 1;
      cur.clientes.add(String(p.cliente_codigo).trim());
      cur.nome = cur.nome || nome;
      agg.set(key, cur);
    }

    let rowsArr: AggRow[] = [...agg.entries()].map(([k, v]) => ({
      vendedorKey: k,
      vendedor: v.nome,
      valorTotal: v.valor,
      qtdVendas: v.qtd,
      qtdClientesNovos: v.clientes.size,
      participacao: 0,
    }));

    // 5) Filtros da UI aplicados sobre a agregação (não sobre os brutos)
    if (applied.vendedores.length > 0) {
      const setSel = new Set(applied.vendedores.map(s => s.toUpperCase()));
      rowsArr = rowsArr.filter(r => setSel.has(r.vendedor.toUpperCase()));
    }
    if (applied.minVendas > 1) {
      rowsArr = rowsArr.filter(r => r.qtdVendas >= applied.minVendas);
    }

    const totalValor = rowsArr.reduce((s, r) => s + r.valorTotal, 0);
    rowsArr.forEach(r => {
      r.participacao = totalValor > 0 ? (r.valorTotal / totalValor) * 100 : 0;
    });
    rowsArr.sort((a, b) => b.valorTotal - a.valorTotal);

    // 6) Clientes únicos considerando também o filtro de vendedor da UI +
    //    agregações auxiliares: top clientes, distribuição por UF, evolução diária
    const clientesFiltrados = new Set<string>();
    const clienteAgg = new Map<string, { codigo: string; nome: string; cidade: string; uf: string; vendedor: string; valor: number; pedidos: number; primeiraCompra: Date | null; dataCadastro: Date | null }>();
    const ufAgg = new Map<string, { clientes: Set<string>; valor: number; pedidos: number }>();
    const diaAgg = new Map<string, { clientes: Set<string>; valor: number; pedidos: number }>();
    const pad2 = (n: number) => String(n).padStart(2, '0');

    for (const p of pedidosDeNovos) {
      const nomeVend = String(p.vendedor_nome ?? '').trim().toUpperCase();
      if (applied.vendedores.length > 0 && !applied.vendedores.some(v => v.toUpperCase() === nomeVend)) continue;

      const cli = String(p.cliente_codigo).trim();
      clientesFiltrados.add(cli);

      const valor =
        Number(p.valor_liquido || 0) ||
        Number((p as any).valor_liquido_coluna || 0) ||
        Number(p.valor_bruto || 0);

      // Por cliente
      const cur = clienteAgg.get(cli) || {
        codigo: cli,
        nome: String(p.cliente_razao ?? p.cliente_fantasia ?? `Cliente ${cli}`).trim(),
        cidade: String(p.cliente_cidade ?? '').trim(),
        uf: String(p.cliente_uf ?? '').trim().toUpperCase(),
        vendedor: String(p.vendedor_nome ?? '').trim(),
        valor: 0,
        pedidos: 0,
        primeiraCompra: null as Date | null,
        dataCadastro: parseDataISO((p as any).data_cadastro_cliente),
      };
      cur.valor += valor;
      cur.pedidos += 1;
      const dFat = parseDataISO(p.data_faturamento);
      if (dFat && (!cur.primeiraCompra || dFat < cur.primeiraCompra)) cur.primeiraCompra = dFat;
      clienteAgg.set(cli, cur);

      // Por UF
      const uf = String(p.cliente_uf ?? '').trim().toUpperCase() || 'N/D';
      const uCur = ufAgg.get(uf) || { clientes: new Set<string>(), valor: 0, pedidos: 0 };
      uCur.clientes.add(cli);
      uCur.valor += valor;
      uCur.pedidos += 1;
      ufAgg.set(uf, uCur);

      // Evolução diária (por data de faturamento)
      if (dFat) {
        const key = `${dFat.getFullYear()}-${pad2(dFat.getMonth() + 1)}-${pad2(dFat.getDate())}`;
        const dCur = diaAgg.get(key) || { clientes: new Set<string>(), valor: 0, pedidos: 0 };
        dCur.clientes.add(cli);
        dCur.valor += valor;
        dCur.pedidos += 1;
        diaAgg.set(key, dCur);
      }
    }

    const topClientes = [...clienteAgg.values()]
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    const porUF = [...ufAgg.entries()]
      .map(([uf, v]) => ({ uf, clientes: v.clientes.size, valor: v.valor, pedidos: v.pedidos }))
      .sort((a, b) => b.valor - a.valor);

    const evolucaoDiaria = [...diaAgg.entries()]
      .map(([data, v]) => ({ data, clientes: v.clientes.size, valor: v.valor, pedidos: v.pedidos }))
      .sort((a, b) => a.data.localeCompare(b.data));

    const totalVendas = rowsArr.reduce((s, r) => s + r.qtdVendas, 0);
    const ticketMedio = totalVendas > 0 ? totalValor / totalVendas : 0;
    const valorMedioPorCliente = clientesFiltrados.size > 0 ? totalValor / clientesFiltrados.size : 0;

    return {
      rows: rowsArr,
      totals: {
        valor: totalValor,
        vendas: totalVendas,
        clientes: clientesFiltrados.size,
        ticketMedio,
        valorMedioPorCliente,
      },
      extras: { topClientes, porUF, evolucaoDiaria },
      diag: d,
    };
  }, [allPedidos, applied, periodo, codEmpresaAtiva]);

  const apply = () => setApplied({ ...pending });
  const clear = () => {
    const cleared = { periodoDias: '30', vendedores: [] as string[], minVendas: 1 };
    setPending(cleared);
    setApplied(cleared);
  };

  const activeCount =
    (applied.periodoDias !== '30' ? 1 : 0) +
    (applied.vendedores.length > 0 ? 1 : 0) +
    (applied.minVendas > 1 ? 1 : 0);

  const summary = [
    PERIODO_OPTIONS.find(o => o.value === applied.periodoDias)?.label,
    `${periodo.inicio} → ${periodo.fim}`,
    applied.vendedores.length > 0 ? `${applied.vendedores.length} vendedor(es)` : null,
    applied.minVendas > 1 ? `Mín. ${applied.minVendas} vendas` : null,
    filialAtiva ? `Filial: ${filialAtiva}` : null,
  ].filter(Boolean).join(' · ');

  const exportCSV = () => {
    const header = ['Vendedor', 'Valor Total', 'Qtd Vendas', 'Clientes Novos', '%'];
    const csv = [header, ...rows.map(r => [
      r.vendedor,
      r.valorTotal.toFixed(2).replace('.', ','),
      String(r.qtdVendas),
      String(r.qtdClientesNovos),
      r.participacao.toFixed(2).replace('.', ','),
    ])].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novos_clientes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} linhas exportadas`);
  };

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState message="Erro ao carregar dados comerciais." />;

  const maxValor = Math.max(...rows.map(r => r.valorTotal), 1);
  const naoTemDadosBrutos = !allPedidos.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Novos Clientes por Vendedor</h2>
            <p className="text-xs text-muted-foreground">
              Clientes cujo <b>cadastro</b> ocorreu no período selecionado (apenas vendas faturadas, exclui devoluções).
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} disabled={!rows.length}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <UnifiedFilterBar activeCount={activeCount} summary={summary} onClear={clear} onApply={apply}>
        <FilterDropdownChip
          label="Período"
          displayValue={PERIODO_OPTIONS.find(o => o.value === pending.periodoDias)?.label || ''}
          isActive={pending.periodoDias !== '30'}
          onClear={() => { setPending(f => ({ ...f, periodoDias: '30' })); setApplied(f => ({ ...f, periodoDias: '30' })); }}
        >
          <SingleSelectOptions
            options={PERIODO_OPTIONS}
            selected={pending.periodoDias}
            onChange={(v) => setPending(f => ({ ...f, periodoDias: v }))}
          />
        </FilterDropdownChip>

        <FilterDropdownChip
          label="Vendedor"
          displayValue={pending.vendedores.length > 0 ? `${pending.vendedores.length} selecionado(s)` : 'Todos'}
          isActive={pending.vendedores.length > 0}
          onClear={() => { setPending(f => ({ ...f, vendedores: [] })); setApplied(f => ({ ...f, vendedores: [] })); }}
        >
          <MultiSelectOptions
            options={vendedorOptions}
            selected={pending.vendedores}
            onChange={(v) => setPending(f => ({ ...f, vendedores: v }))}
            searchable
            allLabel="Todos"
          />
        </FilterDropdownChip>

        <FilterDropdownChip
          label="Mín. Vendas"
          displayValue={pending.minVendas > 1 ? `≥ ${pending.minVendas}` : 'Qualquer'}
          isActive={pending.minVendas > 1}
          onClear={() => { setPending(f => ({ ...f, minVendas: 1 })); setApplied(f => ({ ...f, minVendas: 1 })); }}
        >
          <div className="space-y-1 p-1 min-w-[200px]">
            <label className="text-[11px] text-muted-foreground">
              Quantidade mínima de vendas por vendedor
            </label>
            <Input
              type="number"
              min={1}
              placeholder="Ex: 5"
              value={pending.minVendas}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPending(f => ({ ...f, minVendas: Number.isFinite(v) && v > 0 ? v : 1 }));
              }}
              className="h-8 text-xs"
            />
          </div>
        </FilterDropdownChip>
      </UnifiedFilterBar>

      {/* Painel de validação/diagnóstico */}
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs">
        <div className="flex items-center gap-2 font-medium mb-2">
          <Info className="h-3.5 w-3.5 text-blue-500" />
          Validação da carga {isFetching && <span className="text-muted-foreground">(atualizando…)</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 tabular-nums text-muted-foreground">
          <div>Período real enviado: <span className="text-foreground">{periodo.inicio} → {periodo.fim}</span></div>
          <div>Empresa ativa: <span className="text-foreground">{codEmpresaAtiva ?? '—'}</span> {filialAtiva && <>· filial <span className="text-foreground">{filialAtiva}</span></>}</div>
          <div>Registros brutos: <span className="text-foreground">{diag.brutos}</span></div>
          <div>Linhas válidas: <span className="text-foreground">{diag.validos}</span></div>
          <div>Descartes · devolução: <span className="text-foreground">{diag.desc_devolucao}</span></div>
          <div>Descartes · pendente/não faturado: <span className="text-foreground">{diag.desc_pendente}</span></div>
          <div>Descartes · valor zero: <span className="text-foreground">{diag.desc_valor_zero}</span></div>
          <div>Descartes · sem cliente: <span className="text-foreground">{diag.desc_sem_cliente}</span></div>
          <div>Descartes · duplicidade: <span className="text-foreground">{diag.desc_duplicado}</span></div>
          <div>Descartes · outra empresa: <span className="text-foreground">{diag.desc_outra_empresa}</span></div>
          <div>Clientes novos (cadastro no período): <span className="text-foreground">{diag.clientesNovos}</span></div>
          <div>Pedidos desses novos clientes: <span className="text-foreground">{diag.pedidosDeNovos}</span></div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          title="Faturamento (novos clientes)"
          value={formatBRL(totals.valor)}
          icon={<DollarSign className="h-5 w-5" />}
          color="primary"
        />
        <StatCard
          title="Clientes novos únicos"
          value={totals.clientes.toLocaleString('pt-BR')}
          icon={<Users className="h-5 w-5" />}
          color="accent"
        />
        <StatCard
          title="Pedidos gerados"
          value={totals.vendas.toLocaleString('pt-BR')}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          title="Ticket médio (pedido)"
          value={formatBRL(totals.ticketMedio)}
          subtitle="Valor médio por pedido"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Valor médio por cliente"
          value={formatBRL(totals.valorMedioPorCliente)}
          subtitle="Faturamento ÷ clientes novos"
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
          <h3 className="text-sm font-semibold">Novos Clientes</h3>
          <Badge variant="secondary" className="text-xs tabular-nums">
            {rows.length} vendedor(es)
          </Badge>
        </div>
        {rows.length === 0 ? (
          <div className="p-8">
            <EmptyState
              message={
                naoTemDadosBrutos
                  ? 'Nenhum dado comercial disponível para o período.'
                  : 'Nenhum cliente novo (por data de cadastro) no período com os filtros aplicados.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Vendedor</th>
                  <th className="text-right px-4 py-2 font-medium">Valor Total</th>
                  <th className="text-right px-4 py-2 font-medium">Vendas</th>
                  <th className="text-right px-4 py-2 font-medium">Clientes</th>
                  <th className="text-right px-4 py-2 font-medium w-[35%]">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.vendedorKey} className={i % 2 ? 'bg-muted/10' : ''}>
                    <td className="px-4 py-2 font-medium truncate max-w-[220px]" title={r.vendedor}>
                      {r.vendedor}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatBRL(r.valorTotal)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.qtdVendas.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.qtdClientesNovos.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[160px]">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(r.valorTotal / maxValor) * 100}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs w-14 text-right">
                          {r.participacao.toFixed(2).replace('.', ',')}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-muted/30 text-sm font-semibold">
                <tr>
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatBRL(totals.valor)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{totals.vendas.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{totals.clientes.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2 text-right tabular-nums">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Grid: Top novos clientes + Distribuição por UF */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top novos clientes */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
            <h3 className="text-sm font-semibold">Top 10 Novos Clientes</h3>
            <Badge variant="secondary" className="text-xs tabular-nums">
              {extras.topClientes.length} cliente(s)
            </Badge>
          </div>
          {extras.topClientes.length === 0 ? (
            <div className="p-6"><EmptyState message="Sem clientes novos no período." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Cliente</th>
                    <th className="text-left px-4 py-2 font-medium">UF</th>
                    <th className="text-right px-4 py-2 font-medium">Pedidos</th>
                    <th className="text-right px-4 py-2 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {extras.topClientes.map((c, i) => (
                    <tr key={c.codigo} className={i % 2 ? 'bg-muted/10' : ''}>
                      <td className="px-4 py-2 font-medium truncate max-w-[240px]" title={`${c.nome} (${c.codigo})`}>
                        <div className="truncate">{c.nome}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {c.codigo}{c.cidade ? ` · ${c.cidade}` : ''}{c.vendedor ? ` · ${c.vendedor}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs">{c.uf || '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{c.pedidos.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatBRL(c.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Distribuição por UF */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
            <h3 className="text-sm font-semibold">Distribuição por UF</h3>
            <Badge variant="secondary" className="text-xs tabular-nums">
              {extras.porUF.length} UF(s)
            </Badge>
          </div>
          {extras.porUF.length === 0 ? (
            <div className="p-6"><EmptyState message="Sem dados por UF." /></div>
          ) : (
            <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
              {(() => {
                const maxUf = Math.max(...extras.porUF.map(u => u.valor), 1);
                return extras.porUF.map(u => (
                  <div key={u.uf} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{u.uf}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {u.clientes} cliente(s) · {u.pedidos} pedido(s) · <span className="text-foreground">{formatBRL(u.valor)}</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${(u.valor / maxUf) * 100}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Evolução diária */}
      {extras.evolucaoDiaria.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
            <h3 className="text-sm font-semibold">Evolução Diária (pedidos de novos clientes)</h3>
            <Badge variant="secondary" className="text-xs tabular-nums">
              {extras.evolucaoDiaria.length} dia(s)
            </Badge>
          </div>
          <div className="overflow-x-auto max-h-[320px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                  <th className="text-right px-4 py-2 font-medium">Clientes</th>
                  <th className="text-right px-4 py-2 font-medium">Pedidos</th>
                  <th className="text-right px-4 py-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {extras.evolucaoDiaria.map((d, i) => (
                  <tr key={d.data} className={i % 2 ? 'bg-muted/10' : ''}>
                    <td className="px-4 py-2 tabular-nums">
                      {d.data.split('-').reverse().join('/')}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.clientes.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.pedidos.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatBRL(d.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
