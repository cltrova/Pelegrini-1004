import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  fileName?: string;
  fileSize?: number;
  loading?: boolean;
  hasData: boolean;
  onFile: (file: File) => void;
  onClear?: () => void;
  onRun: () => void;
  canRun: boolean;
  hint?: string;
}

function formatSize(b?: number) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function AuthDropzone({ fileName, fileSize, loading, hasData, onFile, onClear, onRun, canRun, hint }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 md:p-6 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-5 items-stretch">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex-1 relative cursor-pointer rounded-xl border-2 border-dashed transition-all',
            'flex flex-col items-center justify-center text-center px-6 py-8 min-h-[180px]',
            dragging
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border/70 hover:border-primary/50 hover:bg-muted/40',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          {hasData ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-2xl bg-success/10 text-success flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                {fileName}
                <span className="text-xs text-muted-foreground">· {formatSize(fileSize)}</span>
              </div>
              {hint && <p className="text-xs text-muted-foreground max-w-md">{hint}</p>}
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onClear?.(); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Trocar arquivo
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'h-14 w-14 rounded-2xl flex items-center justify-center mb-3 transition',
                  dragging ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                )}
              >
                <Upload className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {dragging ? 'Solte para enviar' : 'Arraste sua planilha aqui'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                ou <span className="text-primary font-medium">clique para selecionar</span> · .xlsx · .xls
              </p>
            </>
          )}
        </div>

        <div className="md:w-64 flex flex-col gap-3 justify-center">
          <div className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">Como funciona</p>
            <p>Compara cada linha da planilha com os pedidos do sistema no período detectado, destacando divergências de valor e cliente.</p>
          </div>
          <Button onClick={onRun} disabled={!canRun || loading} size="lg" className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {loading ? 'Processando...' : 'Executar autenticação'}
          </Button>
        </div>
      </div>
    </div>
  );
}
