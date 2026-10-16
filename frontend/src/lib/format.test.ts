import { bankLabel, cents, cleanAmount, AMOUNT_RE } from './format';

describe('format helpers', () => {
  it('converts amounts to integer centavos', () => {
    expect(cents('1,234.50')).toBe(123450);
    expect(cents('0.1')).toBe(10);
    expect(cents('abc')).toBeNaN();
  });

  it('cleans and validates amounts', () => {
    expect(cleanAmount(' 2,500.00 ')).toBe('2500.00');
    expect(AMOUNT_RE.test('2500.00')).toBe(true);
    expect(AMOUNT_RE.test('2500.001')).toBe(false);
  });

  it('shows the human bank label', () => {
    expect(bankLabel('HappyMed')).toBe('Happy Med');
    expect(bankLabel('BDO')).toBe('BDO');
  });
});

describe('date and money formatters', () => {
  it('formats money, dates in Manila time, and relative times', async () => {
    const { money, dateShort, dateTime, relativeTime } = await import('./format');
    expect(money(2500)).toBe('₱2,500.00');
    // 23:30 UTC is already the next day in Manila (UTC+8).
    expect(dateShort('2026-10-15T23:30:00Z')).toBe('Oct 16, 2026');
    expect(dateTime('2026-10-15T23:30:00Z')).toContain('7:30');
    const now = new Date('2026-10-16T12:00:00Z').getTime();
    expect(relativeTime('2026-10-14T12:00:00Z', now)).toBe('2 days ago');
    expect(relativeTime('2026-10-16T09:00:00Z', now)).toBe('3 hours ago');
    expect(relativeTime('2026-10-16T12:00:20Z', now)).toBe('just now');
    expect(relativeTime('2026-10-16T15:00:00Z', now)).toBe('in 3 hours');
  });
});
