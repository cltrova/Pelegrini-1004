import { useMemo, useState } from 'react';
import { Database, Settings2, Search, Save, X, Check, ChevronDown, ChevronRight, Calculator, FileText, Info, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDfcLineConfig, DfcLineConfigRow, DfcModo } from '@/hooks/useDfcLineConfig';
import { useVariacaoData, ESTRUTURA_DFC } from '@/hooks/useVariacaoData';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';

interface ContaAgrupada {
  numConta: string;
  descricao: string;
  grupo: string;
  total: number;
}

export function DfcConfigTab() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { config, isLoading, upsertMany, isSaving } = useDfcLineConfig();
  const { data: variacaoData } = useVariacaoData();
  const [busca, setBusca] = useState('');
  const [draft, setDraft] = useState<Record<string, DfcLineConfigRow>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const contasPorGrupo = useMemo(() => {
    const map = new Map<string, Map<string, ContaAgrupada>>();
    if (!variacaoData) return map;
    variacaoData.forEach(r => {
      if (!r.Grupo || !r.NumConta) return;
      if (!map.has(r.Grupo)) map.set(r.Grupo, new Map());
      const inner = map.get(r.Grupo)!;
      const existing = inner.get(r.NumConta);
      if (existing) {
        existing.total += Number(r.Valor) || 0;
      } else {
        inner.set(r.NumConta, {
          numConta: r.NumConta,
          descricao: r.Descricao || '',
          grupo: r.Grupo,
          total: Number(r.Valor) || 0,
        });
      }
    });
    return map;
  }, [variacaoData]);

  const todasContas = useMemo<ContaAgrupada[]>(() => {
    const arr: ContaAgrupada[] = [];
    contasPorGrupo.forEach(inner => inner.forEach(c => arr.push(c)));
    return arr.sort((a, b) => a.numConta.localeCompare(b.numConta));
  }, [contasPorGrupo]);

  const linhasFiltradas = useMemo(() => {
    if (!busca) return config;
    const q = busca.toLowerCase();
    return config.filter(l =>
      l.descricao.toLowerCase().includes(q) ||
      (l.grupo ?? '').toLowerCase().includes(q) ||
      l.secao.toLowerCase().includes(q)
    );
  }, [config, busca]);

  const linhasPorSecao = useMemo(() => {
    const groups: Record<string, DfcLineConfigRow[]> = {};
    linhasFiltradas.forEach(l => {
      if (!groups[l.secao]) groups[l.secao] = [];
      groups[l.secao].push(l);
    });
    return groups;
  }, [linhasFiltradas]);

  const getEffective = (linha: DfcLineConfigRow): DfcLineConfigRow => draft[linha.linha_id] ?? linha;

  const setField = (linha: DfcLineConfigRow, patch: Partial<DfcLineConfigRow>) => {
    setDraft(prev => ({
      ...prev,
      [linha.linha_id]: { ...getEffective(linha), ...patch },
    }));
  };

  const toggleConta = (linha: DfcLineConfigRow, numConta: string) => {
    const eff = getEffective(linha);
    const existe = eff.contas.includes(numConta);
    const novas = existe ? eff.contas.filter(c => c !== numConta) : [...eff.contas, numConta];
    setField(linha, { contas: novas });
  };

  const handleSalvar = async () => {
    const alterados = Object.values(draft);
    if (!alterados.length) return;
    await upsertMany(alterados);
    setDraft({});
  };

  const handleDescartar = () => setDraft({});

  const getEstruturaInfo = (linhaId: string) => ESTRUTURA_DFC.find(e => e.id === linhaId) as any;

  if (!codEmpresaAtiva) {
    return <EmptyState title="Selecione uma empresa" message="Escolha uma empresa ativa para configurar a DFC." />;
  }
  if (isLoading) return <LoadingState message="Carregando configuração..." />;

  const totalAlterados = Object.keys(draft).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Configuração das linhas da DFC</h2>
          <p className="text-sm text-muted-foreground">
            Para cada linha escolha um dos 3 modos: somar só o <strong>Grupo</strong>, somar o <strong>Grupo + Contas extras</strong> (ex.: incluir PCLD em "Contas a Receber"), ou somar <strong>só Contas</strong> selecionadas manualmente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalAlterados > 0 && (
            <Button variant="outline" size="sm" onClick={handleDescartar} disabled={isSaving}>
              <X className="h-4 w-4 mr-1" /> Descartar ({totalAlterados})
            </Button>
          )}
          <Button size="sm" onClick={handleSalvar} disabled={isSaving || totalAlterados === 0}>
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? 'Salvando...' : `Salvar (${totalAlterados})`}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar linha por descrição, seção ou grupo..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Legenda */}
      <Card className="p-3 bg-muted/30">
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
          <Info className="h-3.5 w-3.5" /> Modos disponíveis
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 shrink-0">
              <Database className="h-3 w-3 mr-1" /> Só Grupo
            </Badge>
            <span>Soma todas as contas onde <code className="px-1 rounded bg-background">Grupo = "X"</code> no JSON.</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30 shrink-0">
              <Plus className="h-3 w-3 mr-1" /> Grupo + Contas extras
            </Badge>
            <span>Soma o Grupo padrão <strong>e mais</strong> contas avulsas que você marcar (ex.: PCLD junto com Contas a Receber).</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 shrink-0">
              <Settings2 className="h-3 w-3 mr-1" /> Só Contas
            </Badge>
            <span>Ignora o Grupo. Soma apenas as <code className="px-1 rounded bg-background">NumConta</code> que você marcar.</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 shrink-0">
              <FileText className="h-3 w-3 mr-1" /> DRE / <Calculator className="h-3 w-3 mx-1" /> Calculado
            </Badge>
            <span>Não editáveis. Vêm da tela DRE (Resultado Líquido) ou são totalizadores derivados.</span>
          </div>
        </div>
      </Card>

      {Object.keys(linhasPorSecao).length === 0 ? (
        <EmptyState title="Nenhuma linha encontrada" message="Ajuste o termo da busca." />
      ) : (
        <div className="space-y-4">
          {Object.entries(linhasPorSecao).map(([secao, linhas]) => (
            <Card key={secao} className="p-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">{secao}</h3>
              <div className="divide-y divide-border">
                {linhas.map(linha => {
                  const eff = getEffective(linha);
                  const dirty = !!draft[linha.linha_id];
                  const estrutura = getEstruturaInfo(linha.linha_id);
                  const fonteEspecial = estrutura?.fonte;
                  const editavel = !fonteEspecial;
                  const grupoNome = eff.grupo ?? '';
                  const contasDoGrupo = grupoNome
                    ? Array.from(contasPorGrupo.get(grupoNome)?.values() ?? [])
                    : [];
                  const contasExtrasInfo = eff.contas.map(num => todasContas.find(c => c.numConta === num)).filter(Boolean) as ContaAgrupada[];
                  const totalGrupo = contasDoGrupo.reduce((s, c) => s + c.total, 0);
                  const totalExtras = contasExtrasInfo.reduce((s, c) => s + c.total, 0);
                  const isExpanded = !!expanded[linha.linha_id];
                  const modo: DfcModo = eff.modo;

                  let totalLinha = 0;
                  if (modo === 'grupo') totalLinha = totalGrupo;
                  else if (modo === 'contas') totalLinha = totalExtras;
                  else totalLinha = totalGrupo + totalExtras;

                  return (
                    <div key={linha.linha_id} className={cn('py-3 -mx-3 px-3 rounded-md', dirty && 'bg-primary/5')}>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                        {/* Descrição + filtro real */}
                        <div className="md:col-span-5 min-w-0">
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => setExpanded(p => ({ ...p, [linha.linha_id]: !p[linha.linha_id] }))}
                              className="mt-0.5 p-0.5 rounded hover:bg-muted/60"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{eff.descricao}</p>
                              <p className="text-xs text-muted-foreground">
                                {fonteEspecial === 'dre' && <>Origem: <strong>tela de DRE</strong> (Resultado Líquido).</>}
                                {fonteEspecial === 'calculado' && <>Origem: <strong>totalizador</strong> derivado de outras linhas.</>}
                                {!fonteEspecial && modo === 'grupo' && <>Soma: <code className="px-1 rounded bg-muted text-foreground">Grupo = "{grupoNome}"</code></>}
                                {!fonteEspecial && modo === 'grupo_mais_contas' && <>Soma: <code className="px-1 rounded bg-muted text-foreground">Grupo = "{grupoNome}"</code> + {eff.contas.length} conta(s) extra(s)</>}
                                {!fonteEspecial && modo === 'contas' && <>Soma: apenas {eff.contas.length} conta(s) selecionada(s)</>}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Seletor de modo */}
                        <div className="md:col-span-5 flex items-center gap-1 flex-wrap">
                          {fonteEspecial === 'dre' && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">
                              <FileText className="h-3 w-3 mr-1" /> DRE
                            </Badge>
                          )}
                          {fonteEspecial === 'calculado' && (
                            <Badge variant="outline" className="bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30">
                              <Calculator className="h-3 w-3 mr-1" /> Calculado
                            </Badge>
                          )}
                          {editavel && (
                            <>
                              <ModoButton
                                active={modo === 'grupo'}
                                onClick={() => setField(linha, { modo: 'grupo' })}
                                color="emerald"
                                icon={<Database className="h-3 w-3" />}
                                label="Só Grupo"
                              />
                              <ModoButton
                                active={modo === 'grupo_mais_contas'}
                                onClick={() => setField(linha, { modo: 'grupo_mais_contas' })}
                                color="violet"
                                icon={<Plus className="h-3 w-3" />}
                                label="Grupo + Extras"
                              />
                              <ModoButton
                                active={modo === 'contas'}
                                onClick={() => setField(linha, { modo: 'contas' })}
                                color="amber"
                                icon={<Settings2 className="h-3 w-3" />}
                                label="Só Contas"
                              />

                              {(modo === 'grupo_mais_contas' || modo === 'contas') && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 text-xs">
                                      {modo === 'grupo_mais_contas' ? `+ ${eff.contas.length} extra(s)` : `${eff.contas.length} conta(s)`}
                                      <Search className="h-3 w-3 ml-1" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[460px] p-0" align="end">
                                    <ContasPicker
                                      contas={todasContas}
                                      selecionadas={eff.contas}
                                      onToggle={(num) => toggleConta(linha, num)}
                                      grupoExcluir={modo === 'grupo_mais_contas' ? grupoNome : undefined}
                                    />
                                  </PopoverContent>
                                </Popover>
                              )}
                            </>
                          )}
                        </div>

                        {/* Inverter sinal */}
                        <div className="md:col-span-2 flex items-center gap-1 justify-end" title="Inverte o sinal final da linha">
                          <span className="text-xs text-muted-foreground">−/+</span>
                          <Switch
                            checked={eff.invert_sinal}
                            onCheckedChange={(checked) => setField(linha, { invert_sinal: checked })}
                            disabled={!editavel}
                          />
                        </div>
                      </div>

                      {/* Detalhe expansível */}
                      {isExpanded && (
                        <div className="mt-3 ml-7 rounded-md border border-border bg-muted/20 p-3 text-xs space-y-3">
                          {fonteEspecial === 'dre' && (
                            <p className="text-muted-foreground">Esta linha vem do <strong>Resultado Líquido</strong> calculado na tela de DRE para o mesmo período. Não é editável aqui.</p>
                          )}
                          {fonteEspecial === 'calculado' && (
                            <p className="text-muted-foreground">Esta linha é um <strong>totalizador</strong> derivado de outras linhas da DFC. Não é editável aqui.</p>
                          )}

                          {!fonteEspecial && (modo === 'grupo' || modo === 'grupo_mais_contas') && (
                            <div>
                              <p className="text-muted-foreground mb-1">
                                <strong className="text-foreground">Contas do Grupo</strong> <code className="px-1 rounded bg-background">"{grupoNome}"</code> ({contasDoGrupo.length}):
                              </p>
                              {contasDoGrupo.length === 0 ? (
                                <p className="text-muted-foreground italic">Nenhuma conta no JSON com este grupo.</p>
                              ) : (
                                <ul className="space-y-1 max-h-40 overflow-y-auto">
                                  {contasDoGrupo.sort((a, b) => a.numConta.localeCompare(b.numConta)).map(c => (
                                    <li key={c.numConta} className="flex items-center justify-between gap-2 py-0.5">
                                      <span className="font-mono text-foreground">{c.numConta}</span>
                                      <span className="flex-1 truncate text-muted-foreground">{c.descricao}</span>
                                      <span className={cn('font-mono shrink-0', c.total < 0 ? 'text-destructive' : 'text-foreground')}>{formatCurrency(c.total)}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <p className="text-right font-semibold mt-1 text-foreground">Subtotal Grupo: {formatCurrency(totalGrupo)}</p>
                            </div>
                          )}

                          {!fonteEspecial && (modo === 'grupo_mais_contas' || modo === 'contas') && (
                            <div>
                              <p className="text-muted-foreground mb-1">
                                <strong className="text-foreground">{modo === 'grupo_mais_contas' ? 'Contas extras' : 'Contas selecionadas'}</strong> ({contasExtrasInfo.length}):
                              </p>
                              {contasExtrasInfo.length === 0 ? (
                                <p className="text-muted-foreground italic">Nenhuma conta selecionada. Use o botão acima para escolher.</p>
                              ) : (
                                <ul className="space-y-1 max-h-40 overflow-y-auto">
                                  {contasExtrasInfo.sort((a, b) => a.numConta.localeCompare(b.numConta)).map(c => (
                                    <li key={c.numConta} className="flex items-center justify-between gap-2 py-0.5">
                                      <span className="font-mono text-foreground">{c.numConta}</span>
                                      <span className="flex-1 truncate text-muted-foreground">{c.descricao}</span>
                                      <span className="text-[10px] text-muted-foreground shrink-0">{c.grupo}</span>
                                      <span className={cn('font-mono shrink-0', c.total < 0 ? 'text-destructive' : 'text-foreground')}>{formatCurrency(c.total)}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <p className="text-right font-semibold mt-1 text-foreground">Subtotal {modo === 'grupo_mais_contas' ? 'Extras' : 'Contas'}: {formatCurrency(totalExtras)}</p>
                            </div>
                          )}

                          {!fonteEspecial && (
                            <div className="pt-2 border-t border-border flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Total da linha {modo === 'grupo_mais_contas' && <span className="text-[10px]">(Grupo + Extras)</span>}:
                              </span>
                              <span className={cn('font-bold text-sm', totalLinha < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                                {formatCurrency(totalLinha)}
                              </span>
                            </div>
                          )}

                          <p className="text-[10px] text-muted-foreground">
                            Valores acima somam <strong>todos os períodos</strong> do JSON (preview). No relatório real, a soma é filtrada pelo período da DFC.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ModoButton({
  active, onClick, color, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  color: 'emerald' | 'violet' | 'amber';
  icon: React.ReactNode;
  label: string;
}) {
  const colorMap = {
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40',
    violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/40',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/40',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-all',
        active
          ? colorMap[color] + ' font-semibold ring-1 ring-current/30'
          : 'border-border text-muted-foreground hover:bg-muted/60'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ContasPicker({
  contas,
  selecionadas,
  onToggle,
  grupoExcluir,
}: {
  contas: ContaAgrupada[];
  selecionadas: string[];
  onToggle: (numConta: string) => void;
  grupoExcluir?: string;
}) {
  const [q, setQ] = useState('');
  const filtradas = useMemo(() => {
    let base = contas;
    if (grupoExcluir) {
      base = base.filter(c => c.grupo !== grupoExcluir);
    }
    if (!q) return base.slice(0, 300);
    const t = q.toLowerCase();
    return base
      .filter(c =>
        c.numConta.toLowerCase().includes(t) ||
        c.descricao.toLowerCase().includes(t) ||
        c.grupo.toLowerCase().includes(t)
      )
      .slice(0, 300);
  }, [contas, q, grupoExcluir]);

  return (
    <div className="flex flex-col">
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar conta (NumConta, descrição, grupo)..."
            className="pl-7 h-8 text-sm"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {selecionadas.length} selecionada(s) • mostrando {filtradas.length}{grupoExcluir && ' (contas do grupo padrão são ocultadas — já entram automaticamente)'}
        </p>
      </div>
      <ScrollArea className="h-72">
        <div className="p-1">
          {filtradas.map(c => {
            const checked = selecionadas.includes(c.numConta);
            return (
              <button
                key={c.numConta}
                onClick={() => onToggle(c.numConta)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/60 flex items-start gap-2',
                  checked && 'bg-primary/10'
                )}
              >
                <div
                  className={cn(
                    'h-4 w-4 rounded border flex items-center justify-center shrink-0 mt-0.5',
                    checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-foreground truncate">{c.numConta}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.descricao}</p>
                  {c.grupo && <p className="text-[10px] text-muted-foreground/70 truncate">{c.grupo}</p>}
                </div>
              </button>
            );
          })}
          {filtradas.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conta encontrada</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
