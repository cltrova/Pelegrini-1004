import { useEffect, useState, useRef } from 'react';
import { Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WhatsappMacro } from '@/types/whatsapp';

interface MacroSelectorProps {
  macros: WhatsappMacro[];
  searchText: string;
  isVisible: boolean;
  onSelect: (macro: WhatsappMacro) => void;
  onClose: () => void;
}

export function MacroSelector({ 
  macros, 
  searchText, 
  isVisible, 
  onSelect, 
  onClose 
}: MacroSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Filter macros based on search text (after the /)
  const filteredMacros = macros.filter(macro => 
    macro.shortcut.toLowerCase().includes(searchText.toLowerCase()) ||
    macro.name.toLowerCase().includes(searchText.toLowerCase())
  );
  
  // Reset selection when filtered macros change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchText]);
  
  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current) {
      const selectedElement = containerRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);
  
  // Handle keyboard navigation
  useEffect(() => {
    if (!isVisible) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredMacros.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredMacros.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredMacros[selectedIndex]) {
            onSelect(filteredMacros[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, filteredMacros, selectedIndex, onSelect, onClose]);
  
  if (!isVisible || filteredMacros.length === 0) return null;
  
  return (
    <div 
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto"
    >
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Command className="h-3 w-3" />
          Macros disponíveis
        </p>
      </div>
      <div className="py-1">
        {filteredMacros.map((macro, index) => (
          <button
            key={macro.id}
            data-index={index}
            onClick={() => onSelect(macro)}
            className={cn(
              "w-full px-3 py-2 text-left flex items-start gap-3 transition-colors",
              index === selectedIndex
                ? "bg-primary/10 text-foreground"
                : "hover:bg-muted"
            )}
          >
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-primary font-mono shrink-0">
              /{macro.shortcut}
            </code>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{macro.name}</p>
              <p className="text-xs text-muted-foreground truncate">{macro.content}</p>
            </div>
            {macro.usage_count && macro.usage_count > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">
                {macro.usage_count}x
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
