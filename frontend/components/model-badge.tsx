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

  const ready = state?.ok;
  const modelLabel = ready ? state?.model || stored || 'manifest' : null;
  const latency = ready ? state?.latencyMs ?? 0 : 0;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px]',
        ready
          ? 'text-foreground'
          : state && !ready
            ? 'text-destructive'
            : 'text-muted-foreground',
      )}
      title={
        ready
          ? `Resolved model: ${modelLabel}\nProvider: Manifest.build\nLatency: ${latency}ms`
          : state?.error ?? 'Probing Manifest…'
      }
    >
      {ready ? <Cpu className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
      <span className="font-mono tracking-tight">
        {ready ? modelLabel : state && !ready ? 'offline' : 'connecting…'}
      </span>
      {ready && latency > 0 && (
        <>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">{latency}ms</span>
        </>
      )}
    </div>
  );
}
