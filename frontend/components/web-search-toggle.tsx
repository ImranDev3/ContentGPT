'use client';

import { Globe, GlobeLock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useChatStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function WebSearchToggle() {
  const on = useChatStore((s) => s.settings.webSearch);
  const setWebSearch = useChatStore((s) => s.setWebSearch);

  const Icon = on ? Globe : GlobeLock;

  return (
    <label
      className={cn(
        'flex items-center gap-2 rounded-full border border-border bg-background/70 px-2.5 py-1',
        'text-xs text-muted-foreground hover:bg-accent/60 cursor-pointer transition-colors',
        on && 'border-primary/40 text-foreground',
      )}
      title="Search the live web (DuckDuckGo by default; Google CSE if configured) and cite sources in the response."
    >
      <Icon className={cn('h-3.5 w-3.5', on && 'text-primary')} />
      <span className="select-none">Web Search</span>
      <Switch checked={on} onCheckedChange={setWebSearch} aria-label="Toggle web search" />
    </label>
  );
}
