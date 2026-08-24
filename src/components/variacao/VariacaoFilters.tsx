import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, Building2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const MESES = [
  { value: '01', label: 'janeiro' },
  { value: '02', label: 'fevereiro' },
  { value: '03', label: 'março' },
  { value: '04', label: 'abril' },
  { value: '05', label: 'maio' },
  { value: '06', label: 'junho' },
  { value: '07', label: 'julho' },
  { value: '08', label: 'agosto' },
  { value: '09', label: 'setembro' },
  { value: '10', label: 'outubro' },
  { value: '11', label: 'novembro' },
  { value: '12', label: 'dezembro' },
];

interface VariacaoFiltersProps {
  anos: string[];
  anoSelecionado: string;
  onAnoChange: (value: string) => void;
  mesesSelecionados: string[];
  onMesesChange: (value: string[]) => void;
  empresa?: string;
  empresas: string[];
  onEmpresaChange: (value: string | undefined) => void;
  onBuscar?: () => void;
  hasChanges?: boolean;
}

export function VariacaoFilters({
  anos,
  anoSelecionado,
  onAnoChange,
  mesesSelecionados,
  onMesesChange,
  empresa,
  empresas,
  onEmpresaChange,
  onBuscar,
  hasChanges = false,
}: VariacaoFiltersProps) {
  const { isMaster } = useAuth();
  const meses = mesesSelecionados || [];

  const toggleMes = (mes: string) => {
    if (meses.includes(mes)) {
      // Não permitir desmarcar o último mês
      if (meses.length > 1) {
        onMesesChange(meses.filter((m) => m !== mes));
      }
    } else {
      onMesesChange([...meses, mes].sort());
    }
  };

  const selecionarTodos = () => {
    onMesesChange(MESES.map((m) => m.value));
  };

  const limparSelecao = () => {
    onMesesChange([MESES[0].value]); // Mantém pelo menos janeiro
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        {/* Ano */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Ano:</span>
          <Select value={anoSelecionado} onValueChange={onAnoChange}>
            <SelectTrigger className="w-[120px] bg-primary/10 border-primary/30">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-8 w-px bg-border" />

        {/* Empresa - APENAS para master com múltiplas empresas */}
        {isMaster && empresas.length > 1 && (
          <>
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
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="h-8 w-px bg-border" />
          </>
        )}

        {/* Ações rápidas de meses */}
        <div className="flex items-center gap-2">
          <button
            onClick={selecionarTodos}
            className="text-xs text-primary hover:underline"
          >
            Todos
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={limparSelecao}
            className="text-xs text-primary hover:underline"
          >
            Limpar
          </button>
        </div>

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

      {/* Toggle de meses */}
      <div className="flex flex-wrap gap-1">
        {MESES.map((mes) => {
          const isSelected = meses.includes(mes.value);
          return (
            <button
              key={mes.value}
              onClick={() => toggleMes(mes.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 border',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              )}
            >
              {mes.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
