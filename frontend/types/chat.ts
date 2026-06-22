// Shared client-side types.

export type Role = 'user' | 'assistant' | 'system';

export interface AttachmentMeta {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string; // base64 data URL (compressed)
  size: number; // bytes
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  attachments?: AttachmentMeta[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  copyrightFree: boolean;
  theme: 'light' | 'dark' | 'system';
}

export type Suggestion = {
  id: string;
  title: string;
  prompt: string;
};
