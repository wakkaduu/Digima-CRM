import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Compass, PartyPopper, X } from 'lucide-react';
import { ME_KEY } from '../../api/auth';
import { api } from '../../api/client';
import type { User } from '../../api/types';
import { cn } from '../../lib/cn';
import { closeTour, markOffered, startPageTour, startTour, useTourState, wasOffered } from '../../lib/tour';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { PAGE_TOURS, pageForPath, pageSteps } from './pageTours';
import { FIRST_JOB, ROLE_READER, STEPS, type TourStep } from './steps';

/** Wait for the first page to settle before offering the welcome tour, so it does not land on a half-drawn screen. */
const OFFER_DELAY_MS = 900;
/** A page tour waits for its page's data: it checks this often, for this long, then gives up quietly until next time. */
const PAGE_POLL_MS = 300;
const PAGE_POLL_TRIES = 30;
const GAP = 14; // between the highlighted item and the card
const EDGE = 12; // the card never comes closer than this to the window edge
const PAD = 6; // the highlight's breathing room around the item

/**
 * The product tours. The welcome tour shows the main screens right after each sign-in; a page tour shows a few tips the
 * first time someone opens a page (after the welcome tour, never on top of it). Each is offered until the person
 * finishes it or ticks "Don't show … again" (saved on their account, so it holds on every device); closing it without
 * ticking the box brings it back at the next sign-in. Both can be replayed: Help and the account menu for the welcome
 * tour, the "Tour this page" button for a page.
 */
export function ProductTour({ user }: { user: User }) {
  const tour = useTourState();
  const { pathname } = useLocation();

  // The welcome tour, right after signing in. Only when the server says so (false, not missing).
  useEffect(() => {
    if (user.tourDone !== false || wasOffered(user.id, user.signedInAt, 'main')) return;
    const t = window.setTimeout(() => {
      markOffered(user.id, user.signedInAt, 'main');
      startTour(true);
    }, OFFER_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [user.id, user.tourDone, user.signedInAt]);

  // A page tour, the first time this page is opened (after the welcome tour), once its controls are on screen.
  useEffect(() => {
    const page = pageForPath(pathname);
    if (!page || tour.open) return;
    if (user.pageToursOff !== false || user.tourPagesDone?.includes(page)) return;
    if (user.tourDone === false && !wasOffered(user.id, user.signedInAt, 'main')) return; // the welcome tour comes first
    if (wasOffered(user.id, user.signedInAt, `page:${page}`)) return;
    const steps = pageSteps(page, user.role);
    if (!steps.length) return;

    let tries = 0;
    const id = window.setInterval(() => {
      tries++;
      // Ready when the page's data has drawn the first thing the tour points at.
      const ready = (steps[0]!.targets ?? []).some((t) => document.querySelector(`[data-tour="${t}"]`));
      if (ready) {
        window.clearInterval(id);
        markOffered(user.id, user.signedInAt, `page:${page}`);
        startPageTour(page, true);
      } else if (tries >= PAGE_POLL_TRIES) {
        window.clearInterval(id); // the page never got there (an error, an empty account): try again next sign-in
      }
    }, PAGE_POLL_MS);
    return () => window.clearInterval(id);
  }, [pathname, tour.open, user.id, user.role, user.signedInAt, user.tourDone, user.pageToursOff, user.tourPagesDone]);

  if (!tour.open) return null;
  if (tour.kind === 'main') return <TourDialog key="main" user={user} mode={{ kind: 'main' }} getSteps={() => STEPS[user.role]} />;
  const page = tour.page;
  return <TourDialog key={page} user={user} mode={{ kind: 'page', page }} getSteps={() => pageSteps(page, user.role)} />;
}

type Rect = { top: number; left: number; width: number; height: number };

const visible = (el: HTMLElement) => el.getClientRects().length > 0;

/** The first target that is on screen and visible, with which one it was. */
function findTarget(step: TourStep): { rect: Rect; target: string } | null {
  for (const target of step.targets ?? []) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (!el || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
    return { rect: { top: r.top, left: r.left, width: r.width, height: r.height }, target };
  }
  return null;
}

/** Brings a step's target into view when it is on the page but scrolled away (a page's controls below the fold). */
function scrollToTarget(step: TourStep) {
  for (const target of step.targets ?? []) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (!el || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    const offScreen = r.top < 64 || r.bottom > window.innerHeight - 24;
    if (offScreen) el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', inline: 'nearest' });
    return;
  }
}

/**
 * Where the card goes, so it never covers what it points at: above an item near the bottom (a tab bar), beside an item
 * in a left-hand column (a sidebar link), below it, or above it. A large area (a whole table) keeps the card in the
 * bottom-right corner of the window instead. Always on screen.
 */
export function placeCard(rect: Rect, w: number, h: number, vw = window.innerWidth, vh = window.innerHeight) {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  let left: number;
  let top: number;
  const roomBelow = rect.top + rect.height + GAP + h <= vh - EDGE;
  const roomAbove = rect.top - GAP - h >= EDGE;
  if (rect.top > vh * 0.6) {
    top = rect.top - GAP - h;
    left = rect.left + rect.width / 2 - w / 2;
  } else if (rect.left < vw / 3 && rect.width <= 280 && rect.top > 48 && rect.left + rect.width + GAP + w <= vw - EDGE) {
    // A narrow item in a left column below the top bar: a sidebar link.
    left = rect.left + rect.width + GAP;
    top = rect.top + rect.height / 2 - h / 2;
  } else if (roomBelow) {
    top = rect.top + rect.height + GAP;
    left = rect.left + rect.width / 2 - w / 2;
  } else if (roomAbove) {
    top = rect.top - GAP - h;
    left = rect.left + rect.width / 2 - w / 2;
  } else {
    // Bigger than the space around it: the card waits in the corner, over the edge of the area rather than its middle.
    top = vh - h - EDGE;
    left = vw - w - EDGE;
  }
  return { left: clamp(left, EDGE, vw - w - EDGE), top: clamp(top, EDGE, vh - h - EDGE) };
}

type Mode = { kind: 'main' } | { kind: 'page'; page: string };

function TourDialog({ user, mode, getSteps }: { user: User; mode: Mode; getSteps: () => TourStep[] }) {
  // Worked out once when the tour opens: a page tour's steps depend on what is on screen at that moment.
  const [steps] = useState(getSteps);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const main = mode.kind === 'main';
  // The welcome tour opens with a welcome (0) and ends with a close (n + 1); a page tour is just its stops (1..n).
  const firstIndex = main ? 0 : 1;
  const last = main ? steps.length + 1 : steps.length;
  const [index, setIndex] = useState(firstIndex);
  const [dontShow, setDontShow] = useState(false);
  const [target, setTarget] = useState<{ rect: Rect; target: string } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const checkId = useId();
  const step = index >= 1 && index <= steps.length ? steps[index - 1]! : null;

  const alreadyOff = main ? !!user.tourDone : !!user.pageToursOff;
  const pageDone = mode.kind === 'page' && !!user.tourPagesDone?.includes(mode.page);

  // Back to wherever focus was when the tour opened.
  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    return () => returnFocus.current?.focus?.();
  }, []);

  // Nothing of this page to show (its controls are not on screen): close quietly.
  useEffect(() => {
    if (!steps.length) closeTour();
  }, [steps.length]);

  // Find the item to highlight (scrolling it into view first), and keep the highlight on it on resize or scroll.
  useLayoutEffect(() => {
    if (step) scrollToTarget(step);
    const update = () => setTarget(step ? findTarget(step) : null);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step]);

  // Place the card once its size is known.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !target) return setPos(null);
    setPos(placeCard(target.rect, card.offsetWidth, card.offsetHeight));
  }, [target, index]);

  // Each new step is read out from its title.
  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  const save = useCallback(
    (outcome: 'finished' | 'dismissed') => {
      if (main) {
        if (user.tourDone) return;
        qc.setQueryData<User | null>(ME_KEY, (u) => (u ? { ...u, tourDone: true } : u));
      } else {
        if (outcome === 'dismissed' ? user.pageToursOff : pageDone) return;
        qc.setQueryData<User | null>(ME_KEY, (u) =>
          u ? (outcome === 'dismissed' ? { ...u, pageToursOff: true } : { ...u, tourPagesDone: [...(u.tourPagesDone ?? []), mode.page] }) : u,
        );
      }
      // Best effort: if it does not reach the server, the tour is simply offered again at the next sign-in.
      void api('/api/auth/tour', { method: 'POST', json: main ? { outcome } : { outcome, page: mode.page } }).catch(() => undefined);
    },
    [main, mode, pageDone, qc, user.pageToursOff, user.tourDone],
  );

  const skip = useCallback(() => {
    if (dontShow) save('dismissed');
    closeTour();
    if (main && !user.tourDone) {
      toast({
        text: dontShow ? 'The tour will not open by itself again. You can take it any time from Help.' : 'The tour will open again next time you sign in. You can also take it from Help.',
      });
    } else if (!main && dontShow) {
      toast({ text: 'Page tours are off. Use “Tour this page” at the top of any page to see one.' });
    }
  }, [dontShow, main, save, toast, user.tourDone]);

  const finish = useCallback(
    (to?: string) => {
      // Ticking the box and then finishing still means "do not show page tours again".
      save(!main && dontShow ? 'dismissed' : 'finished');
      if (!main && dontShow) save('finished');
      closeTour();
      if (to) navigate(to);
    },
    [dontShow, main, navigate, save],
  );

  const next = () => (index < last ? setIndex(index + 1) : finish());
  const back = () => index > firstIndex && setIndex(index - 1);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      skip();
    } else if (e.key === 'ArrowRight' && !(e.target instanceof HTMLInputElement) && index < last) {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft' && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      back();
    } else if (e.key === 'Tab') {
      // Keep focus inside the card while the tour is open.
      const f = cardRef.current?.querySelectorAll<HTMLElement>('button, input, a[href]');
      if (!f?.length) return;
      const first = f[0]!;
      const lastEl = f[f.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  if (!steps.length) return null;
  const firstName = user.name.split(/\s+/)[0] || user.name;
  const job = FIRST_JOB[user.role];
  const onMore = target?.target === 'nav:more' && step?.underMore;
  const welcome = main && index === 0;
  const done = main && index === last;
  const Icon = welcome ? Compass : done ? PartyPopper : step!.icon;
  const title = welcome ? `Welcome, ${firstName}` : done ? 'You are all set' : step!.title;
  const pageName = mode.kind === 'page' ? PAGE_TOURS[mode.page]?.name : undefined;
  const highlight = target ? { top: target.rect.top - PAD, left: target.rect.left - PAD, width: target.rect.width + PAD * 2, height: target.rect.height + PAD * 2 } : null;

  return (
    <div className="fixed inset-0 z-60" onKeyDown={onKeyDown}>
      {/* The scrim: a cut-out around the highlighted item, or the whole window for a centred step. It blocks clicks on purpose. */}
      {highlight ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[10px] border-2 border-white transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ ...highlight, boxShadow: '0 0 0 9999px rgb(16 24 40 / 0.55)' }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-text/55" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={cn(
          'fixed w-[min(23rem,calc(100vw-2rem))] rounded-card bg-surface p-5 text-text shadow-float outline-none',
          'transition-[top,left] duration-300 ease-out motion-reduce:transition-none',
          !highlight && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          highlight && !pos && 'invisible',
        )}
        style={highlight && pos ? { top: pos.top, left: pos.left } : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <Icon aria-hidden className="size-6 shrink-0 text-accent" />
            {/* Which page these tips are for, so a page tour reads as part of the page, not a stray pop-up. */}
            {pageName && <span className="truncate text-small text-text-muted">Tips for {pageName}</span>}
          </span>
          <button
            type="button"
            onClick={skip}
            aria-label={main ? 'Close the tour' : 'Close the tips'}
            className="-mt-1.5 -mr-1.5 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-text-muted hover:bg-surface-sunk hover:text-text pointer-coarse:size-11"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <h2 id={titleId} className="mt-2 text-title font-semibold">
          {title}
        </h2>
        <div id={bodyId} className="mt-1.5 text-input leading-relaxed">
          {welcome ? (
            <>
              <p>
                A quick look at what you will use as {ROLE_READER[user.role]}: {steps.length} stops, about a minute. Leave whenever you like.
              </p>
              {/* What is coming, so the length is known before starting. */}
              <ul className="mt-3 space-y-1.5 text-small">
                {steps.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <s.icon aria-hidden className="size-4 shrink-0 text-text-muted" />
                    {s.title}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-small text-text-muted">Each page also has a few tips of its own the first time you open it.</p>
            </>
          ) : done ? (
            <p>That is everything you need to get started. You can take this tour again any time from Help.</p>
          ) : (
            <>
              <p>{step!.body}</p>
              {onMore && <p className="mt-2 text-small text-text-muted">{step!.underMore}</p>}
            </>
          )}
        </div>

        {/* Where you are in the tour: the dots for the eye, the words for a screen reader. */}
        {step && steps.length > 1 && (
          <div className="mt-4 flex items-center gap-1.5" aria-label={`${index} of ${steps.length}`} role="img">
            {steps.map((s, i) => (
              <span key={s.id} className={cn('h-1.5 rounded-full transition-all motion-reduce:transition-none', i === index - 1 ? 'w-5 bg-accent' : 'w-1.5 bg-border-strong/50')} />
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
          {!alreadyOff && !done ? (
            <label htmlFor={checkId} className="flex min-h-9 cursor-pointer items-center gap-2 text-small text-text-muted pointer-coarse:min-h-11">
              <input id={checkId} type="checkbox" className="size-4 accent-accent" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
              {main ? 'Don’t show this tour again' : 'Don’t show page tours again'}
            </label>
          ) : (
            <span />
          )}

          <div className="ml-auto flex gap-2">
            {welcome ? (
              <>
                <Button onClick={skip}>Not now</Button>
                <Button variant="primary" onClick={next}>
                  Start the tour <ArrowRight aria-hidden className="size-4" />
                </Button>
              </>
            ) : done ? (
              <>
                <Button onClick={() => finish()}>Done</Button>
                <Button variant="primary" onClick={() => finish(job.to)}>
                  {job.label} <ArrowRight aria-hidden className="size-4" />
                </Button>
              </>
            ) : (
              <>
                {index > firstIndex && (
                  <Button variant="ghost" onClick={back}>
                    <ArrowLeft aria-hidden className="size-4" /> Back
                  </Button>
                )}
                <Button variant="primary" onClick={next}>
                  {!main && index === last ? 'Got it' : 'Next'}
                  {!(!main && index === last) && <ArrowRight aria-hidden className="size-4" />}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
