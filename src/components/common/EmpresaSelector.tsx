import { Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EmpresaSelectorProps {
  empresas: string[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  showAll?: boolean;
  disabled?: boolean;
}

export function EmpresaSelector({
  empresas,
  value,
  onChange,
  placeholder = 'Selecione a empresa',
  showAll = true,
  disabled = false,
}: EmpresaSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {showAll && (
            <SelectItem value="__all__">Todas as empresas</SelectItem>
          )}
          {empresas.map((empresa) => (
            <SelectItem key={empresa} value={empresa}>
              {empresa}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
