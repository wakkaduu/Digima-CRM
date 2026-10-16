export const peso = (n: unknown) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n) || 0);

/** Money as pesos: "₱2,500.00". */
export const money = peso;

/** "Oct 16, 2026, 3:30 PM" in the company's timezone. */
export const dateTime = (d: string | number | Date) =>
  new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
export const when = dateTime;

/** "Oct 16, 2026" for a timestamp, in the company's timezone. (Date-only values use `dayLabel`.) */
export const dateShort = (d: string | number | Date) =>
  new Date(d).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "2 days ago" / "in 3 hours". Pair it with the absolute time in a `title` (see RelativeTime). */
export function relativeTime(d: string | number | Date, now = Date.now()) {
  const diff = new Date(d).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.trunc(diff / ms), unit);
  }
  return 'just now';
}

export const bankLabel = (b: string) => (b === 'HappyMed' ? 'Happy Med' : b);

/** "1,234.50" -> 123450. Money math is done in integer centavos. */
export const cents = (v: unknown) => Math.round(Number(String(v).replace(/,/g, '')) * 100);

/** Tolerates pasted values such as "₱ 2,500.00" or "PHP2500". */
export const cleanAmount = (v: string) => v.replace(/php|₱|,|\s/gi, '');

/** "2500" -> "2,500.00" for display; returns the input unchanged if it is not a valid amount. */
export const formatAmountInput = (v: string) => {
  const raw = cleanAmount(v);
  return AMOUNT_RE.test(raw) && Number(raw) > 0
    ? Number(raw).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v;
};

/** Today as YYYY-MM-DD in the company's timezone (what the date picker and the API use). */
export const todayManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

/** "2026-10-16" or an ISO timestamp -> "Oct 16, 2026" (no timezone shifting for date-only values). */
export const dayLabel = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'UTC' });

export const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;
