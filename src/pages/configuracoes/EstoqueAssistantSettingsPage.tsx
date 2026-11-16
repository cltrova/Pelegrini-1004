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
    <PelegriniPageSurface moduleKey="operacional">
      <main className="mx-auto min-h-0 w-full max-w-5xl flex-1 space-y-2 overflow-auto px-4 py-4 sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/configuracoes')} className="gap-2">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Configurações
        </Button>
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
