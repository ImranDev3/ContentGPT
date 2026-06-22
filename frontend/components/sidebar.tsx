'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, MessageSquare, Sparkles } from 'lucide-react';
import { useChatStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const newConversation = useChatStore((s) => s.newConversation);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <aside
      className={cn(
        'flex h-full w-72 shrink-0 flex-col border-r border-border',
        'bg-white/70 dark:bg-zinc-950/60 backdrop-blur-xl',
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">ContentGPT</span>
          <span className="text-[11px] text-muted-foreground">AI content studio</span>
        </div>
      </div>

      <div className="px-3 pb-2">
        <Button
          variant="default"
          className="w-full justify-start"
          onClick={() => {
            newConversation();
            onCloseMobile?.();
          }}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <ul className="flex flex-col gap-0.5 py-1">
          {mounted &&
            conversations.map((c) => {
              const isActive = c.id === activeId;
              return (
                <li key={c.id} className="group relative">
                  <button
                    onClick={() => {
                      selectConversation(c.id);
                      onCloseMobile?.();
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm',
                      'transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/60 text-foreground/80',
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{c.title || 'New chat'}</span>
                  </button>
                  <button
                    aria-label="Delete conversation"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(c.id);
                    }}
                    className={cn(
                      'absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1',
                      'opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive',
                      'transition-opacity',
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
        </ul>
      </ScrollArea>

      <div className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
        Manifest.build · OpenAI-compatible
      </div>
    </aside>
  );
}
