import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, Building2, Search, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const MESES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

interface DFCFiltersProps {
  anos: string[];
  anoPeriodo1: string;
  mesPeriodo1: string;
  anoPeriodo2: string;
  mesPeriodo2: string;
  onAnoPeriodo1Change: (value: string) => void;
  onMesPeriodo1Change: (value: string) => void;
  onAnoPeriodo2Change: (value: string) => void;
  onMesPeriodo2Change: (value: string) => void;
  empresa?: string;
  empresas: string[];
  onEmpresaChange: (value: string | undefined) => void;
  onBuscar?: () => void;
  hasChanges?: boolean;
}

export function DFCFilters({
  anos,
  anoPeriodo1,
  mesPeriodo1,
  anoPeriodo2,
  mesPeriodo2,
  onAnoPeriodo1Change,
  onMesPeriodo1Change,
  onAnoPeriodo2Change,
  onMesPeriodo2Change,
  empresa,
  empresas,
  onEmpresaChange,
  onBuscar,
  hasChanges = false,
}: DFCFiltersProps) {
  const { isMaster } = useAuth();

  const getMesLabel = (mes: string) => {
    return MESES.find(m => m.value === mes)?.label || mes;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Período 1 */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Período 1:</span>
          <Select value={anoPeriodo1} onValueChange={onAnoPeriodo1Change}>
            <SelectTrigger className="w-[100px] bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mesPeriodo1} onValueChange={onMesPeriodo1Change}>
            <SelectTrigger className="w-[130px] bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground" />

        {/* Período 2 */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Período 2:</span>
          <Select value={anoPeriodo2} onValueChange={onAnoPeriodo2Change}>
            <SelectTrigger className="w-[100px] bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mesPeriodo2} onValueChange={onMesPeriodo2Change}>
            <SelectTrigger className="w-[130px] bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Empresa - APENAS para master com múltiplas empresas */}
        {isMaster && empresas.length > 1 && (
          <>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Empresa:</span>
              <Select
                value={empresa || 'all'}
                onValueChange={(v) => onEmpresaChange(v === 'all' ? undefined : v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Botão Buscar */}
        {onBuscar && (
          <>
            <div className="h-8 w-px bg-border" />
            <Button
              onClick={onBuscar}
              className={hasChanges ? 'animate-pulse' : ''}
            >
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </>
        )}
      </div>

      {/* Info sobre os períodos */}
      <div className="pt-3 border-t border-border/30 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30" />
          Período 1: Janeiro até {getMesLabel(mesPeriodo1)}/{anoPeriodo1}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
          Período 2: Janeiro até {getMesLabel(mesPeriodo2)}/{anoPeriodo2}
        </span>
      </div>
    </div>
  );
}
