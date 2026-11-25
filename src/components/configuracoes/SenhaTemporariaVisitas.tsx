import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function SenhaTemporariaVisitas({ senha }: { senha: string }) {
  const [aviso, setAviso] = useState('');
  return (
    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-4">
      <p className="text-sm font-medium">Senha temporária gerada</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="select-all break-all rounded border bg-background px-3 py-2 text-sm">{senha}</code>
        <Button type="button" size="sm" variant="outline" onClick={async () => {
          try {
            await navigator.clipboard.writeText(senha);
            setAviso('Senha copiada.');
          } catch {
            setAviso('Selecione a senha para copiar.');
          }
        }}>Copiar senha</Button>
        {aviso && <span className="text-xs text-muted-foreground" role="status">{aviso}</span>}
      </div>
      <p className="text-sm text-muted-foreground">Compartilhe o endereço e a senha com o visitador. Ele vai definir a própria senha no primeiro acesso.</p>
      <a href="/" target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-primary underline">
        {window.location.origin}
      </a>
    </div>
  );
}
