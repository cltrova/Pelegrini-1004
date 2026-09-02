import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { RequireRole } from '@/components/auth/RequireRole';
import { EstoqueAssistantSettings } from '@/components/configuracoes/EstoqueAssistantSettings';
import { PelegriniPageSurface } from '@/components/pelegrini';
import { Button } from '@/components/ui/button';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';

function EstoqueAssistantSettingsPageContent() {
  const navigate = useNavigate();
  const { codEmpresaAtiva } = useEmpresaAtiva();

  return (
    <PelegriniPageSurface moduleKey="operacional" className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/configuracoes')} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Configurações
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <EstoqueAssistantSettings codEmpresaBi={codEmpresaAtiva ?? ''} />
      </main>
    </PelegriniPageSurface>
  );
}

export default function EstoqueAssistantSettingsPage() {
  return (
    <RequireRole allowedRoles={['master']}>
      <EstoqueAssistantSettingsPageContent />
    </RequireRole>
  );
}
