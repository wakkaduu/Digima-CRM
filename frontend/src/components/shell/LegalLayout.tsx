import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { ChevronDown } from 'lucide-react';
import { COMPANY_LEGAL_NAME, CONTACT_EMAIL, LEGAL_UPDATED } from '../../lib/legal';
import { cn } from '../../lib/cn';
import { BrandLockup } from './BrandLockup';

/** One pair of equal outer margins, shared by the bar, the title band, the text and the close. */
const FRAME = 'mx-auto w-full max-w-[1040px] px-4 sm:px-6 lg:px-8';

export interface LegalSectionData {
  id: string;
  title: string;
  body: ReactNode;
}

export interface LegalPoint {
  term: string;
  text: ReactNode;
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-9 items-center rounded-control px-3 text-body transition-colors pointer-coarse:min-h-11',
    isActive ? 'bg-accent-subtle font-semibold text-accent' : 'text-text-muted hover:text-text',
  );

/**
 * Public pages that need no sign-in (privacy policy, terms, disconnect notice): a plain bar, a flat colour title band
 * that says what the page is in one line, the content, and a designed close.
 */
export function LegalShell({
  title,
  lead,
  updated = false,
  children,
}: {
  title: string;
  lead: ReactNode;
  updated?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <header className="bg-surface">
        <div className={cn(FRAME, 'flex items-center justify-between gap-4 py-3')}>
          <Link to="/login" aria-label="Digima, go to sign in" className="rounded-control">
            <BrandLockup />
          </Link>
          <nav aria-label="Legal" className="flex items-center gap-1">
            <NavLink to="/privacy" className={navLink}>
              Privacy
            </NavLink>
            <NavLink to="/terms" className={navLink}>
              Terms
            </NavLink>
            <Link
              to="/login"
              className="ml-2 inline-flex min-h-9 items-center rounded-control bg-accent px-4 text-body font-semibold text-white transition-colors hover:bg-accent-hover pointer-coarse:min-h-11"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <div className="bg-accent text-white">
        <div className={cn(FRAME, 'grid gap-6 py-12 md:grid-cols-[1.25fr_1fr] md:items-end md:gap-12 lg:py-20')}>
          <div>
            <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-[1.02] tracking-tight">{title}</h1>
            {updated && <p className="mt-4 text-body text-white/80">Last updated {LEGAL_UPDATED}</p>}
          </div>
          <p className="max-w-[44ch] text-[1.125rem] leading-snug text-white/90 sm:text-[1.25rem]">{lead}</p>
        </div>
      </div>

      <main className={cn(FRAME, 'flex-1 py-10 lg:py-14')}>{children}</main>

      <footer className="bg-surface-sunk">
        <div className={cn(FRAME, 'grid gap-8 py-12 md:grid-cols-2 md:items-end')}>
          <div>
            <p className="text-title font-semibold">Questions about your information?</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 inline-block break-all text-[1.5rem] font-semibold leading-tight text-accent underline sm:text-[1.875rem]"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
          <div className="space-y-3 text-body text-text-muted md:text-right">
            <nav aria-label="Legal documents" className="flex gap-5 md:justify-end">
              <Link to="/privacy" className="inline-flex min-h-6 items-center underline hover:text-text pointer-coarse:min-h-11">
                Privacy policy
              </Link>
              <Link to="/terms" className="inline-flex min-h-6 items-center underline hover:text-text pointer-coarse:min-h-11">
                Terms of use
              </Link>
            </nav>
            <p>
              © {new Date().getFullYear()} {COMPANY_LEGAL_NAME}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function BulletList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6 marker:text-accent">{children}</ul>;
}

/** The id of the section being read: the last one whose heading has passed the upper part of the screen. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join('|');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id));
        const first = ids.find((id) => seen.has(id));
        if (first) setActive(first);
      },
      { rootMargin: '-15% 0px -65% 0px' },
    );
    for (const id of ids) document.getElementById(id) && observer.observe(document.getElementById(id)!);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

function TocLinks({ sections, active, onPick }: { sections: LegalSectionData[]; active: string; onPick?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {sections.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            onClick={onPick}
            aria-current={active === s.id ? 'location' : undefined}
            className={cn(
              'flex min-h-9 items-center rounded-control px-3 text-body transition-colors pointer-coarse:min-h-11',
              active === s.id ? 'bg-accent-subtle font-semibold text-accent' : 'text-text-muted hover:bg-surface hover:text-text',
            )}
          >
            {s.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * A long-form legal document: a plain-language "short version" first, then one panel per section, with a contents list
 * that stays beside the text on desktop and folds to a disclosure on a phone.
 */
export function LegalDocument({
  title,
  lead,
  points,
  sections,
}: {
  title: string;
  lead: ReactNode;
  points: LegalPoint[];
  sections: LegalSectionData[];
}) {
  const all: LegalSectionData[] = [{ id: 'short-version', title: 'The short version', body: null }, ...sections];
  const active = useActiveSection(all.map((s) => s.id));
  const [open, setOpen] = useState(false);

  return (
    <LegalShell title={title} lead={lead} updated>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <aside>
          {/* Phone and tablet: folded away until asked for. */}
          <div className="rounded-card bg-surface lg:hidden">
            <button
              type="button"
              aria-expanded={open}
              aria-controls="toc-list"
              onClick={() => setOpen((v) => !v)}
              className="flex min-h-11 w-full items-center justify-between rounded-card px-4 text-body font-semibold"
            >
              On this page
              <ChevronDown aria-hidden className={cn('size-4 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
              <div id="toc-list" className="px-2 pb-3">
                <TocLinks sections={all} active={active} onPick={() => setOpen(false)} />
              </div>
            )}
          </div>
          {/* Desktop: stays in view while the text scrolls. */}
          <nav aria-label="On this page" className="sticky top-6 hidden lg:block">
            <p className="mb-2 px-3 text-body font-semibold">On this page</p>
            <TocLinks sections={all} active={active} />
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          <section id="short-version" aria-labelledby="short-version-h" className="scroll-mt-6 rounded-card bg-accent-subtle p-5 sm:p-8">
            <h2 id="short-version-h" className="text-[1.5rem] font-bold leading-tight tracking-tight">
              The short version
            </h2>
            <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-[190px_minmax(0,1fr)]">
              {points.map((p) => (
                <div key={p.term} className="contents">
                  <dt className="text-[1.0625rem] font-semibold leading-snug text-accent">{p.term}</dt>
                  <dd className="max-w-[60ch] text-[1.0625rem] leading-relaxed">{p.text}</dd>
                </div>
              ))}
            </dl>
          </section>

          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-6 rounded-card bg-surface p-5 sm:p-8">
              <h2 id={`${s.id}-h`} className="text-[1.5rem] font-bold leading-tight tracking-tight">
                {s.title}
              </h2>
              <div className="mt-4 max-w-[68ch] space-y-4 text-[1.0625rem] leading-[1.7] [&_a]:text-accent [&_a]:underline [&_strong]:font-semibold">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </LegalShell>
  );
}
