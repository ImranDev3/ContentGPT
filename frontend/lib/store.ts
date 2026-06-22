// Zustand store: conversations + activeId + UI settings.
// Persists to localStorage (see lib/persist.ts) so chat history survives reloads.

'use client';

import { create } from 'zustand';
import type { ChatMessage, Conversation, Settings } from '@/types/chat';
import { deriveTitle, uid } from './utils';

export interface ChatState {
  conversations: Conversation[];
  activeId: string;
  settings: Settings;

  // Conversation actions
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;

  // Message actions
  appendMessage: (convId: string, message: ChatMessage) => void;
  updateLastMessage: (convId: string, content: string) => void;
  getActive: () => Conversation | undefined;

  // Settings actions
  setCopyrightFree: (on: boolean) => void;
  setWebSearch: (on: boolean) => void;
  setTheme: (theme: Settings['theme']) => void;
  setResolvedModel: (model: string) => void;
  resolvedModel: string;
}

const defaultSettings: Settings = {
  copyrightFree: false,
  webSearch: false,
  theme: 'dark',
};

const createConversation = (): Conversation => {
  const now = Date.now();
  return {
    id: uid('conv'),
    title: 'New chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
};

const initial = createConversation();

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [initial],
  activeId: initial.id,
  settings: defaultSettings,
  resolvedModel: '',

  newConversation: () => {
    const conv = createConversation();
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeId: conv.id,
    }));
    return conv.id;
  },

  selectConversation: (id) => set({ activeId: id }),

  deleteConversation: (id) =>
    set((s) => {
      const remaining = s.conversations.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const fresh = createConversation();
        return { conversations: [fresh], activeId: fresh.id };
      }
      return {
        conversations: remaining,
        activeId: s.activeId === id ? remaining[0]!.id : s.activeId,
      };
    }),

  renameConversation: (id, title) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c,
      ),
    })),

  appendMessage: (convId, message) =>
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== convId) return c;
        const isFirstUserMessage =
          c.messages.length === 0 && message.role === 'user';
        return {
          ...c,
          title: isFirstUserMessage ? deriveTitle(message.content) : c.title,
          messages: [...c.messages, message],
          updatedAt: Date.now(),
        };
      }),
    })),

  updateLastMessage: (convId, content) =>
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== convId || c.messages.length === 0) return c;
        const messages = c.messages.slice(0, -1).concat([
          { ...c.messages[c.messages.length - 1]!, content },
        ]);
        return { ...c, messages, updatedAt: Date.now() };
      }),
    })),

  getActive: () => {
    const s = get();
    return s.conversations.find((c) => c.id === s.activeId);
  },

  setCopyrightFree: (on) =>
    set((s) => ({ settings: { ...s.settings, copyrightFree: on } })),

  setWebSearch: (on) =>
    set((s) => ({ settings: { ...s.settings, webSearch: on } })),

  setTheme: (theme) =>
    set((s) => ({ settings: { ...s.settings, theme } })),

  setResolvedModel: (model) => set({ resolvedModel: model }),
}));
