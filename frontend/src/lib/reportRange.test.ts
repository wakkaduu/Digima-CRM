import { periodLabel, presetRange, rangeLabel, rangeProblem, waitLabel } from './reportRange';

describe('report ranges', () => {
  it('turns presets into Manila dates, today included', () => {
    expect(presetRange('7d', '2026-11-04')).toEqual({ from: '2026-10-29', to: '2026-11-04' });
    expect(presetRange('30d', '2026-11-04')).toEqual({ from: '2026-10-06', to: '2026-11-04' });
    expect(presetRange('month', '2026-11-04')).toEqual({ from: '2026-11-01', to: '2026-11-04' });
    expect(presetRange('lastMonth', '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetRange('lastMonth', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(presetRange('year', '2026-11-04')).toEqual({ from: '2026-01-01', to: '2026-11-04' });
  });

  it('explains what is wrong with a custom range', () => {
    expect(rangeProblem('2026-10-01', '2026-10-31', '2026-11-04')).toBeNull();
    expect(rangeProblem('', '2026-10-31', '2026-11-04')).toMatch(/start and an end/);
    expect(rangeProblem('2026-10-31', '2026-10-01', '2026-11-04')).toMatch(/on or before/);
    expect(rangeProblem('2026-10-01', '2026-11-05', '2026-11-04')).toMatch(/future/);
    expect(rangeProblem('2025-01-01', '2026-11-04', '2026-11-04')).toMatch(/366 days/);
  });

  it('labels ranges, periods and waits', () => {
    expect(rangeLabel('2026-10-05', '2026-11-03')).toBe('Oct 5 – Nov 3, 2026');
    expect(rangeLabel('2025-12-20', '2026-01-03')).toBe('Dec 20, 2025 – Jan 3, 2026');
    expect(periodLabel('2026-10-01', 'month')).toBe('Oct');
    expect(periodLabel('2026-10-05', 'week')).toBe('Oct 5');
    expect(waitLabel(null)).toBe('—');
    expect(waitLabel(45)).toBe('45 min');
    expect(waitLabel(200)).toBe('3 h 20 min');
    expect(waitLabel(120)).toBe('2 h');
    expect(waitLabel(3 * 1440 + 60)).toBe('3 d 1 h');
  });
});
