'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// Lightweight scroll-area wrapper. Uses native overflow and our
// custom scrollbar (defined in globals.css). Radix isn't needed.
export const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { viewportRef?: React.Ref<HTMLDivElement> }
>(({ className, children, viewportRef, ...rest }, ref) => (
  <div
    ref={ref}
    className={cn('relative overflow-y-auto overflow-x-hidden', className)}
    {...rest}
  >
    <div ref={viewportRef} className="h-full w-full">
      {children}
    </div>
  </div>
));
ScrollArea.displayName = 'ScrollArea';
