'use client';

import { Loader2, RefreshCw, Minimize2, Maximize2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export type QuickAction = 'paraphrase' | 'shorten' | 'expand' | 'safe';

interface QuickActionsProps {
  onAction: (action: QuickAction) => void;
  busy: QuickAction | null;
  disabled?: boolean;
}

const ACTIONS: { id: QuickAction; label: string; icon: React.ReactNode; prompt: string }[] = [
  { id: 'paraphrase', label: 'Paraphrase', icon: <RefreshCw className="h-3 w-3" />, prompt: 'Paraphrase the previous response in fresh wording, keeping the same meaning. Output only the rewritten text — no preamble.' },
  { id: 'shorten', label: 'Shorten', icon: <Minimize2 className="h-3 w-3" />, prompt: 'Shorten the previous response to roughly half its length while preserving the key points. Output only the shortened text — no preamble.' },
  { id: 'expand', label: 'Expand', icon: <Maximize2 className="h-3 w-3" />, prompt: 'Expand the previous response with more detail, examples, and explanation. Output only the expanded text — no preamble.' },
  { id: 'safe', label: 'Make safe', icon: <ShieldCheck className="h-3 w-3" />, prompt: 'Rewrite the previous response in copyright-safe mode: original wording only, no verbatim copyrighted excerpts, and cite any public-domain sources with [Source: <url>]. Output only the rewritten text — no preamble.' },
];

/**
 * Quick action bar shown below the action buttons on the last assistant
 * message. Each button sends a small instruction prompt referencing the
 * previous response, so the user can iterate on the answer with one click.
 */
export function QuickActions({ onAction, busy, disabled }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ACTIONS.map((a) => {
        const isBusy = busy === a.id;
        return (
          <button
            key={a.id}
            onClick={() => onAction(a.id)}
            disabled={disabled || busy !== null}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1',
              'text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
              'disabled:opacity-50 disabled:pointer-events-none',
              isBusy && 'border-primary/40 text-foreground',
            )}
            title={a.prompt}
          >
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : a.icon}
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
