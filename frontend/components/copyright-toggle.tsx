'use client';

import { Shield, ShieldCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useChatStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function CopyrightToggle() {
  const on = useChatStore((s) => s.settings.copyrightFree);
  const setCopyrightFree = useChatStore((s) => s.setCopyrightFree);

  const Icon = on ? ShieldCheck : Shield;

  return (
    <label
      className={cn(
        'flex items-center gap-2 rounded-full border border-border bg-background/70 px-2.5 py-1',
        'text-xs text-muted-foreground hover:bg-accent/60 cursor-pointer transition-colors',
        on && 'border-primary/40 text-foreground',
      )}
      title="Ground answers in public-domain Wikipedia context and steer the model to original wording."
    >
      <Icon className={cn('h-3.5 w-3.5', on && 'text-primary')} />
      <span className="select-none">Copyright-free</span>
      <Switch checked={on} onCheckedChange={setCopyrightFree} aria-label="Toggle copyright-free mode" />
    </label>
  );
}
