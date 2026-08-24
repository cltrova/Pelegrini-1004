import { FileSpreadsheet, Sparkles } from 'lucide-react';

export function AuthEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center animate-fade-in">
      <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center mb-4 relative">
        <FileSpreadsheet className="h-9 w-9 text-primary" />
        <Sparkles className="h-4 w-4 text-accent absolute top-2 right-2" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">Pronto para auditar</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Importe uma planilha de pedidos e compare automaticamente com os dados do sistema.
        Divergências e pedidos não encontrados são destacados em tempo real.
      </p>
    </div>
  );
}
