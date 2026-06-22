'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Menu, Sparkles } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { Composer } from '@/components/composer';
import { MessageBubble } from '@/components/message-bubble';
import { SettingsPopover } from '@/components/settings-popover';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store';
import { useHydrateStore } from '@/lib/persist';
import { useTheme } from '@/components/theme-provider';
import { uid } from '@/lib/utils';
import type { ChatMessage, Conversation, Suggestion } from '@/types/chat';
import type { CompressedImage } from '@/lib/image';
import type { QuickAction } from '@/components/quick-actions';

const SUGGESTIONS: Suggestion[] = [
  { id: 's1', title: 'Blog intro', prompt: 'Write a 120-word blog intro about the future of remote work.' },
  { id: 's2', title: 'Tweet thread', prompt: 'Draft a 5-tweet thread explaining how vector databases work.' },
  { id: 's3', title: 'Email', prompt: 'Compose a friendly follow-up email after a sales call.' },
  { id: 's4', title: 'Code review', prompt: 'Review this TypeScript function for bugs and suggest improvements.' },
];

export default function Page() {
  useHydrateStore();
  const { theme } = useTheme();
  const useDarkCodeTheme = theme === 'dark';

  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const copyrightFree = useChatStore((s) => s.settings.copyrightFree);
  const webSearch = useChatStore((s) => s.settings.webSearch);
  const newConversation = useChatStore((s) => s.newConversation);
  const appendMessage = useChatStore((s) => s.appendMessage);

  const active = useMemo<Conversation | undefined>(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId],
  );

  const extraHeaders: Record<string, string> = {};
  if (copyrightFree) extraHeaders['X-Copyright-Free'] = 'true';
  if (webSearch) extraHeaders['X-Web-Search'] = 'true';

  const { messages, append, stop, isLoading, error, reload, setMessages } = useChat({
    api: '/api/chat',
    headers: Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
    onFinish: (msg) => {
      if (!msg || !active) return;
      const text = typeof msg.content === 'string' ? msg.content : extractText(msg.content);
      if (!text) return;
      appendMessage(active.id, {
        id: uid('msg'),
        role: 'assistant',
        content: text,
        createdAt: Date.now(),
      });
    },
  });

  // Sync the store's conversation history into useChat when switching chats.
  const lastSyncedConvRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) return;
    if (lastSyncedConvRef.current === active.id) return;
    setMessages(
      active.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt),
        experimental_attachments: m.attachments?.map((a) => ({
          name: a.name,
          contentType: a.mimeType,
          url: a.dataUrl,
        })),
      })) as Parameters<typeof setMessages>[0],
    );
    lastSyncedConvRef.current = active.id;
  }, [active, setMessages]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickActionBusy, setQuickActionBusy] = useState<QuickAction | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on any change to messages or streaming state.
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    // Use 'auto' (not 'smooth') during streaming for tightest follow; the
    // user can still scroll up freely.
    el.scrollTo({ top: el.scrollHeight, behavior: isLoading ? 'auto' : 'smooth' });
  }, [messages.length, isLoading, messages[messages.length - 1]?.content]);

  async function handleSend(text: string, attachments: CompressedImage[]) {
    if (!active) return;
    appendMessage(active.id, {
      id: uid('msg'),
      role: 'user',
      content: text,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    });
    const expAttachments = attachments.map((a) => ({
      name: a.name,
      contentType: a.mimeType,
      url: a.dataUrl,
    }));
    void append(
      { role: 'user', content: text },
      { experimental_attachments: expAttachments },
    );
  }

  async function handleQuickAction(action: QuickAction) {
    if (!active || isLoading) return;
    // Find the last assistant message to feed it into the quick action.
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const lastText = lastAssistant
      ? typeof lastAssistant.content === 'string'
        ? lastAssistant.content
        : extractText(lastAssistant.content)
      : '';
    if (!lastText) return;

    const PROMPTS: Record<QuickAction, string> = {
      paraphrase:
        'Paraphrase the previous response in fresh wording, keeping the same meaning. Output only the rewritten text — no preamble, no acknowledgment.',
      shorten:
        'Shorten the previous response to roughly half its length while preserving the key points. Output only the shortened text — no preamble.',
      expand:
        'Expand the previous response with more detail, examples, and explanation. Output only the expanded text — no preamble.',
      safe:
        'Rewrite the previous response in copyright-safe mode: original wording only, no verbatim copyrighted excerpts, and cite any public-domain sources with [Source: <url>]. Output only the rewritten text — no preamble.',
    };

    const instruction = PROMPTS[action];
    const combined = `${instruction}\n\n---\n\nPrevious response to rewrite:\n${lastText}`;

    setQuickActionBusy(action);
    try {
      appendMessage(active.id, {
        id: uid('msg'),
        role: 'user',
        content: `[Quick action: ${action}] ${instruction}`,
        createdAt: Date.now(),
      });
      await append({ role: 'user', content: combined });
    } finally {
      setQuickActionBusy(null);
    }
  }

  function handleSuggestion(p: string) {
    void handleSend(p, []);
  }

  const isEmpty = (active?.messages.length ?? 0) === 0 && messages.length === 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0">
            <Sidebar onCloseMobile={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col min-w-0">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden -ml-2"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="flex-1 flex items-center justify-center min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="hidden md:flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                <Sparkles className="h-3 w-3" />
              </div>
              <span className="truncate text-sm font-medium text-foreground/90">
                {active?.title?.trim() && active.title !== 'New chat' ? active.title : 'New chat'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <SettingsPopover />
          </div>
        </header>

        <div ref={messagesScrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl pb-4">
            {isEmpty ? (
              <EmptyState onSuggestion={handleSuggestion} />
            ) : (
              <MessageList
                messages={messages}
                useDarkTheme={useDarkCodeTheme}
                onRetry={() => reload()}
                isLoading={isLoading}
                error={error}
                quickActionBusy={quickActionBusy}
                onQuickAction={handleQuickAction}
              />
            )}
          </div>
        </div>

        <Composer
          onSend={handleSend}
          onStop={() => stop()}
          isStreaming={isLoading}
          placeholder="Message ContentGPT…"
        />
      </main>
    </div>
  );
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object' && 'text' in p) return String((p as { text: unknown }).text);
        return '';
      })
      .join('');
  }
  return '';
}

function MessageList({
  messages,
  useDarkTheme,
  isLoading,
  error,
  onRetry,
  quickActionBusy,
  onQuickAction,
}: {
  messages: ReturnType<typeof useChat>['messages'];
  useDarkTheme: boolean;
  isLoading: boolean;
  error: Error | undefined;
  onRetry: () => void;
  quickActionBusy: QuickAction | null;
  onQuickAction: (action: QuickAction) => void;
}) {
  // Hide the trailing empty assistant bubble that useChat emits while streaming.
  const visible = messages.filter(
    (m) =>
      m.role !== 'assistant' ||
      (typeof m.content === 'string' ? m.content.length > 0 : extractText(m.content).length > 0),
  );
  const lastIdx = visible.length - 1;

  return (
    <div className="flex flex-col">
      {visible.map((m, idx) => {
        const isLast = idx === lastIdx;
        const text = typeof m.content === 'string' ? m.content : extractText(m.content);
        return (
          <div key={m.id} className="animate-msg-in">
            <MessageBubble
              message={{
                id: m.id,
                role: m.role as ChatMessage['role'],
                content: text,
                createdAt: (m as { createdAt?: Date | number }).createdAt instanceof Date
                  ? (m as { createdAt: Date }).createdAt.getTime()
                  : Date.now(),
              }}
              isStreaming={isLoading && isLast && m.role === 'assistant'}
              useDarkTheme={useDarkTheme}
              isLast={isLast}
              quickActionBusy={quickActionBusy}
              onQuickAction={onQuickAction}
            />
          </div>
        );
      })}
      {error && (
        <div className="mx-4 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <div className="font-medium">Something went wrong</div>
          <div className="mt-1 text-xs opacity-80">{error.message}</div>
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs hover:bg-destructive/10"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (p: string) => void }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center px-6 pt-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md">
        <Sparkles className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">How can I help you write today?</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Pick a starting point, or type your own prompt below. Toggle the shield to ground answers
        in public-domain sources, or the globe for live web search.
      </p>

      <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSuggestion(s.prompt)}
            className="group/sg flex flex-col items-start gap-1 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <span className="text-sm font-medium">{s.title}</span>
            <span className="text-xs text-muted-foreground line-clamp-2">{s.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
