'use client';

import { useEffect, useState } from 'react';
import { Cpu, Loader2 } from 'lucide-react';
import { fetchHealth, type HealthResult } from '@/lib/health';
import { useChatStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function ModelBadge() {
  const setResolvedModel = useChatStore((s) => s.setResolvedModel);
  const stored = useChatStore((s) => s.resolvedModel);
  const [state, setState] = useState<HealthResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const result = await fetchHealth();
      if (cancelled) return;
      setState(result);
      if (result.ok && result.model) setResolvedModel(result.model);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [setResolvedModel]);

  const label = state?.ok
    ? state.model || stored || 'model'
    : state?.error
      ? 'offline'
      : 'connecting…';

  const SubIcon = state?.ok ? Cpu : Loader2;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px]',
        state?.ok
          ? 'text-foreground'
          : state
            ? 'text-destructive'
            : 'text-muted-foreground',
      )}
      title={state?.ok ? `latency ${state.latencyMs}ms` : state?.error ?? 'Probing Manifest…'}
    >
      <SubIcon className={cn('h-3 w-3', !state && 'animate-spin')} />
      <span className="font-mono tracking-tight">{label}</span>
      {state?.ok && state.latencyMs > 0 && (
        <span className="text-muted-foreground">· {state.latencyMs}ms</span>
      )}
    </div>
  );
}
