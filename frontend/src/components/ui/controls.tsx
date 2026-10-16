import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

const control =
  'block w-full scroll-mb-32 border border-border-strong rounded-control bg-surface text-text text-input disabled:bg-surface-sunk disabled:text-text-muted aria-invalid:border-2 aria-invalid:border-danger';

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(control, 'min-h-(--control-h) px-2.5 py-2', className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<'select'>) {
  return <select className={cn(control, 'min-h-(--control-h) px-2.5 py-2', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-24 px-2.5 py-2', className)} {...rest} />;
}

/** Checkbox with its label; the whole row is the touch target. */
export function Checkbox({
  children,
  className,
  ...rest
}: Omit<ComponentProps<'input'>, 'type'> & { children: ReactNode }) {
  return (
    <label className={cn('flex items-center gap-2 min-h-(--control-h)', className)}>
      <input type="checkbox" className="size-5 accent-accent" {...rest} />
      {children}
    </label>
  );
}
