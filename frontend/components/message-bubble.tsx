'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Check, Copy, User, Bot } from 'lucide-react';
import type { ChatMessage } from '@/types/chat';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  useDarkTheme: boolean;
}

export function MessageBubble({ message, isStreaming, useDarkTheme }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  }

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
            isStreaming && 'animate-pulse-subtle',
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
                      <div className="overflow-hidden rounded-md border border-border/60">
                        <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-3 py-1 text-[11px] text-muted-foreground">
                          <span>{match[1]}</span>
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(text);
                              } catch {
                                /* no-op */
                              }
                            }}
                            className="rounded px-1.5 py-0.5 hover:bg-accent"
                          >
                            Copy
                          </button>
                        </div>
                        <SyntaxHighlighter
                          language={match[1]}
                          style={useDarkTheme ? (oneDark as Record<string, React.CSSProperties>) : (oneLight as Record<string, React.CSSProperties>)}
                          customStyle={{
                            margin: 0,
                            padding: '0.9em 1em',
                            background: 'transparent',
                            fontSize: '0.85rem',
                          }}
                        >
                          {text}
                        </SyntaxHighlighter>
                      </div>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && message.content && (
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground',
              'opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100',
            )}
            aria-label="Copy message"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
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
