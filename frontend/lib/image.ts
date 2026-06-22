// Image utility: compresses a File down to a base64 dataURL before sending to the AI.
// Caps at 1024px on the longest edge and ~80% quality so dataURLs stay small.

'use client';

import { uid } from './utils';

export interface CompressedImage {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number; // bytes of the resulting dataURL (approx)
}

const MAX_DIM = 1024;
const QUALITY = 0.8;

export async function compressImage(file: File, maxDim = MAX_DIM, quality = QUALITY): Promise<CompressedImage> {
  const source = await readAsDataURL(file);
  const img = await loadImage(source);

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, width, height);

  // Re-encode as JPEG for photographs, PNG for graphics with transparency.
  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(outputType, quality);

  return {
    id: uid('att'),
    name: file.name,
    mimeType: outputType,
    dataUrl,
    size: Math.round((dataUrl.length - `data:${outputType};base64,`.length) * 0.75),
  };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = src;
  });
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
