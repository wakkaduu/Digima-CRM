// The SuperAdmin report: what was collected, through which account, by whom, and how fast payments are reviewed.
// Pure: the controller loads the rows, this turns them into figures, so every number can be tested without a database.
import type { BankAccount, PaymentStatus } from '@prisma/client';

export type Group = 'day' | 'week' | 'month';

/** Every bank in the order the portal lists them, so an account with nothing still shows as a zero. */
export const BANK_ORDER: BankAccount[] = ['BDO', 'UnionBank', 'Digima', 'HappyMed', 'Cash'];

/** Wait bands for "how long until a decision", shortest first. Upper bounds in minutes. */
export const WAIT_BANDS: { label: string; upTo: number }[] = [
    { label: 'Under 1 hour', upTo: 60 },
    { label: '1 to 4 hours', upTo: 4 * 60 },
    { label: '4 to 24 hours', upTo: 24 * 60 },
    { label: '1 to 3 days', upTo: 3 * 24 * 60 },
    { label: 'Over 3 days', upTo: Infinity },
];

export const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;
const OLDEST_WAITING = 5;

export interface ReportRow {
    id: string;
    status: PaymentStatus;
    customerName: string;
    bankDepositedTo: BankAccount;
    amountSubmitted: string | number | { toString(): string };
    finalAmount: string | number | { toString(): string } | null;
    submittedBy: string;
    submittedById: string | null;
    createdAt: Date;
    /** When it was approved or rejected (both are stored here). */
    approvedAt: Date | null;
}

/** "2026-10-26" for an instant, in the company's timezone. */
export const manilaDay = (d: Date | number) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

/** The first instant of a Manila calendar day. */
export const manilaStart = (day: string) => new Date(`${day}T00:00:00+08:00`);

export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Calendar days from `from` to `to`, both included. */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

/** Daily up to a month, weekly up to about six months, monthly beyond: always a readable number of bars. */
export const autoGroup = (days: number): Group => (days <= 31 ? 'day' : days <= 183 ? 'week' : 'month');

/** The bucket a day falls in: the day itself, the Monday of its week, or the first of its month. */
export function bucketOf(day: string, group: Group) {
    if (group === 'day') return day;
    if (group === 'month') return `${day.slice(0, 7)}-01`;
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    return addDays(day, -((weekday + 6) % 7));
}

/** Every bucket start from `from` to `to`, oldest first, so empty periods are drawn as gaps rather than skipped. */
export function bucketsFor(from: string, to: string, group: Group) {
    const out: string[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
        const b = bucketOf(day, group);
        if (out[out.length - 1] !== b) out.push(b);
    }
    return out;
}

const toCents = (v: ReportRow['amountSubmitted']) => Math.round(Number(String(v)) * 100);
const pesos = (c: number) => c / 100;

/** Nearest-rank percentile of sorted values; null when there are none. */
export function percentile(sorted: number[], p: number) {
    if (!sorted.length) return null;
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]!;
}

export interface ReportInput {
    from: string;
    to: string;
    group: Group;
    /** Approved, rejected or voided with a decision from the start of the previous period to `to`. */
    decided: ReportRow[];
    /** Submitted between `from` and `to`, any status. */
    submitted: ReportRow[];
    /** Everything still waiting for review, whenever it was sent. */
    pending: ReportRow[];
    now?: number;
}

export function buildReport({ from, to, group, decided, submitted, pending, now = Date.now() }: ReportInput) {
    const days = daysBetween(from, to);
    const previous = { from: addDays(from, -days), to: addDays(from, -1) };
    const inRange = (day: string) => day >= from && day <= to;
    const inPrevious = (day: string) => day >= previous.from && day <= previous.to;

    const series = new Map(bucketsFor(from, to, group).map((start) => [start, { start, count: 0, netC: 0 }]));
    const banks = new Map(BANK_ORDER.map((bank) => [bank, { bank, count: 0, grossC: 0, netC: 0 }]));
    type Rep = { id: string | null; name: string; submitted: number; approved: number; rejected: number; collectedC: number; waiting: number };
    const reps = new Map<string, Rep>();
    const repOf = (r: ReportRow) => {
        const key = r.submittedById ?? `name:${r.submittedBy}`;
        let rep = reps.get(key);
        if (!rep) reps.set(key, (rep = { id: r.submittedById, name: r.submittedBy, submitted: 0, approved: 0, rejected: 0, collectedC: 0, waiting: 0 }));
        return rep;
    };

    const totals = { count: 0, grossC: 0, netC: 0, voided: 0 };
    const prior = { count: 0, netC: 0 };
    let rejected = 0;
    const waits: number[] = [];

    for (const r of decided) {
        if (!r.approvedAt) continue;
        const day = manilaDay(r.approvedAt);
        const grossC = toCents(r.amountSubmitted);
        const netC = r.finalAmount != null ? toCents(r.finalAmount) : grossC;

        if (inPrevious(day)) {
            if (r.status === 'approved') {
                prior.count++;
                prior.netC += netC;
            }
            continue;
        }
        if (!inRange(day)) continue;

        // A voided payment was approved, so it counts as a decision, but its money was reversed: it is not collected.
        waits.push(Math.max(0, Math.round((r.approvedAt.getTime() - r.createdAt.getTime()) / 60_000)));
        if (r.status === 'rejected') {
            rejected++;
            repOf(r).rejected++;
            continue;
        }
        if (r.status === 'voided') {
            totals.voided++;
            continue;
        }
        if (r.status !== 'approved') continue;

        totals.count++;
        totals.grossC += grossC;
        totals.netC += netC;
        const bucket = series.get(bucketOf(day, group))!;
        bucket.count++;
        bucket.netC += netC;
        const bank = banks.get(r.bankDepositedTo)!;
        bank.count++;
        bank.grossC += grossC;
        bank.netC += netC;
        const rep = repOf(r);
        rep.approved++;
        rep.collectedC += netC;
    }

    for (const r of submitted) repOf(r).submitted++;
    for (const r of pending) repOf(r).waiting++;

    waits.sort((a, b) => a - b);
    const bands = WAIT_BANDS.map((b) => ({ label: b.label, count: 0 }));
    for (const w of waits) bands[WAIT_BANDS.findIndex((b) => w < b.upTo)]!.count++;

    const oldest = [...pending].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const waitingC = pending.reduce((s, r) => s + toCents(r.amountSubmitted), 0);

    return {
        range: { from, to, days, group },
        previous,
        collections: {
            count: totals.count,
            gross: pesos(totals.grossC),
            fees: pesos(totals.grossC - totals.netC),
            net: pesos(totals.netC),
            voided: totals.voided,
            previousCount: prior.count,
            previousNet: pesos(prior.netC),
            series: [...series.values()].map((b) => ({ start: b.start, count: b.count, net: pesos(b.netC) })),
        },
        banks: [...banks.values()].map((b) => ({ bank: b.bank, count: b.count, gross: pesos(b.grossC), fees: pesos(b.grossC - b.netC), net: pesos(b.netC) })),
        reps: [...reps.values()]
            .map(({ collectedC, ...r }) => ({ ...r, collected: pesos(collectedC) }))
            .sort((a, b) => b.collected - a.collected || b.submitted - a.submitted || a.name.localeCompare(b.name)),
        turnaround: {
            decided: waits.length,
            rejected,
            medianMinutes: percentile(waits, 50),
            p90Minutes: percentile(waits, 90),
            bands,
            waiting: {
                count: pending.length,
                amount: pesos(waitingC),
                oldest: oldest.slice(0, OLDEST_WAITING).map((r) => ({
                    id: r.id,
                    customerName: r.customerName,
                    submittedBy: r.submittedBy,
                    amount: pesos(toCents(r.amountSubmitted)),
                    createdAt: r.createdAt.toISOString(),
                    waitingMinutes: Math.max(0, Math.round((now - r.createdAt.getTime()) / 60_000)),
                })),
            },
        },
    };
}

export type Report = ReturnType<typeof buildReport>;
