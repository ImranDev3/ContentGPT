// Small utility helpers used across the app.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = 'id'): string {
  // Lightweight, sortable-ish id. Not crypto-strong; UI-only.
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function deriveTitle(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean || 'New chat';
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}
