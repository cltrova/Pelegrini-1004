import { useIsMobile } from '@/hooks/use-mobile';
import { WhatsappMobileBottomNav } from '@/components/layout/WhatsappMobileBottomNav';
import { AgentsTab } from '@/components/whatsapp/settings/agents/AgentsTab';

export default function AgentesPage() {
  const isMobile = useIsMobile();

  const content = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="container mx-auto flex min-h-0 max-w-6xl flex-1 flex-col overflow-hidden p-4">
        <h1 className="sr-only">Agentes</h1>
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
