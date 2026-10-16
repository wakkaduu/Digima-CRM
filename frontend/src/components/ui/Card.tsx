import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Border-only surface: no shadow on static cards (shadow is for floating layers). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('bg-surface border border-border rounded-card p-4', className)} {...rest} />;
}
