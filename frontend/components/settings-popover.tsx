'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Moon, Sun, Shield, ShieldCheck, Globe, GlobeLock, Cpu, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useChatStore } from '@/lib/store';
import { useTheme } from '@/components/theme-provider';
import { fetchHealth, type HealthResult } from '@/lib/health';
import { cn } from '@/lib/utils';

/**
 * Single popover in the top-right of the header. Replaces the row of inline
 * toggles with a clean ⋯ button — header stays minimal.
 */
export function SettingsPopover() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside + Escape to close
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground',
          'hover:bg-accent hover:text-foreground transition-colors',
          open && 'bg-accent text-foreground',
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-10 z-50 w-72 origin-top-right',
            'rounded-xl border border-border bg-popover/95 backdrop-blur-xl',
            'p-2 shadow-2xl',
            'animate-msg-in',
          )}
        >
          <ModelRow />
          <Divider />
          <ToggleRow
            label="Copyright-free"
            description="Ground answers in public-domain sources"
            on={useChatStore.getState().settings.copyrightFree}
            onChange={useChatStore.getState().setCopyrightFree}
            OnIcon={ShieldCheck}
            OffIcon={Shield}
          />
          <ToggleRow
            label="Web search"
            description="Add live web snippets to context"
            on={useChatStore.getState().settings.webSearch}
            onChange={useChatStore.getState().setWebSearch}
            OnIcon={Globe}
            OffIcon={GlobeLock}
          />
          <Divider />
          <ThemeRow />
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-border/60" />;
}

function ToggleRow({
  label,
  description,
  on,
  onChange,
  OnIcon,
  OffIcon,
}: {
  label: string;
  description: string;
  on: boolean;
  onChange: (v: boolean) => void;
  OnIcon: React.ComponentType<{ className?: string }>;
  OffIcon: React.ComponentType<{ className?: string }>;
}) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <button
      onClick={() => onChange(!on)}
      role="menuitemcheckbox"
      aria-checked={on}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left',
        'hover:bg-accent transition-colors',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-none">{label}</div>
        <div className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{description}</div>
      </div>
      <Switch checked={on} onCheckedChange={onChange} aria-label={label} />
    </button>
  );
}

function ThemeRow() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button
      onClick={() => setTheme(next)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left',
        'hover:bg-accent transition-colors',
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium leading-none">Theme</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          Currently {theme} — click to switch to {next}
        </div>
      </div>
    </button>
  );
}

function ModelRow() {
  const [state, setState] = useState<HealthResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchHealth().then((r) => !cancelled && setState(r));
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = state?.ok;
  const Icon = ready ? Cpu : Loader2;

  return (
    <div className="flex items-center gap-3 px-2.5 py-2">
      <Icon className={cn('h-4 w-4 shrink-0', !ready && 'animate-spin', ready ? 'text-primary' : 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-none">
          {ready ? (state?.model || 'manifest') : state && !ready ? 'Offline' : 'Probing…'}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {ready ? `Manifest.build · ${state?.latencyMs ?? 0}ms` : state?.error ?? 'Connecting'}
        </div>
      </div>
    </div>
  );
}
