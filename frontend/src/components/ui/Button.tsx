import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex items-center justify-center gap-2 rounded-control border font-semibold no-underline cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed';

const variants: Record<ButtonVariant, string> = {
  primary: 'border-accent bg-accent text-white hover:bg-accent-hover hover:border-accent-hover',
  secondary: 'border-border-strong bg-surface text-text hover:bg-surface-sunk',
  ghost: 'border-transparent bg-transparent text-text hover:bg-surface-sunk',
  danger: 'border-danger bg-surface text-danger hover:bg-danger-bg',
  link: 'min-h-6 border-0 bg-transparent p-0 font-normal text-accent underline', // 24px: WCAG 2.5.8 minimum
};

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-(--control-h) px-4 text-body',
  sm: 'min-h-(--control-h-sm) px-3 text-small',
  // Primary page action: taller than a standard control on phones (thumb-friendly), standard on desktop.
  lg: 'min-h-12 px-4 text-body lg:min-h-(--control-h)',
};

/** Class string for things that must look like a button but are not one (e.g. router links). */
export function buttonClass({
  variant = 'secondary',
  size = 'md',
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}) {
  return cn(base, variants[variant], variant !== 'link' && sizes[size], block && 'w-full');
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Shows a spinner and disables the button; the label keeps its width so the layout does not jump. */
  loading?: boolean;
  /** Visible text while loading, e.g. "Uploading 62%…". Without it the label is hidden behind the spinner. */
  loadingLabel?: string;
}

export function Button({ variant = 'secondary', size = 'md', block, loading = false, loadingLabel, className, children, disabled, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={cn(buttonClass({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* opacity (not visibility) keeps the label in the accessible name while the spinner covers it */}
      {loading && loadingLabel ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          {loadingLabel}
        </span>
      ) : (
        <>
          <span className={cn('inline-flex items-center gap-2', loading && 'opacity-0')}>{children}</span>
          {loading && <Loader2 aria-hidden className="absolute size-4 animate-spin motion-reduce:animate-none" />}
        </>
      )}
    </button>
  );
}
