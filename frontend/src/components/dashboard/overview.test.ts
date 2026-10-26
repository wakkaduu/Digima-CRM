import type { HistoryPayment } from '../../api/types';
import { elapsed, lastDays, manilaDay, niceTicks, summarise } from './overview';

const NOW = new Date('2026-10-26T04:00:00Z').getTime(); // 12:00 on Oct 26 in Manila

const pay = (o: Partial<HistoryPayment>): HistoryPayment =>
  ({ id: 'x', customerName: 'Co', amountSubmitted: '1000.00', finalAmount: null, bankDepositedTo: 'BDO', status: 'approved', createdAt: '2026-10-20T00:00:00Z', reviewedAt: '2026-10-25T02:00:00Z', ...o }) as HistoryPayment;

describe('lastDays', () => {
  it('ends on today in Manila, oldest first', () => {
    const d = lastDays(14, NOW);
    expect(d).toHaveLength(14);
    expect(d[0]).toBe('2026-10-13');
    expect(d.at(-1)).toBe('2026-10-26');
  });
  it('uses the Manila date, not the UTC one', () => {
    expect(manilaDay('2026-10-25T17:00:00Z')).toBe('2026-10-26'); // 01:00 next day in Manila
  });
});

describe('summarise', () => {
  it('sums approved money per day from the rows as sent, in centavos', () => {
    const s = summarise(
      [
        pay({ id: 'a', finalAmount: '985.00' }),
        pay({ id: 'b', amountSubmitted: '2500.50', reviewedAt: '2026-10-25T05:00:00Z', bankDepositedTo: 'Cash' }), // no finalAmount: falls back to the amount submitted
        pay({ id: 'c', status: 'rejected' }),
        pay({ id: 'd', status: 'voided' }),
        pay({ id: 'e', reviewedAt: '2026-09-01T00:00:00Z' }), // decided before the window
        pay({ id: 'f', status: 'pending', reviewedAt: null }),
      ],
      NOW,
    );
    expect(s.approvedC).toBe(98500 + 250050);
    expect(s.approvedCount).toBe(2);
    expect(s.days.reduce((n, d) => n + d.cents, 0)).toBe(s.approvedC); // the bars add up to the figure
    expect(s.days.find((d) => d.day === '2026-10-25')?.cents).toBe(s.approvedC);
    expect(s.rejectedCount).toBe(1);
    expect(s.reviewedCount).toBe(3); // voided is neither approved nor rejected
    expect(s.banks.get('BDO')).toEqual({ cents: 98500, count: 1 });
    expect(s.banks.get('Cash')).toEqual({ cents: 250050, count: 1 });
    expect([...s.banks.values()].reduce((n, b) => n + b.cents, 0)).toBe(s.approvedC);
  });

  it('lists the latest decisions of any kind, newest first, without pending rows', () => {
    const s = summarise([pay({ id: 'old', reviewedAt: '2026-10-20T00:00:00Z' }), pay({ id: 'new', status: 'rejected', reviewedAt: '2026-10-25T09:00:00Z' }), pay({ id: 'p', status: 'pending', reviewedAt: null })], NOW);
    expect(s.recent.map((p) => p.id)).toEqual(['new', 'old']);
  });

  it('is all zeros for no data', () => {
    const s = summarise([], NOW);
    expect(s.approvedC).toBe(0);
    expect(s.reviewedCount).toBe(0);
    expect(s.days.every((d) => d.cents === 0)).toBe(true);
  });
});

describe('niceTicks', () => {
  it('uses round steps with the top tick above the largest value', () => {
    expect(niceTicks(42_300)).toEqual([0, 20_000, 40_000, 60_000]);
    expect(niceTicks(40_000)).toEqual([0, 10_000, 20_000, 30_000, 40_000, 50_000]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
  });
  it('draws only the zero line for an empty series', () => {
    expect(niceTicks(0)).toEqual([0]);
  });
});

describe('elapsed', () => {
  it('reads as a span in a sentence', () => {
    expect(elapsed('2026-10-24T04:00:00Z', NOW)).toBe('2 days');
    expect(elapsed('2026-10-26T03:00:00Z', NOW)).toBe('1 hour');
    expect(elapsed('2026-10-26T03:48:00Z', NOW)).toBe('12 minutes');
  });
});
