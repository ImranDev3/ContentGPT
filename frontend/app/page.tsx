'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Menu, Sparkles, X } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { Composer } from '@/components/composer';
import { MessageBubble } from '@/components/message-bubble';
import { CopyrightToggle } from '@/components/copyright-toggle';
import { ModelBadge } from '@/components/model-badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store';
import { useHydrateStore } from '@/lib/persist';
import { useTheme } from '@/components/theme-provider';
import { uid } from '@/lib/utils';
import type { ChatMessage, Conversation, Suggestion } from '@/types/chat';
import type { CompressedImage } from '@/lib/image';

const SUGGESTIONS: Suggestion[] = [
  { id: 's1', title: 'Blog intro', prompt: 'Write a 120-word blog intro about the future of remote work.' },
  { id: 's2', title: 'Tweet thread', prompt: 'Draft a 5-tweet thread explaining how vector databases work.' },
  { id: 's3', title: 'Email', prompt: 'Compose a friendly follow-up email after a sales call.' },
  { id: 's4', title: 'Code review', prompt: 'Review this function for bugs and suggest improvements: (paste code here).' },
];

export default function Page() {
  useHydrateStore();
  const { theme } = useTheme();
  const useDarkCodeTheme = theme === 'dark';

  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const copyrightFree = useChatStore((s) => s.settings.copyrightFree);
  const newConversation = useChatStore((s) => s.newConversation);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const updateLastMessage = useChatStore((s) => s.updateLastMessage);

  const active = useMemo<Conversation | undefined>(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId],
  );

  // Vercel AI SDK's useChat hook. We pass the copyright flag as a header
  // so the backend can branch its system prompt + Wikipedia context.
  const { messages, input, setInput, handleSubmit, append, stop, isLoading, error, reload, setMessages } =
    useChat({
      api: '/api/chat',
      headers: copyrightFree ? { 'X-Copyright-Free': 'true' } : undefined,
      // We sync AI SDK messages into our store; useChat still owns the live stream.
      onFinish: (msg) => {
        if (!msg) return;
        const id = uid('msg');
        appendMessage(activeId, {
          id,
          role: 'assistant',
          content: typeof msg.content === 'string' ? msg.content : extractText(msg.content),
          createdAt: Date.now(),
        });
      },
    });

  // Keep the AI SDK's view of messages in sync with our store on first load
  // and when switching conversations. This makes the UI the single source of
  // truth (the store) for the history, and useChat owns the in-flight stream.
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
        // Vercel AI SDK v1 expects experimental_attachments separately.
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
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content.
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isLoading]);

  async function handleSend(text: string, attachments: CompressedImage[]) {
    if (!active) return;

    const userMsg: ChatMessage = {
      id: uid('msg'),
      role: 'user',
      content: text,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    };
    appendMessage(active.id, userMsg);

    // Build the experimental_attachments for useChat's append().
    const expAttachments = attachments.map((a) => ({
      name: a.name,
      contentType: a.mimeType,
      url: a.dataUrl,
    }));

    // Use the SDK's append so it streams properly. The store already has
    // the user message; the assistant reply will be appended via onFinish.
    void append(
      { role: 'user', content: text },
      { experimental_attachments: expAttachments },
    );
    void setInput('');
  }

  function handleSuggestion(p: string) {
    void handleSend(p, []);
  }

  const isEmpty = (active?.messages.length ?? 0) === 0 && messages.length === 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar (desktop) */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Sidebar (mobile drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0">
            <Sidebar onCloseMobile={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/60 px-3 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">ContentGPT</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ModelBadge />
            <CopyrightToggle />
            <ThemeToggle />
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
}: {
  messages: ReturnType<typeof useChat>['messages'];
  useDarkTheme: boolean;
  isLoading: boolean;
  error: Error | undefined;
  onRetry: () => void;
}) {
  // Hide the trailing empty assistant bubble that useChat emits while streaming.
  const visible = messages.filter((m) => m.role !== 'assistant' || (typeof m.content === 'string' ? m.content.length > 0 : extractText(m.content).length > 0));
  return (
    <div className="flex flex-col">
      {visible.map((m, idx) => {
        const isLast = idx === visible.length - 1;
        const text = typeof m.content === 'string' ? m.content : extractText(m.content);
        return (
          <MessageBubble
            key={m.id}
            message={{
              id: m.id,
              role: m.role as ChatMessage['role'],
              content: text,
              createdAt: (m as { createdAt?: Date | number }).createdAt instanceof Date
                ? ((m as { createdAt: Date }).createdAt.getTime())
                : Date.now(),
            }}
            isStreaming={isLoading && isLast && m.role === 'assistant'}
            useDarkTheme={useDarkTheme}
          />
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
        in public-domain sources.
      </p>

      <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSuggestion(s.prompt)}
            className="group/sg flex flex-col items-start gap-1 rounded-xl border border-border bg-background/70 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <span className="text-sm font-medium">{s.title}</span>
            <span className="text-xs text-muted-foreground line-clamp-2">{s.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

void X;
