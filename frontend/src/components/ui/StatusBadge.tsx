import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Clock, Link2, Link2Off, TriangleAlert, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export type Status = 'pending' | 'approved' | 'rejected' | 'partial' | 'connected' | 'disconnected';

const STATUS: Record<Status, { label: string; icon: LucideIcon; tone: string }> = {
  pending: { label: 'Pending review', icon: Clock, tone: 'bg-warning-bg border-warning text-warning' },
  approved: { label: 'Approved', icon: CheckCircle2, tone: 'bg-success-bg border-success text-success' },
  rejected: { label: 'Rejected', icon: XCircle, tone: 'bg-danger-bg border-danger text-danger' },
  partial: { label: 'Partially posted', icon: TriangleAlert, tone: 'bg-warning-bg border-warning text-warning' },
  connected: { label: 'Connected', icon: Link2, tone: 'bg-success-bg border-success text-success' },
  disconnected: { label: 'Not connected', icon: Link2Off, tone: 'bg-danger-bg border-danger text-danger' },
};

/** One shared status vocabulary: icon + text (never colour alone), same size everywhere. */
export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-px border rounded-badge text-small font-semibold whitespace-nowrap',
        s.tone,
      )}
    >
      <s.icon aria-hidden className="size-3.5" />
      {label ?? s.label}
    </span>
  );
}

/** Small "needs attention" dot with a text alternative for screen readers. */
export function NewDot({ label = 'New' }: { label?: string }) {
  return (
    <>
      <span aria-hidden className="inline-block size-2 rounded-full bg-accent align-middle" />
      <span className="sr-only">{label}</span>
    </>
  );
}

/** Count chip (nav badges). The number is text, not just a dot. */
export function CountChip({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex min-w-5 items-center justify-center rounded-badge bg-accent px-1.5 text-micro font-semibold text-white tabular-nums"
      aria-label={`${count} ${label}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Neutral tag for facts that are not a workflow status (e.g. a QuickBooks estimate state). */
export function NeutralBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-px border border-border rounded-badge bg-surface-sunk text-small font-semibold text-text-muted whitespace-nowrap">
      {children}
    </span>
  );
}
