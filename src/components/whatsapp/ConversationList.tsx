import { useState } from 'react';
import { Search, Filter, Plus, MessageSquare, Clock, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { WhatsappConversation, ConversationFilters } from '@/types/whatsapp';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationListProps {
  conversations: WhatsappConversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  filters: ConversationFilters;
  onFiltersChange: (filters: ConversationFilters) => void;
  isLoading?: boolean;
}

const statusFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'unread', label: 'Não lidas' },
  { value: 'queue', label: 'Na fila' },
  { value: 'mine', label: 'Minhas' },
] as const;

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
  isLoading,
}: ConversationListProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  
  const handleFilterChange = (value: string) => {
    setActiveFilter(value);
    
    const newFilters: ConversationFilters = { ...filters };
    
    switch (value) {
      case 'unread':
        newFilters.unreadOnly = true;
        newFilters.inQueue = false;
        newFilters.assignedToMe = false;
        break;
      case 'queue':
        newFilters.unreadOnly = false;
        newFilters.inQueue = true;
        newFilters.assignedToMe = false;
        break;
      case 'mine':
        newFilters.unreadOnly = false;
        newFilters.inQueue = false;
        newFilters.assignedToMe = true;
        break;
      default:
        newFilters.unreadOnly = false;
        newFilters.inQueue = false;
        newFilters.assignedToMe = false;
    }
    
    onFiltersChange(newFilters);
  };
  
  const handleSearch = (value: string) => {
    onFiltersChange({ ...filters, search: value || undefined });
  };
  
  const unreadCount = conversations.filter(c => c.unread_count > 0).length;
  
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header - WhatsApp Style */}
      <div className="p-3 sm:p-4 border-b border-border space-y-2 sm:space-y-3 bg-card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base sm:text-lg">Conversas</h2>
          <div className="flex items-center gap-1 sm:gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Filter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Ordenar por</p>
                  {['recent', 'unread', 'oldest'].map((sort) => (
                    <Button
                      key={sort}
                      variant={filters.sortBy === sort ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => onFiltersChange({ ...filters, sortBy: sort as ConversationFilters['sortBy'] })}
                    >
                      {sort === 'recent' && 'Mais recentes'}
                      {sort === 'unread' && 'Não lidas primeiro'}
                      {sort === 'oldest' && 'Mais antigas'}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Search - WhatsApp Style */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={filters.search || ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
        
        {/* Quick filters - Horizontal scroll on mobile */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={activeFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              className={cn(
                "h-7 text-xs whitespace-nowrap flex-shrink-0",
                activeFilter === filter.value && "bg-primary text-primary-foreground"
              )}
              onClick={() => handleFilterChange(filter.value)}
            >
              {filter.label}
              {filter.value === 'unread' && unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Conversation list - WhatsApp Style */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/50">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 sm:p-4 flex gap-3">
                <Skeleton className="h-11 w-11 sm:h-12 sm:w-12 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedId === conversation.id}
                onClick={() => onSelect(conversation.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: WhatsappConversation;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const contact = conversation.contact;
  const name = contact?.name || contact?.push_name || contact?.phone_number || 'Desconhecido';
  const initials = name.slice(0, 2).toUpperCase();
  
  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), { 
        addSuffix: false, 
        locale: ptBR 
      })
    : '';
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-3 sm:p-4 flex gap-3 text-left transition-colors active:bg-muted/70',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/10'
      )}
    >
      {/* Avatar - WhatsApp Style */}
      <Avatar className="h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0">
        <AvatarImage src={contact?.profile_picture_url} />
        <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white text-sm sm:text-base">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        {/* Top row: Name + Time */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">{name}</span>
          <span className={cn(
            "text-[11px] sm:text-xs whitespace-nowrap flex-shrink-0",
            conversation.unread_count > 0 ? "text-green-500 font-medium" : "text-muted-foreground"
          )}>
            {timeAgo}
          </span>
        </div>
        
        {/* Middle row: Message preview + Unread badge */}
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {conversation.is_from_me && (
              <span className="text-muted-foreground flex-shrink-0">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.354 4.354a.5.5 0 00-.708-.708L5.5 8.793 3.854 7.146a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l5.5-5.5z"/>
                </svg>
              </span>
            )}
            <p className="text-[13px] sm:text-sm text-muted-foreground truncate">
              {conversation.last_message_preview || 'Sem mensagens'}
            </p>
          </div>
          
          {conversation.unread_count > 0 && (
            <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-green-500 hover:bg-green-500 rounded-full flex-shrink-0">
              {conversation.unread_count}
            </Badge>
          )}
        </div>
        
        {/* Bottom row: Status badges - Compact */}
        {(conversation.status === 'queue' || conversation.assigned_to || conversation.sentiment) && (
          <div className="flex items-center gap-1 mt-1.5 overflow-x-auto scrollbar-none">
            {conversation.status === 'queue' && (
              <Badge variant="outline" className="h-5 text-[10px] px-1.5 border-orange-500/50 text-orange-500 flex-shrink-0">
                <Clock className="h-3 w-3 mr-0.5" />
                Fila
              </Badge>
            )}
            {conversation.assigned_to && (
              <Badge variant="outline" className="h-5 text-[10px] px-1.5 flex-shrink-0">
                <User className="h-3 w-3 mr-0.5" />
                {conversation.assigned_user?.nome?.split(' ')[0] || 'Atrib.'}
              </Badge>
            )}
            {conversation.sentiment && (
              <Badge 
                variant="outline" 
                className={cn(
                  "h-5 text-[10px] px-1.5 flex-shrink-0",
                  conversation.sentiment === 'positive' && 'border-green-500/50 text-green-500',
                  conversation.sentiment === 'neutral' && 'border-yellow-500/50 text-yellow-500',
                  conversation.sentiment === 'negative' && 'border-red-500/50 text-red-500'
                )}
              >
                {conversation.sentiment === 'positive' && '😊'}
                {conversation.sentiment === 'neutral' && '😐'}
                {conversation.sentiment === 'negative' && '😞'}
              </Badge>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
