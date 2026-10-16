import { cn } from '../../lib/cn';

/** Logo mark + "Digima" in live text (stays crisp and accessible). `collapsed` shows the mark only. */
export function BrandLockup({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src="/logo-mark.svg" alt="" width={28} height={28} className="size-7 shrink-0" />
      <span className={cn('text-[1.0625rem] font-semibold tracking-tight', collapsed && 'sr-only')}>Digima</span>
    </span>
  );
}
