import { useMemo } from 'react';
import { Building2, Hash, Users } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePedidosSaldoAVencer } from '@/hooks/usePedidosSaldoAVencer';
import type { SaldoAVencerFiltros } from './SaldoAVencerTab';

export const SALDO_TODOS = '__todos__';

interface Props {
  value: SaldoAVencerFiltros;
  onChange: (v: SaldoAVencerFiltros) => void;
}

/** Campos extras (Empresa, Código de empresa, Cliente) da barra de filtros — sub-aba Saldo a Vencer (1001). */
export function SaldoAVencerExtraFields({ value, onChange }: Props) {
  // Usa a mesma janela de datas da aba (mesma queryKey) para não disparar
  // uma segunda chamada ao endpoint de duplicatas.
  const periodoApi = useMemo(() => {
    const ano = value.ano && value.ano !== SALDO_TODOS ? Number(value.ano) : null;
    if (!ano) return {};
    const meses = String(value.mes ?? '')
      .split(',')
      .map((m) => Number(m.trim()))
      .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12)
      .sort((a, b) => a - b);
    const pad = (n: number) => String(n).padStart(2, '0');
    if (meses.length === 0) return { dataIni: `${ano}-01-01`, dataFim: `${ano}-12-31` };
    const ini = meses[0];
    const last = meses[meses.length - 1];
    const fim = new Date(ano, last, 0).getDate();
    return { dataIni: `${ano}-${pad(ini)}-01`, dataFim: `${ano}-${pad(last)}-${pad(fim)}` };
  }, [value.ano, value.mes]);


  const { data } = usePedidosSaldoAVencer(periodoApi);

  const opcoes = useMemo(() => {
    const empresas = new Set<string>();
    const codEmpresas = new Set<string>();
    const clientes = new Map<string, string>();
    for (const d of data ?? []) {
      if (String(d.Tipo).toUpperCase() !== 'RECEBER') continue;
      if (d.Empresa) empresas.add(String(d.Empresa));
      if (d.CodEmpresa_bi != null && String(d.CodEmpresa_bi).trim() !== '') {
        codEmpresas.add(String(d.CodEmpresa_bi));
      }
      const cod = String(d.CodCliente ?? '').trim();
      const nome = d.Cliente || d.CodClienteRazao || cod;
      if (cod && nome) clientes.set(nome, cod);
    }
    return {
      empresas: Array.from(empresas).sort((a, b) => a.localeCompare(b)),
      codEmpresas: Array.from(codEmpresas).sort((a, b) => a.localeCompare(b)),
      clientes: Array.from(clientes.keys()).sort((a, b) => a.localeCompare(b)),
    };
  }, [data]);

  const Label = ({ icon: Icon, children }: { icon: typeof Building2; children: React.ReactNode }) => (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );

  return (
    <>
      <div className="space-y-1.5">
        <Label icon={Building2}>Empresa</Label>
        <Select
          value={value.empresa ?? SALDO_TODOS}
          onValueChange={(v) => onChange({ ...value, empresa: v })}
        >
          <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[300px] bg-popover z-50">
            <SelectItem value={SALDO_TODOS}>Todas</SelectItem>
            {opcoes.empresas.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label icon={Hash}>Código de empresa</Label>
        <Select
          value={value.codEmpresa ?? SALDO_TODOS}
          onValueChange={(v) => onChange({ ...value, codEmpresa: v })}
        >
          <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[300px] bg-popover z-50">
            <SelectItem value={SALDO_TODOS}>Todos</SelectItem>
            {opcoes.codEmpresas.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label icon={Users}>Cliente</Label>
        <Select
          value={value.cliente ?? SALDO_TODOS}
          onValueChange={(v) => onChange({ ...value, cliente: v })}
        >
          <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[300px] bg-popover z-50">
            <SelectItem value={SALDO_TODOS}>Todos</SelectItem>
            {opcoes.clientes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
