'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Square, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn, uid } from '@/lib/utils';
import { compressImage, isImageFile, type CompressedImage } from '@/lib/image';

interface ComposerProps {
  onSend: (text: string, attachments: CompressedImage[]) => void;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_ATTACHMENTS = 4;
const MAX_DIM = 1024;
const QUALITY = 0.8;

export function Composer({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = 'Message ContentGPT…',
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<CompressedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-grow textarea up to a cap.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isStreaming && !disabled;

  function handleSend() {
    if (!canSend) return;
    onSend(value.trim(), attachments);
    setValue('');
    setAttachments([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  async function ingestFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter(isImageFile);
    const remaining = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const toProcess = incoming.slice(0, remaining);
    if (toProcess.length === 0) return;
    const compressed = await Promise.all(
      toProcess.map((file) => compressImage(file, MAX_DIM, QUALITY)),
    );
    setAttachments((prev) => [...prev, ...compressed]);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.kind === 'file') {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void ingestFiles(files);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) {
      void ingestFiles(e.dataTransfer.files);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'w-full max-w-3xl mx-auto px-3 pb-4',
        isDragging && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background rounded-2xl',
      )}
    >
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div key={a.id} className="group/att relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.dataUrl}
                alt={a.name}
                className="h-16 w-16 rounded-md border border-border object-cover"
              />
              <button
                onClick={() => removeAttachment(a.id)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border border-border bg-background/80 px-3 py-2 shadow-sm backdrop-blur-md',
          'focus-within:ring-2 focus-within:ring-primary/30 transition-shadow',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void ingestFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || attachments.length >= MAX_ATTACHMENTS}
          aria-label="Attach image"
          title="Attach image (paste or drop also works)"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          placeholder={placeholder}
          className="min-h-[36px] max-h-[220px] py-2 leading-6"
          disabled={disabled}
        />

        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        ContentGPT can make mistakes — verify important facts.
      </p>
    </div>
  );
}

// Marker so the unused `uid` import doesn't get tree-shaken by mistake.
void uid;
