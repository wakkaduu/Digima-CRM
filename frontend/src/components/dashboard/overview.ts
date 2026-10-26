import type { HistoryPayment } from '../../api/types';
import { cents } from '../../lib/format';

/** How many days the SuperAdmin overview looks back. */
export const WINDOW_DAYS = 14;
/** Submissions are fetched from this far back, so payments submitted a while ago but decided inside the window still count. */
export const FETCH_DAYS = 30;
const DAY_MS = 86_400_000;

/** "2026-10-26" for an instant, in the company's timezone. */
export const manilaDay = (d: string | number | Date) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

/** `n` consecutive calendar days ending today (Manila), oldest first, as YYYY-MM-DD. */
export function lastDays(n: number, now = Date.now()): string[] {
  const end = new Date(`${manilaDay(now)}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

/** The oldest day to ask the API for (inclusive). */
export const fetchFrom = (now = Date.now()) => lastDays(FETCH_DAYS, now)[0]!;

/** "Oct 26" for a YYYY-MM-DD day (no timezone shifting). */
export const dayShort = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "2 days", "5 hours", "12 minutes": how long ago, for a sentence ("has waited 2 days"). */
export function elapsed(since: string, now = Date.now()) {
  const mins = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  return days >= 1 ? unit(days, 'day') : hours >= 1 ? unit(hours, 'hour') : unit(mins, 'minute');
}

export interface Overview {
  /** Approved money per day, oldest first, in centavos. */
  days: { day: string; cents: number }[];
  approvedC: number;
  approvedCount: number;
  rejectedCount: number;
  /** Approved + rejected inside the window (voided payments are neither). */
  reviewedCount: number;
  /** Approved money by `bankDepositedTo` key. */
  banks: Map<string, { cents: number; count: number }>;
  /** The latest decisions of any kind, newest first. */
  recent: HistoryPayment[];
}

const decidedAt = (p: HistoryPayment) => (p.reviewedAt ? new Date(p.reviewedAt).getTime() : 0);

/** Everything the overview shows about the decided payments, computed from the rows exactly as the API sent them. */
export function summarise(items: HistoryPayment[], now = Date.now()): Overview {
  const days = lastDays(WINDOW_DAYS, now).map((day) => ({ day, cents: 0 }));
  const byDay = new Map(days.map((d) => [d.day, d]));
  const banks = new Map<string, { cents: number; count: number }>();
  let approvedC = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (const p of items) {
    if (!p.reviewedAt) continue;
    const bucket = byDay.get(manilaDay(p.reviewedAt));
    if (!bucket) continue;
    if (p.status === 'rejected') rejectedCount++;
    if (p.status !== 'approved') continue;
    const c = cents(p.finalAmount ?? p.amountSubmitted);
    bucket.cents += c;
    approvedC += c;
    approvedCount++;
    const bank = banks.get(p.bankDepositedTo) ?? { cents: 0, count: 0 };
    bank.cents += c;
    bank.count++;
    banks.set(p.bankDepositedTo, bank);
  }

  const recent = items
    .filter((p) => p.status !== 'pending' && p.reviewedAt)
    .sort((a, b) => decidedAt(b) - decidedAt(a));

  return { days, approvedC, approvedCount, rejectedCount, reviewedCount: approvedCount + rejectedCount, banks, recent };
}

/** The ticks of a bar chart: round steps, zero at the bottom, the top tick always above the largest value. */
export function niceTicks(max: number, intervals = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / intervals;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag);
  const top = Math.floor(max / step) * step === max ? max + step : Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
