import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus, Search, Download, Check } from 'lucide-react';
import { DreRecord } from '@/types/dre';
import { formatCurrency } from '@/utils/formatters';
import { getEffectiveVariableAccountCodes, isGrupoVariavelDre } from '@/utils/dreExpenseAccounts';
import * as XLSX from 'xlsx';

interface DespesasVariaveisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contasSelecionadas: Set<string>;
  excludedContas: Set<string>;
  onContasChange: (contas: Set<string>) => void;
  onExcludedContasChange: (contas: Set<string>) => void;
  allRecords: DreRecord[];
}

export function DespesasVariaveisDialog({
  open,
  onOpenChange,
  contasSelecionadas,
  excludedContas,
  onContasChange,
  onExcludedContasChange,
  allRecords,
}: DespesasVariaveisDialogProps) {
  const [search, setSearch] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [activeTab, setActiveTab] = useState('existentes');

  // Local draft state for pending changes
  const [draftContas, setDraftContas] = useState<Set<string>>(new Set(contasSelecionadas));
  const [draftExcludedGrupo, setDraftExcludedGrupo] = useState<Set<string>>(new Set(excludedContas));
  const [hasChanges, setHasChanges] = useState(false);

  // Sync draft when dialog opens or parent changes
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
    const map = new Map<string, { codigo: string; descricao: string; grupo: string; totalValor: number; isGrupoVar: boolean }>();
    allRecords.forEach(r => {
      const existing = map.get(r.codigo);
      const isGrupoVar = isGrupoVariavelDre(r.grupo);
      if (existing) {
        existing.totalValor += r.valor;
      } else {
        map.set(r.codigo, { codigo: r.codigo, descricao: r.descricao, grupo: r.grupo, totalValor: r.valor, isGrupoVar });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [allRecords]);

  const effectiveVariableCodes = useMemo(() => {
    return getEffectiveVariableAccountCodes({
      allRecords,
      selectedVariableCodes: draftContas,
      excludedVariableCodes: draftExcludedGrupo,
    });
  }, [allRecords, draftContas, draftExcludedGrupo]);

  const allVariableAccounts = useMemo(() => {
    return allAccounts.filter((account) => effectiveVariableCodes.has(account.codigo));
  }, [allAccounts, effectiveVariableCodes]);

  const selectedAccounts = useMemo(() => {
    return allVariableAccounts.filter(a => {
      if (!search) return true;
      const s = search.toLowerCase();
      return a.codigo.toLowerCase().includes(s) || a.descricao.toLowerCase().includes(s) || a.grupo.toLowerCase().includes(s);
    });
  }, [allVariableAccounts, search]);

  const availableAccounts = useMemo(() => {
    return allAccounts
      .filter((account) => !effectiveVariableCodes.has(account.codigo))
      .filter(a => {
        if (!addSearch) return true;
        const s = addSearch.toLowerCase();
        return a.codigo.toLowerCase().includes(s) || a.descricao.toLowerCase().includes(s) || a.grupo.toLowerCase().includes(s);
      });
  }, [allAccounts, effectiveVariableCodes, addSearch]);

  const totalSelecionado = useMemo(() => {
    return allVariableAccounts.reduce((sum, a) => sum + a.totalValor, 0);
  }, [allVariableAccounts]);

  const handleRemove = (codigo: string) => {
    const account = allAccounts.find(a => a.codigo === codigo);
    if (account?.isGrupoVar) {
      const next = new Set(draftExcludedGrupo);
      next.add(codigo);
      setDraftExcludedGrupo(next);
    } else {
      const next = new Set(draftContas);
      next.delete(codigo);
      setDraftContas(next);
    }
    setHasChanges(true);
  };

  const handleAdd = (codigo: string) => {
    const account = allAccounts.find(a => a.codigo === codigo);
    if (account?.isGrupoVar) {
      const next = new Set(draftExcludedGrupo);
      next.delete(codigo);
      setDraftExcludedGrupo(next);
    } else {
      const next = new Set(draftContas);
      next.add(codigo);
      setDraftContas(next);
    }
    setHasChanges(true);
  };

  const handleApply = () => {
    onContasChange(new Set(draftContas));
    onExcludedContasChange(new Set(draftExcludedGrupo));
    setHasChanges(false);
    onOpenChange(false);
  };

  const handleExportExcel = () => {
    const data = allVariableAccounts.map(a => ({
      'Código': a.codigo,
      'Descrição': a.descricao,
      'Grupo': a.grupo,
      'Valor': a.totalValor,
    }));
    data.push({ 'Código': '', 'Descrição': 'TOTAL', 'Grupo': '', 'Valor': totalSelecionado });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Despesas Variáveis');
    XLSX.writeFile(wb, 'despesas_variaveis.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Despesas Variáveis — Contas</span>
            <span className="text-sm font-normal text-muted-foreground">
              {allVariableAccounts.length} contas
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Total + Export */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border px-4 py-3">
          <span className="text-sm font-semibold">Total Despesas Variáveis</span>
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

          {/* Tab: Existing accounts */}
          <TabsContent value="existentes" className="flex-1 flex flex-col min-h-0 space-y-2 mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, descrição ou grupo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: '320px' }}>
              <div className="space-y-1 pr-2">
                {selectedAccounts.map(a => (
                  <div key={a.codigo} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors group">
                    <span className="font-mono text-xs text-muted-foreground w-40 shrink-0">{a.codigo}</span>
                    <span className="flex-1 truncate">{a.descricao}</span>
                    {a.isGrupoVar && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">grupo</span>
                    )}
                    <span className="text-xs font-medium shrink-0 w-28 text-right">{formatCurrency(a.totalValor)}</span>
                    <button
                      onClick={() => handleRemove(a.codigo)}
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

          {/* Tab: Add accounts */}
          <TabsContent value="adicionar" className="flex-1 flex flex-col min-h-0 space-y-2 mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, descrição ou grupo..."
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: '320px' }}>
              <div className="space-y-1 pr-2">
                {availableAccounts.slice(0, 50).map(a => (
                  <div
                    key={a.codigo}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => handleAdd(a.codigo)}
                  >
                    <Plus className="h-3 w-3 text-primary shrink-0" />
                    <span className="font-mono text-xs text-muted-foreground w-40 shrink-0">{a.codigo}</span>
                    <span className="flex-1 truncate">{a.descricao}</span>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">{a.grupo}</span>
                    <span className="text-xs font-medium shrink-0 w-28 text-right">{formatCurrency(a.totalValor)}</span>
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
