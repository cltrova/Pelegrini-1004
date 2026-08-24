import { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  MoreVertical, 
  Info,
  Check,
  CheckCheck,
  Clock,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useWhatsappConversation, useWhatsappMessages, useSendMessage, useWhatsappRealtime } from '@/hooks/useWhatsappData';
import type { WhatsappMessage } from '@/types/whatsapp';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatInput } from './input/ChatInput';

interface ChatAreaProps {
  conversationId: string;
  onBack?: () => void;
  onOpenDetails?: () => void;
  isMobile?: boolean;
}

export function ChatArea({ conversationId, onBack, onOpenDetails, isMobile }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: conversation, isLoading: isLoadingConversation } = useWhatsappConversation(conversationId);
  const { data: messages, isLoading: isLoadingMessages } = useWhatsappMessages(conversationId);
  const { subscribeToMessages } = useWhatsappRealtime(conversationId);
  const sendMessage = useSendMessage();
  
  // Subscribe to realtime messages
  useEffect(() => {
    const unsubscribe = subscribeToMessages();
    return unsubscribe;
  }, [conversationId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSend = async (content: string) => {
    await sendMessage.mutateAsync({
      conversationId,
      content,
    });
  };
  
  const contact = conversation?.contact;
  const name = contact?.name || contact?.push_name || contact?.phone_number || 'Desconhecido';
  const initials = name.slice(0, 2).toUpperCase();
  
  // Group messages by date
  const groupedMessages = messages?.reduce((groups, msg) => {
    const date = format(new Date(msg.timestamp), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, WhatsappMessage[]>) || {};
  
  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    return format(date, "d 'de' MMMM", { locale: ptBR });
  };
  
  return (
    <div className="flex flex-col h-full max-h-full bg-background overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 border-b border-border bg-card">
        {isMobile && onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        )}
        
        {isLoadingConversation ? (
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex-shrink-0" />
            <div className="space-y-1 sm:space-y-1.5 min-w-0">
              <Skeleton className="h-3.5 sm:h-4 w-24 sm:w-32" />
              <Skeleton className="h-2.5 sm:h-3 w-20 sm:w-24" />
            </div>
          </div>
        ) : (
          <>
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
              <AvatarImage src={contact?.profile_picture_url} />
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            {/* Sentiment indicator */}
            {conversation?.sentiment && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 flex-shrink-0",
                  conversation.sentiment === 'positive' && 'border-green-500/50 text-green-500',
                  conversation.sentiment === 'neutral' && 'border-yellow-500/50 text-yellow-500',
                  conversation.sentiment === 'negative' && 'border-red-500/50 text-red-500'
                )}
              >
                {conversation.sentiment === 'positive' && '😊 Positivo'}
                {conversation.sentiment === 'neutral' && '😐 Neutro'}
                {conversation.sentiment === 'negative' && '😞 Negativo'}
              </Badge>
            )}
            
            {/* Actions */}
            <div className="flex items-center gap-0.5 sm:gap-1 ml-auto flex-shrink-0">
              {conversation?.status === 'queue' && (
                <Button size="sm" className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-green-500 hover:bg-green-600">
                  <User className="h-3 w-3 mr-0.5 sm:mr-1" />
                  Assumir
                </Button>
              )}
              
              {onOpenDetails && (
                <Button variant="ghost" size="icon" onClick={onOpenDetails} className="h-7 w-7 sm:h-8 sm:w-8">
                  <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                    <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Editar contato</DropdownMenuItem>
                  <DropdownMenuItem>Transferir conversa</DropdownMenuItem>
                  <DropdownMenuItem>Exportar histórico</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    Encerrar conversa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
      
      {/* Messages area - Scrollable Only */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="p-3 sm:p-4">
          {isLoadingMessages ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                  <Skeleton className="h-12 w-48 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {Object.entries(groupedMessages).map(([date, dayMessages]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-3 sm:my-4">
                    <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-muted text-[10px] sm:text-xs text-muted-foreground">
                      {formatDateHeader(date)}
                    </span>
                  </div>
                  
                  {/* Messages for this day */}
                  <div className="space-y-1.5 sm:space-y-2">
                    {dayMessages.map((msg) => (
                      <MessageBubble key={msg.id} message={msg} />
                    ))}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
      
      {/* Input area - Fixed */}
      <div className="flex-shrink-0">
        <ChatInput
          conversationId={conversationId}
          onSend={handleSend}
          isSending={sendMessage.isPending}
        />
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: WhatsappMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isFromMe = message.from_me;
  
  const StatusIcon = () => {
    switch (message.status) {
      case 'pending':
        return <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />;
      case 'sent':
        return <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />;
      case 'delivered':
        return <CheckCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" />;
      case 'read':
        return <CheckCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-500" />;
      default:
        return null;
    }
  };
  
  return (
    <div className={cn("flex", isFromMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[70%] px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl",
          isFromMe
            ? "bg-green-500 text-white rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        )}
      >
        {/* Quoted message */}
        {message.quoted_content && (
          <div className={cn(
            "mb-1.5 sm:mb-2 pl-1.5 sm:pl-2 border-l-2 text-[10px] sm:text-xs opacity-80",
            isFromMe ? "border-white/50" : "border-primary"
          )}>
            {message.quoted_content}
          </div>
        )}
        
        {/* Message content */}
        <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">
          {message.content || message.media_caption || '[Mídia]'}
        </p>
        
        {/* Transcription for audio */}
        {message.message_type === 'audio' && message.transcription && (
          <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs italic opacity-80">
            "{message.transcription}"
          </p>
        )}
        
        {/* Time and status */}
        <div className={cn(
          "flex items-center justify-end gap-0.5 sm:gap-1 mt-0.5 sm:mt-1",
          isFromMe ? "text-white/70" : "text-muted-foreground"
        )}>
          {message.is_edited && (
            <span className="text-[9px] sm:text-[10px]">editada</span>
          )}
          <span className="text-[9px] sm:text-[10px]">
            {format(new Date(message.timestamp), 'HH:mm')}
          </span>
          {isFromMe && <StatusIcon />}
        </div>
      </div>
    </div>
  );
}
