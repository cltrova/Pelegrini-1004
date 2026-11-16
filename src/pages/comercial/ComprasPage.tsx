import { ShoppingBasket } from 'lucide-react';

export default function ComprasPage() {
  return (
    <main className="commercial-workspace flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
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
