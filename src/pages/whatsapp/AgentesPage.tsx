import { useIsMobile } from '@/hooks/use-mobile';
import { WhatsappMobileBottomNav } from '@/components/layout/WhatsappMobileBottomNav';
import { AgentsTab } from '@/components/whatsapp/settings/agents/AgentsTab';

export default function AgentesPage() {
  const isMobile = useIsMobile();

  const content = (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-6xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Agentes</h1>
          <p className="text-muted-foreground">
            Centralize conversas internas por departamento e supervisione atendimentos com IA.
          </p>
        </div>
        <AgentsTab />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 overflow-hidden pb-20">{content}</div>
        <WhatsappMobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {content}
    </div>
  );
}
