'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Check, Copy, FileText, User, Bot } from 'lucide-react';
import type { ChatMessage } from '@/types/chat';
import { cn } from '@/lib/utils';
import { QuickActions, type QuickAction } from '@/components/quick-actions';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  useDarkTheme: boolean;
  isLast?: boolean;
  quickActionBusy?: QuickAction | null;
  onQuickAction?: (action: QuickAction) => void;
}

export function MessageBubble({
  message,
  isStreaming,
  useDarkTheme,
  isLast,
  quickActionBusy,
  onQuickAction,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('group flex w-full gap-3 px-4 py-5', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-1.5',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.id}
                src={a.dataUrl}
                alt={a.name}
                className="h-24 w-24 rounded-md border border-border object-cover"
              />
            ))}
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm',
            isStreaming && 'stream-cursor',
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <div className="prose-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noreferrer noopener">
                      {children}
                    </a>
                  ),
                  code({ className, children, ...rest }) {
                    const match = /language-(\w+)/.exec(className ?? '');
                    const text = String(children).replace(/\n$/, '');
                    if (!match) {
                      return (
                        <code className={className} {...rest}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <CodeBlock
                        language={match[1]}
                        code={text}
                        useDarkTheme={useDarkTheme}
                      />
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && message.content && !isStreaming && (
          <div className="flex flex-col gap-1.5">
            <MessageActions content={message.content} />
            {isLast && onQuickAction && (
              <QuickActions
                onAction={onQuickAction}
                busy={quickActionBusy ?? null}
                disabled={quickActionBusy !== null}
              />
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

/**
 * Action bar shown below every assistant message: "Copy" (plain text) and
 * "Copy markdown". Both always visible — no hover required.
 */
function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState<'plain' | 'md' | null>(null);

  useEffect(() => {
    if (copied === null) return;
    const t = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy(as: 'plain' | 'md') {
    const text = as === 'plain' ? stripMarkdown(content) : content;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(as);
    } catch {
      /* no-op */
    }
  }

  return (
    <div className="flex items-center gap-1">
      <ActionButton
        label={copied === 'plain' ? 'Copied' : 'Copy'}
        onClick={() => copy('plain')}
        active={copied === 'plain'}
        icon={<Copy className="h-3 w-3" />}
      />
      <ActionButton
        label={copied === 'md' ? 'Copied' : 'Copy markdown'}
        onClick={() => copy('md')}
        active={copied === 'md'}
        icon={<FileText className="h-3 w-3" />}
      />
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  active,
  icon,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-md border border-border bg-background/70 px-2 py-1',
        'text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
        active && 'border-primary/40 text-foreground',
      )}
      aria-label={label}
    >
      {active ? <Check className="h-3 w-3" /> : icon}
      {label}
    </button>
  );
}

/**
 * Markdown-fenced code block with a "Copy" button on the header. Always
 * visible so users can grab snippets without hovering.
 */
function CodeBlock({
  language,
  code,
  useDarkTheme,
}: {
  language: string;
  code: string;
  useDarkTheme: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* no-op */
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/60">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-3 py-1 text-[11px] text-muted-foreground">
        <span className="font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent transition-colors',
            copied && 'text-foreground',
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={useDarkTheme ? (oneDark as Record<string, React.CSSProperties>) : (oneLight as Record<string, React.CSSProperties>)}
        customStyle={{
          margin: 0,
          padding: '0.9em 1em',
          background: 'transparent',
          fontSize: '0.85rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

/** Best-effort: strip markdown formatting for plain-text copy. */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, '').replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
