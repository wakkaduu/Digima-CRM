import type { ReportGroup } from '../api/types';
import { todayManila } from './format';

/** Ranges a SuperAdmin picks most; `custom` takes the dates from the URL. */
export const PRESETS = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom' },
] as const;
export type PresetId = (typeof PRESETS)[number]['id'];

export const MAX_RANGE_DAYS = 366;
/** Above this many days a bar per day is too thin to read, so "Day" is not offered. */
export const MAX_DAILY_DAYS = 92;
const DAY_MS = 86_400_000;

export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

/** The dates a preset stands for, today included, in Manila time. */
export function presetRange(id: Exclude<PresetId, 'custom'>, today = todayManila()) {
  switch (id) {
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case '90d':
      return { from: addDays(today, -89), to: today };
    case 'month':
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'lastMonth': {
      const lastDay = addDays(`${today.slice(0, 7)}-01`, -1);
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay };
    }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** Why a custom range cannot be used, or null when it can. */
export function rangeProblem(from: string, to: string, today = todayManila()) {
  if (!from || !to) return 'Choose a start and an end date.';
  if (from > to) return 'The start date must be on or before the end date.';
  if (to > today) return 'The end date cannot be in the future.';
  if (daysBetween(from, to) > MAX_RANGE_DAYS) return `Choose a range of ${MAX_RANGE_DAYS} days or less.`;
  return null;
}

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const fmt = (day: string, opts: Intl.DateTimeFormatOptions) => utc(day).toLocaleDateString('en-PH', { ...opts, timeZone: 'UTC' });

/** "Oct 5 – Nov 3, 2026", with each side's year when the range crosses one. */
export function rangeLabel(from: string, to: string) {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const start = fmt(from, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start} – ${fmt(to, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** The name of one bar: "Oct 5" for a day or the week starting then, "Oct" (or "Oct 2026" across years) for a month. */
export function periodLabel(start: string, group: ReportGroup, crossesYear = false) {
  if (group === 'month') return fmt(start, crossesYear ? { month: 'short', year: 'numeric' } : { month: 'short' });
  return fmt(start, { month: 'short', day: 'numeric' });
}

/** "45 min", "3 h 20 min", "2 d 4 h": a wait, to the precision that matters at its size. */
export function waitLabel(minutes: number | null) {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return minutes % 60 ? `${h} h ${minutes % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}
