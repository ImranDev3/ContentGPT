// Health probe — used by the UI to show resolved model + latency in the topbar.

'use client';

export interface HealthResult {
  ok: boolean;
  model: string;
  latencyMs: number;
  error?: string;
}

const TIMEOUT_MS = 8000;

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  if (signal) {
    signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const res = await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as Partial<HealthResult>;
    if (!res.ok) {
      return {
        ok: false,
        model: json.model ?? '',
        latencyMs: json.latencyMs ?? 0,
        error: json.error ?? `HTTP ${res.status}`,
      };
    }
    return {
      ok: json.ok ?? true,
      model: json.model ?? '',
      latencyMs: json.latencyMs ?? 0,
      error: json.error,
    };
  } catch (err) {
    return {
      ok: false,
      model: '',
      latencyMs: 0,
      error: err instanceof Error ? err.message : 'Network error',
    };
  } finally {
    clearTimeout(timer);
  }
}
