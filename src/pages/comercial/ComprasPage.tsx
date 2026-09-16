import { ShoppingBasket } from 'lucide-react';

export default function ComprasPage() {
  return (
    <main className="commercial-workspace flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
      <header className="commercial-toolbar flex min-h-11 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <ShoppingBasket aria-hidden="true" className="h-5 w-5 text-primary" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">Compras</h1>
          <p className="text-xs text-muted-foreground">Casa da Transmissão</p>
        </div>
      </header>

      <section
        aria-label="Compras da Casa da Transmissão"
        className="commercial-data-viewport flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"
      >
        <div className="w-full max-w-xl border border-border bg-card p-6 text-center">
          <ShoppingBasket aria-hidden="true" className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-base font-semibold text-foreground">Acompanhamento de compras</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Área comercial exclusiva da Casa da Transmissão para concentrar informações de compras.
          </p>
        </div>
      </section>
    </main>
  );
}