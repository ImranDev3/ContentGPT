// localStorage persistence for the zustand store.
// Hydration runs once on the client; the store is then auto-saved on every change.

'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from './store';
import type { ChatState } from './store';

const STORAGE_KEY = 'contentgpt:v1';

interface PersistedShape {
  conversations: ChatState['conversations'];
  activeId: string;
  settings: ChatState['settings'];
}

function loadFromStorage(): PersistedShape | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedShape;
    if (!parsed.conversations || typeof parsed.activeId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(state: PersistedShape) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / disabled storage — fail silently
  }
}

export function useHydrateStore() {
  const hydratedRef = useRef(false);
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const settings = useChatStore((s) => s.settings);

  // Hydrate once
  useEffect(() => {
    if (hydratedRef.current) return;
    const persisted = loadFromStorage();
    if (persisted) {
      useChatStore.setState({
        conversations: persisted.conversations,
        activeId: persisted.activeId,
        settings: { ...persisted.settings },
      });
    }
    hydratedRef.current = true;
  }, []);

  // Persist on change (after hydration)
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveToStorage({ conversations, activeId, settings });
  }, [conversations, activeId, settings]);
}
