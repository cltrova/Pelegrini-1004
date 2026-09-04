import { useIsMobile } from '@/hooks/use-mobile';
import { WhatsappMobileBottomNav } from '@/components/layout/WhatsappMobileBottomNav';
import { AgentsTab } from '@/components/whatsapp/settings/agents/AgentsTab';

export default function AgentesPage() {
  const isMobile = useIsMobile();

  const content = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="container mx-auto flex min-h-0 max-w-6xl flex-1 flex-col overflow-hidden p-4">
        <div className="mb-3 shrink-0">
          <h1 className="text-2xl font-bold text-foreground">Agentes</h1>
          <p className="text-muted-foreground">
            Centralize conversas internas por departamento e supervisione atendimentos com IA.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          <AgentsTab />
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-hidden pb-20">{content}</div>
        <WhatsappMobileBottomNav />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {content}
    </div>
  );
}
