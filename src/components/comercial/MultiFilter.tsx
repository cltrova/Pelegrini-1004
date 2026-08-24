import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, Check } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  width?: string; // e.g. 'w-44' (default) ou 'w-56'
}

export function MultiFilter({ label, options, selected, onChange, width = 'w-44' }: Props) {
  const toggle = (o: string) => {
    onChange(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o]);
  };
  const active = selected.length > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
          style={{
            background: active ? '#3B82F614' : '#161F32',
            color: active ? '#3B82F6' : '#94A3B8',
            border: `1px solid ${active ? '#3B82F655' : 'rgba(148,163,184,0.10)'}`,
          }}
        >
          <Filter className="w-3 h-3" />
          {label}{active ? ` (${selected.length})` : ''}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={`${width} p-1 max-h-72 overflow-y-auto`}
        style={{ background: '#111827', border: '1px solid rgba(148,163,184,0.15)' }}
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
          {active && (
            <button onClick={() => onChange([])} className="text-[10px] text-blue-400 hover:underline">
              Limpar
            </button>
          )}
        </div>
        {options.map(o => {
          const sel = selected.includes(o);
          return (
            <button
              key={o}
              onClick={() => toggle(o)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-slate-700/40 text-left"
              style={{ color: sel ? '#3B82F6' : '#E5E7EB' }}
            >
              <span className="truncate pr-2">{o}</span>
              {sel && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          );
        })}
        {options.length === 0 && (
          <p className="px-2 py-2 text-[11px] text-slate-500">Sem dados</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
