import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

/** Loading placeholder; size it with className to match the final layout. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-control bg-surface-sunk animate-pulse motion-reduce:animate-none', className)} />;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <Icon aria-hidden className="size-8 text-text-muted" />
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-sm text-text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <TriangleAlert aria-hidden className="size-8 text-danger" />
      <p className="font-semibold">Something went wrong</p>
      <p className="max-w-sm text-text-muted">{message}</p>
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </div>
  );
}
