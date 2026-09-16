import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingIndicator } from '@/components/common/LoadingState';

interface SmartRepliesProps {
  replies: string[];
  onSelect: (reply: string) => void;
  isVisible: boolean;
  isLoading?: boolean;
}

export function SmartReplies({ replies, onSelect, isVisible, isLoading }: SmartRepliesProps) {
  if (!isVisible) return null;

  return (
    <div
      aria-busy={isLoading || undefined}
      className="flex min-h-11 items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30 overflow-x-auto"
    >
      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
        {isLoading ? (
          <LoadingIndicator size="sm" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        <span className="text-xs font-medium">Sugestões IA</span>
      </div>
      {!isLoading && <div className="flex items-center gap-2">
        {replies.length > 0 ? (
          replies.map((reply, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => onSelect(reply)}
              className={cn(
                "h-7 px-3 text-xs whitespace-nowrap shrink-0",
                "bg-background/80 hover:bg-primary/10 hover:border-primary/50",
                "transition-all duration-200"
              )}
            >
              {reply.length > 40 ? `${reply.substring(0, 40)}...` : reply}
            </Button>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Nenhuma sugestão disponível</span>
        )}
      </div>}
    </div>
  );
}
