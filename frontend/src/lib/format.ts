export const peso = (n: unknown) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n) || 0);

export const when = (d: string | number | Date) =>
  new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

export const bankLabel = (b: string) => (b === 'HappyMeal' ? 'Happy Meal' : b);

/** "1,234.50" -> 123450. Money math is done in integer centavos. */
export const cents = (v: unknown) => Math.round(Number(String(v).replace(/,/g, '')) * 100);

export const cleanAmount = (v: string) => v.replace(/,/g, '').trim();

/** Today as YYYY-MM-DD in the company's timezone (what the date picker and the API use). */
export const todayManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

/** "2026-10-16" or an ISO timestamp -> "Oct 16, 2026" (no timezone shifting for date-only values). */
export const dayLabel = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'UTC' });

export const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;
