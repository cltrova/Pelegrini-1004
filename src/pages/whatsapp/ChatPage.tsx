import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ConversationList } from '@/components/whatsapp/ConversationList';
import { ChatArea } from '@/components/whatsapp/ChatArea';
import { ChatDetails } from '@/components/whatsapp/ChatDetails';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { WhatsappMobileBottomNav } from '@/components/layout/WhatsappMobileBottomNav';
import { Header } from '@/components/layout/Header';
import { useWhatsappConversations, useWhatsappRealtime, useMarkAsRead } from '@/hooks/useWhatsappData';
import type { ConversationFilters } from '@/types/whatsapp';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { EmpresaSelectorDialog } from '@/components/common/EmpresaSelectorDialog';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { PelegriniBranchBadge } from '@/components/pelegrini';

type MobileView = 'list' | 'chat' | 'details';

export default function ChatPage() {
  const isMobile = useIsMobile();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva);
  const { hasEmpresaSelecionada, isMaster, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [filters, setFilters] = useState<ConversationFilters>({});
  const [showEmpresaDialog, setShowEmpresaDialog] = useState(false);
  
  const { data: conversations, isLoading } = useWhatsappConversations(filters);
  const { subscribeToConversations } = useWhatsappRealtime(selectedConversationId);
  const markAsRead = useMarkAsRead();
  
  // Subscribe to realtime updates
  useEffect(() => {
    const unsubscribe = subscribeToConversations();
    return unsubscribe;
  }, []);
  
  // Show empresa selector if master user has no empresa selected
  useEffect(() => {
    if (!isLoadingEmpresa && isMaster && !hasEmpresaSelecionada) {
      setShowEmpresaDialog(true);
    }
  }, [isLoadingEmpresa, isMaster, hasEmpresaSelecionada]);
  
  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversationId) {
      markAsRead.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);
  
  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    if (isMobile) {
      setMobileView('chat');
    }
  };
  
  const handleBack = () => {
    if (mobileView === 'details') {
      setMobileView('chat');
    } else {
      setMobileView('list');
      setSelectedConversationId(undefined);
    }
  };
  
  const handleOpenDetails = () => {
    if (isMobile) {
      setMobileView('details');
    } else {
      setIsDetailsOpen(!isDetailsOpen);
    }
  };
  
  // Mobile version
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {mobileView === 'list' && (
          <>
            <MobileHeader title="Conversas" subtitle="WhatsApp" />
            <div className="flex-1 overflow-y-auto pb-20">
              <ConversationList
                conversations={conversations || []}
                selectedId={selectedConversationId}
                onSelect={handleSelectConversation}
                filters={filters}
                onFiltersChange={setFilters}
                isLoading={isLoading}
              />
            </div>
            <WhatsappMobileBottomNav />
          </>
        )}
        
        {mobileView === 'chat' && selectedConversationId && (
          <div className="h-screen flex flex-col overflow-hidden">
            <ChatArea
              conversationId={selectedConversationId}
              onBack={handleBack}
              onOpenDetails={handleOpenDetails}
              isMobile
            />
          </div>
        )}
        
        {mobileView === 'details' && selectedConversationId && (
          <ChatDetails
            conversationId={selectedConversationId}
            onBack={handleBack}
            isMobile
          />
        )}
        
        <EmpresaSelectorDialog
          open={showEmpresaDialog}
          onOpenChange={setShowEmpresaDialog}
          targetPath="/whatsapp"
          moduloKey="whatsapp"
        />
      </div>
    );
  }
  
  // Desktop version - 3 column layout
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left column - Conversation list */}
        <div className="w-80 border-r border-border flex-shrink-0 overflow-hidden">
          <ConversationList
            conversations={conversations || []}
            selectedId={selectedConversationId}
            onSelect={handleSelectConversation}
            filters={filters}
            onFiltersChange={setFilters}
            isLoading={isLoading}
          />
        </div>
        
        {/* Center column - Chat area */}
        <div className="flex-1 overflow-hidden">
          {selectedConversationId ? (
            <ChatArea
              conversationId={selectedConversationId}
              onOpenDetails={handleOpenDetails}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">💬</span>
                </div>
                <PelegriniBranchBadge theme={theme} active className="mb-3" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Selecione uma conversa
                </h3>
                <p className="text-sm">
                  Escolha uma conversa na lista para começar
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Right column - Details panel */}
        {selectedConversationId && isDetailsOpen && (
          <div className="w-80 border-l border-border flex-shrink-0 overflow-hidden h-full">
            <ChatDetails
              conversationId={selectedConversationId}
              onClose={() => setIsDetailsOpen(false)}
            />
          </div>
        )}
      </div>
      
      <EmpresaSelectorDialog
        open={showEmpresaDialog}
        onOpenChange={setShowEmpresaDialog}
        targetPath="/whatsapp"
        moduloKey="whatsapp"
      />
    </div>
  );
}
