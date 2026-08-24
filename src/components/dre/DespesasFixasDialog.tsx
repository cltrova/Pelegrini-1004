import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus, Search, Download, Check } from 'lucide-react';
import { DreRecord } from '@/types/dre';
import { formatCurrency } from '@/utils/formatters';
import { getEffectiveFixedAccountCodes, isGrupoFixoDre } from '@/utils/dreExpenseAccounts';
import * as XLSX from 'xlsx';

interface DespesasFixasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contasSelecionadas: Set<string>;
  excludedContas: Set<string>;
  onContasChange: (contas: Set<string>) => void;
  onExcludedContasChange: (contas: Set<string>) => void;
  allRecords: DreRecord[];
  contasDespVar: Set<string>;
}

export function DespesasFixasDialog({
  open,
  onOpenChange,
  contasSelecionadas,
  excludedContas,
  onContasChange,
  onExcludedContasChange,
  allRecords,
  contasDespVar,
}: DespesasFixasDialogProps) {
  const [search, setSearch] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [activeTab, setActiveTab] = useState('existentes');

  const [draftContas, setDraftContas] = useState<Set<string>>(new Set(contasSelecionadas));
  const [draftExcludedGrupo, setDraftExcludedGrupo] = useState<Set<string>>(new Set(excludedContas));
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftContas(new Set(contasSelecionadas));
      setDraftExcludedGrupo(new Set(excludedContas));
      setHasChanges(false);
      setActiveTab('existentes');
      setSearch('');
      setAddSearch('');
    }
  }, [open, contasSelecionadas, excludedContas]);

  const allAccounts = useMemo(() => {
    const map = new Map<string, { codigo: string; descricao: string; grupo: string; totalValor: number; isGrupoFixo: boolean }>();

    allRecords.forEach((r) => {
      const existing = map.get(r.codigo);
      const isGrupoFixo = isGrupoFixoDre(r.grupo);

      if (existing) {
        existing.totalValor += r.valor;
      } else {
        map.set(r.codigo, {
          codigo: r.codigo,
          descricao: r.descricao,
          grupo: r.grupo,
          totalValor: r.valor,
          isGrupoFixo,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [allRecords]);

  const effectiveFixedCodes = useMemo(() => {
    return getEffectiveFixedAccountCodes({
      allRecords,
      selectedFixedCodes: draftContas,
      excludedFixedCodes: draftExcludedGrupo,
      variableCodes: contasDespVar,
    });
  }, [allRecords, draftContas, draftExcludedGrupo, contasDespVar]);

  const allFixedAccounts = useMemo(() => {
    return allAccounts.filter((account) => effectiveFixedCodes.has(account.codigo));
  }, [allAccounts, effectiveFixedCodes]);

  const selectedAccounts = useMemo(() => {
    return allFixedAccounts.filter((account) => {
      if (!search) return true;
      const normalizedSearch = search.toLowerCase();

      return (
        account.codigo.toLowerCase().includes(normalizedSearch) ||
        account.descricao.toLowerCase().includes(normalizedSearch) ||
        account.grupo.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [allFixedAccounts, search]);

  const availableAccounts = useMemo(() => {
    return allAccounts
      .filter((account) => !effectiveFixedCodes.has(account.codigo) && !contasDespVar.has(account.codigo))
      .filter((account) => {
        if (!addSearch) return true;
        const normalizedSearch = addSearch.toLowerCase();

        return (
          account.codigo.toLowerCase().includes(normalizedSearch) ||
          account.descricao.toLowerCase().includes(normalizedSearch) ||
          account.grupo.toLowerCase().includes(normalizedSearch)
        );
      });
  }, [allAccounts, effectiveFixedCodes, contasDespVar, addSearch]);

  const totalSelecionado = useMemo(() => {
    return allFixedAccounts.reduce((sum, account) => sum + account.totalValor, 0);
  }, [allFixedAccounts]);

  const handleRemove = (codigo: string) => {
    const nextDraftContas = new Set(draftContas);
    nextDraftContas.delete(codigo);
    setDraftContas(nextDraftContas);

    const account = allAccounts.find((item) => item.codigo === codigo);
    if (account?.isGrupoFixo) {
      setDraftExcludedGrupo((prev) => new Set(prev).add(codigo));
    }

    setHasChanges(true);
  };

  const handleAdd = (codigo: string) => {
    const nextDraftContas = new Set(draftContas);
    nextDraftContas.add(codigo);
    setDraftContas(nextDraftContas);

    const nextExcludedGrupo = new Set(draftExcludedGrupo);
    nextExcludedGrupo.delete(codigo);
    setDraftExcludedGrupo(nextExcludedGrupo);

    setHasChanges(true);
  };

  const handleApply = () => {
    onContasChange(new Set(draftContas));
    onExcludedContasChange(new Set(draftExcludedGrupo));
    setHasChanges(false);
    onOpenChange(false);
  };

  const handleExportExcel = () => {
    const data = allFixedAccounts.map((account) => ({
      Código: account.codigo,
      Descrição: account.descricao,
      Grupo: account.grupo,
      Valor: account.totalValor,
    }));

    data.push({ Código: '', Descrição: 'TOTAL', Grupo: '', Valor: totalSelecionado });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Despesas Fixas');
    XLSX.writeFile(wb, 'despesas_fixas.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Despesas Fixas — Contas</span>
            <span className="text-sm font-normal text-muted-foreground">{allFixedAccounts.length} contas</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border px-4 py-3">
          <span className="text-sm font-semibold">Total Despesas Fixas</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">{formatCurrency(Math.abs(totalSelecionado))}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExportExcel} title="Exportar Excel">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existentes">Contas Existentes</TabsTrigger>
            <TabsTrigger value="adicionar">Adicionar Contas</TabsTrigger>
          </TabsList>

          <TabsContent value="existentes" className="flex-1 flex flex-col min-h-0 space-y-2 mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, descrição ou grupo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: '320px' }}>
              <div className="space-y-1 pr-2">
                {selectedAccounts.map((account) => (
                  <div key={account.codigo} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors group">
                    <span className="font-mono text-xs text-muted-foreground w-40 shrink-0">{account.codigo}</span>
                    <span className="flex-1 truncate">{account.descricao}</span>
                    {account.isGrupoFixo && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">grupo</span>
                    )}
                    <span className="text-xs font-medium shrink-0 w-28 text-right">{formatCurrency(account.totalValor)}</span>
                    <button
                      onClick={() => handleRemove(account.codigo)}
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity shrink-0"
                      title="Remover conta"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {selectedAccounts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {search ? 'Nenhuma conta encontrada' : 'Nenhuma conta selecionada'}
                  </p>
                )}
              </div>
            </div>
            {hasChanges && (
              <Button onClick={handleApply} className="gap-2 w-full">
                <Check className="h-4 w-4" />
                Aplicar alterações
              </Button>
            )}
          </TabsContent>

          <TabsContent value="adicionar" className="flex-1 flex flex-col min-h-0 space-y-2 mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, descrição ou grupo..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: '320px' }}>
              <div className="space-y-1 pr-2">
                {availableAccounts.slice(0, 50).map((account) => (
                  <div
                    key={account.codigo}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => handleAdd(account.codigo)}
                  >
                    <Plus className="h-3 w-3 text-primary shrink-0" />
                    <span className="font-mono text-xs text-muted-foreground w-40 shrink-0">{account.codigo}</span>
                    <span className="flex-1 truncate">{account.descricao}</span>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">{account.grupo}</span>
                    <span className="text-xs font-medium shrink-0 w-28 text-right">{formatCurrency(account.totalValor)}</span>
                  </div>
                ))}
                {availableAccounts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta disponível</p>
                )}
                {availableAccounts.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando 50 de {availableAccounts.length}. Use a busca para filtrar.
                  </p>
                )}
              </div>
            </div>
            {hasChanges && (
              <Button onClick={handleApply} className="gap-2 w-full">
                <Check className="h-4 w-4" />
                Aplicar alterações
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
