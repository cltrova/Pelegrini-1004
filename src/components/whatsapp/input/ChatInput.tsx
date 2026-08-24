import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SmartReplies } from './SmartReplies';
import { EmojiPicker } from './EmojiPicker';
import { AttachmentMenu } from './AttachmentMenu';
import { AIComposer } from './AIComposer';
import { MacroSelector } from './MacroSelector';
import { AudioRecorder } from './AudioRecorder';
import { useWhatsappMacros } from '@/hooks/useWhatsappData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface ChatInputProps {
  onSend: (content: string, type?: 'text' | 'audio') => Promise<void>;
  isSending?: boolean;
  conversationId: string;
}

// Hook for fetching dynamic smart replies
function useSmartReplies(conversationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['smart-replies', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('smart-replies', {
        body: { conversationId }
      });
      
      if (error) {
        console.error('Smart replies error:', error);
        return ['Entendi, vou verificar.', 'Agradeço o contato!', 'Um momento, por favor.'];
      }
      
      return data?.replies || ['Entendi!', 'Vou verificar.', 'Obrigado!'];
    },
    enabled: enabled && !!conversationId,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  });
}

export function ChatInput({ onSend, isSending, conversationId }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  const [macroSearch, setMacroSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { data: macros = [] } = useWhatsappMacros();
  
  // Dynamic smart replies from AI
  const { data: smartReplies = [], isLoading: isLoadingReplies } = useSmartReplies(
    conversationId, 
    !message.trim() // Only fetch when input is empty
  );
  
  // Handle message change and macro detection
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Check for macro trigger
    const lastWord = value.split(' ').pop() || '';
    if (lastWord.startsWith('/') && lastWord.length > 1) {
      setShowMacros(true);
      setMacroSearch(lastWord.slice(1));
    } else if (lastWord === '/') {
      setShowMacros(true);
      setMacroSearch('');
    } else {
      setShowMacros(false);
    }
  };
  
  // Handle sending message
  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    
    try {
      await onSend(message.trim());
      setMessage('');
      textareaRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };
  
  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMacros) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Handle smart reply selection
  const handleSmartReplySelect = (reply: string) => {
    setMessage(reply);
    textareaRef.current?.focus();
  };
  
  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    const cursorPos = textareaRef.current?.selectionStart || message.length;
    const newMessage = message.slice(0, cursorPos) + emoji + message.slice(cursorPos);
    setMessage(newMessage);
    
    // Set cursor position after emoji
    setTimeout(() => {
      textareaRef.current?.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
      textareaRef.current?.focus();
    }, 0);
  };
  
  // Handle attachment
  const handleAttach = (type: 'image' | 'video' | 'document' | 'audio') => {
    toast.info(`Anexar ${type} - Em desenvolvimento`);
  };
  
  // Handle AI text transform
  const handleTextTransform = (newText: string) => {
    setMessage(newText);
    textareaRef.current?.focus();
  };
  
  // Handle macro selection
  const handleMacroSelect = (macro: { shortcut: string; content: string }) => {
    // Replace the /command with the macro content
    const words = message.split(' ');
    words.pop(); // Remove the /command
    const newMessage = words.length > 0 
      ? words.join(' ') + ' ' + macro.content
      : macro.content;
    
    setMessage(newMessage);
    setShowMacros(false);
    textareaRef.current?.focus();
  };
  
  // Handle audio ready (recorded and optionally transcribed)
  const handleAudioReady = async (audioBlob: Blob, transcription?: string) => {
    setIsRecording(false);
    
    if (transcription) {
      toast.success('Áudio transcrito!');
      // Insert transcription into text field
      setMessage(transcription);
      textareaRef.current?.focus();
    } else {
      toast.info('Áudio gravado (sem transcrição)');
      // In production, upload blob and send as audio message
      // await onSend(audioUrl, 'audio');
    }
  };
  
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);
  
  // If recording, show only the recorder
  if (isRecording) {
    return (
      <AudioRecorder
        onAudioReady={handleAudioReady}
      />
    );
  }
  
  return (
    <div className="border-t border-border bg-card">
      {/* Smart Replies */}
      <SmartReplies
        replies={smartReplies}
        onSelect={handleSmartReplySelect}
        isVisible={!message.trim()}
        isLoading={isLoadingReplies}
      />
      
      {/* Input area */}
      <div className="p-2 sm:p-3">
        <div className="relative flex items-end gap-1.5 sm:gap-2">
          {/* Left action buttons */}
          <div className="flex items-center shrink-0">
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            <AttachmentMenu onAttach={handleAttach} />
            <AIComposer 
              text={message} 
              onTextTransform={handleTextTransform}
              disabled={!message.trim()}
            />
          </div>
          
          {/* Message input with macro selector */}
          <div className="flex-1 relative min-w-0">
            <MacroSelector
              macros={macros}
              searchText={macroSearch}
              isVisible={showMacros}
              onSelect={handleMacroSelect}
              onClose={() => setShowMacros(false)}
            />
            
            <Textarea
              ref={textareaRef}
              placeholder="Digite uma mensagem..."
              value={message}
              onChange={handleMessageChange}
              onKeyDown={handleKeyDown}
              className={cn(
                "min-h-[36px] sm:min-h-[40px] max-h-[100px] sm:max-h-[120px] resize-none py-2 sm:py-2.5 px-3 sm:px-4",
                "bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50",
                "rounded-xl text-sm"
              )}
              rows={1}
            />
          </div>
          
          {/* Send or Record button */}
          {message.trim() ? (
            <Button 
              size="icon" 
              className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 bg-green-500 hover:bg-green-600 rounded-full"
              onClick={handleSend}
              disabled={isSending}
            >
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          ) : (
            <AudioRecorder
              onAudioReady={handleAudioReady}
            />
          )}
        </div>
      </div>
    </div>
  );
}
