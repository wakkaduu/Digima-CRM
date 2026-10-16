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
    expect(bankLabel('HappyMeal')).toBe('Happy Meal');
    expect(bankLabel('BDO')).toBe('BDO');
  });
});
