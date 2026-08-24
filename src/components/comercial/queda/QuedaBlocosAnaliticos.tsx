import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search, X, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import type { ClienteQueda, SituacaoCliente } from '@/utils/quedaClientes';
import { classificarSituacao, SITUACAO_COLOR, SITUACAO_LABEL } from '@/utils/quedaClientes';

interface Props {
  clientes: ClienteQueda[];
  labelAtual: string;
  labelAnterior: string;
  situacaoExterna?: SituacaoCliente | null;
  onSituacaoExterna?: (s: SituacaoCliente | null) => void;
  clienteFoco?: string | null;
  onLimparClienteFoco?: () => void;
}

const FILTROS: { key: SituacaoCliente | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'parou', label: 'Pararam de comprar' },
  { key: 'caiu_forte', label: 'Caíram forte' },
  { key: 'caiu_leve', label: 'Caíram pouco' },
  { key: 'ok', label: 'Estáveis ou cresceram' },
];

export function QuedaBlocosAnaliticos({
  clientes, labelAtual, labelAnterior,
  situacaoExterna = null, onSituacaoExterna, clienteFoco = null, onLimparClienteFoco,
}: Props) {
  const [q, setQ] = useState('');
  const [situacaoLocal, setSituacaoLocal] = useState<SituacaoCliente | 'todos'>('todos');
  const situacao: SituacaoCliente | 'todos' = situacaoExterna ?? situacaoLocal;
  const setSituacao = (v: SituacaoCliente | 'todos') => {
    setSituacaoLocal(v);
    onSituacaoExterna?.(v === 'todos' ? null : v);
  };

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return clientes.filter(c => {
      if (clienteFoco && String(c.codigo) !== clienteFoco) return false;
      if (situacao !== 'todos' && classificarSituacao(c) !== situacao) return false;
      if (!termo) return true;
      return (c.razao || '').toLowerCase().includes(termo) ||
        (c.fantasia || '').toLowerCase().includes(termo) ||
        String(c.codigo).includes(termo);
    });
  }, [clientes, q, situacao, clienteFoco]);

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [q, situacao, clientes, clienteFoco]);
  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visiveis = filtrados.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);


  return (
    <Card className="premium-card">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            Todos os clientes
            <Badge variant="secondary">{filtrados.length}</Badge>
          </CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>
        {clienteFoco && (
          <div className="flex">
            <Badge variant="secondary" className="cursor-pointer gap-1" onClick={() => onLimparClienteFoco?.()}>
              Cliente selecionado <X className="h-3 w-3" />
            </Badge>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {FILTROS.map(f => (
            <Button
              key={f.key}
              size="sm"
              variant={situacao === f.key ? 'default' : 'outline'}
              onClick={() => setSituacao(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Cliente</th>
                <th className="text-right px-4 py-2">Comprava antes<br /><span className="normal-case text-[10px]">{labelAnterior}</span></th>
                <th className="text-right px-4 py-2">Comprou agora<br /><span className="normal-case text-[10px]">{labelAtual}</span></th>
                <th className="text-right px-4 py-2">Diferença R$</th>
                <th className="text-right px-4 py-2">Diferença %</th>
                <th className="text-right px-4 py-2">Pedidos<br /><span className="normal-case text-[10px]">agora / antes</span></th>
                <th className="text-right px-4 py-2">Dias sem comprar</th>
                <th className="text-center px-4 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(c => {
                const negativo = c.variacaoValor < 0;
                const s = classificarSituacao(c);
                return (
                  <tr key={String(c.codigo)} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2">
                      <div className="font-medium truncate max-w-[240px]">{c.fantasia || c.razao}</div>
                      <div className="text-[11px] text-muted-foreground">{c.vendedor_nome || 'Sem vendedor'}</div>
                    </td>
                    <td className="px-4 py-2 text-right mono-value">{formatCurrency(c.faturamentoP2)}</td>
                    <td className="px-4 py-2 text-right mono-value">{formatCurrency(c.faturamentoP1)}</td>
                    <td className={`px-4 py-2 text-right mono-value ${negativo ? 'text-red-500' : 'text-green-500'}`}>
                      {formatCurrency(c.variacaoValor)}
                    </td>
                    <td className={`px-4 py-2 text-right mono-value font-semibold ${negativo ? 'text-red-500' : 'text-green-500'}`}>
                      <span className="inline-flex items-center gap-1">
                        {negativo ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        {c.variacaoPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right mono-value">{c.pedidosP1} / {c.pedidosP2}</td>
                    <td className="px-4 py-2 text-right mono-value">{c.diasSemCompra != null ? `${c.diasSemCompra}` : '—'}</td>
                    <td className="px-4 py-2 text-center">
                      <Badge style={{ backgroundColor: SITUACAO_COLOR[s], color: 'white' }}>
                        {SITUACAO_LABEL[s]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtrados.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Mostrando {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtrados.length)} de {filtrados.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">Página {safePage + 1} de {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
