import { breakdown, netAfterFee, waiting } from './review';

describe('waiting', () => {
  const now = new Date('2026-10-16T12:00:00Z').getTime();
  it('shows minutes, hours and days as text', () => {
    expect(waiting('2026-10-16T11:59:30Z', now).text).toBe('Just now');
    expect(waiting('2026-10-16T11:30:00Z', now).text).toBe('Waiting 30m');
    expect(waiting('2026-10-16T09:00:00Z', now).text).toBe('Waiting 3h');
    expect(waiting('2026-10-14T12:00:00Z', now).text).toBe('Waiting 2d');
  });
  it('flags payments older than 24 hours', () => {
    expect(waiting('2026-10-15T13:00:00Z', now).stale).toBe(false);
    expect(waiting('2026-10-15T12:00:00Z', now).stale).toBe(true);
  });
});

describe('fee maths', () => {
  it('takes the default 1.5% off in centavos', () => {
    expect(netAfterFee('2500.00')).toBe('2462.50');
    expect(netAfterFee('1000.00', 2)).toBe('980.00');
  });
  it('breaks the amounts down', () => {
    const b = breakdown('2500.00', '2462.50');
    expect(b).toMatchObject({ grossC: 250000, finalC: 246250, feeC: 3750, ok: true });
    expect(b.feePercent).toBeCloseTo(1.5);
  });
  it('rejects empty, zero and too-high amounts', () => {
    expect(breakdown('100.00', '').invalid).toBe(true);
    expect(breakdown('100.00', '0').invalid).toBe(true);
    expect(breakdown('100.00', 'abc').invalid).toBe(true);
    expect(breakdown('100.00', '100.01')).toMatchObject({ tooHigh: true, ok: false });
  });
});
