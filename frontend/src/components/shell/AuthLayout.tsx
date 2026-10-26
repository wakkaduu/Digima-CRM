import type { ReactNode } from 'react';
import { BrandLockup } from './BrandLockup';

/** The signed-out screens (sign in, invite): brand panel on the left from 1024px, the content on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <aside className="relative flex flex-col justify-between overflow-hidden p-8 text-white max-lg:hidden">
        <img src="/login-hero.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-text/60" />
        <BrandLockup className="relative" />
        <div className="relative max-w-[560px]">
          <h2 className="mb-3 text-[3rem] font-bold leading-tight">Payments, reviewed in one place.</h2>
          <p className="text-input font-medium">
            Submit a receipt, match it to the estimate, and let the team approve it, with QuickBooks kept in step.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-8 lg:px-16 lg:py-12">
        <div className="w-full max-w-[640px]">
          <BrandLockup className="mb-6 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
