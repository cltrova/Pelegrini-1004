import { Paperclip, Image, Video, FileText, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AttachmentMenuProps {
  onAttach: (type: 'image' | 'video' | 'document' | 'audio') => void;
}

export function AttachmentMenu({ onAttach }: AttachmentMenuProps) {
  const attachmentOptions = [
    { type: 'image' as const, icon: Image, label: 'Imagem', color: 'text-blue-500' },
    { type: 'video' as const, icon: Video, label: 'Vídeo', color: 'text-purple-500' },
    { type: 'document' as const, icon: FileText, label: 'Documento', color: 'text-amber-500' },
    { type: 'audio' as const, icon: Mic, label: 'Áudio', color: 'text-green-500' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8}>
        {attachmentOptions.map((option) => (
          <DropdownMenuItem 
            key={option.type}
            onClick={() => onAttach(option.type)}
            className="cursor-pointer"
          >
            <option.icon className={`h-4 w-4 mr-2 ${option.color}`} />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
