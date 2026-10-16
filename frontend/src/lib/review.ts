import { cents } from './format';

/**
 * Fallback bank-fee rate for the "apply fee" shortcut. The real rate comes from GET /api/config/banks
 * (DEFAULT_FEE_PERCENT on the server); this is only used until that answers.
 */
export const DEFAULT_FEE_PERCENT = 1.5;

/** Payments older than this are flagged in the queue. */
const STALE_MS = 24 * 60 * 60 * 1000;

/** "Waiting 3h" / "Waiting 2d". `stale` is true past 24 hours; the flag always comes with the text. */
export function waiting(createdAt: string, now = Date.now()) {
  const ms = Math.max(0, now - new Date(createdAt).getTime());
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const text = days >= 1 ? `Waiting ${days}d` : hours >= 1 ? `Waiting ${hours}h` : mins >= 1 ? `Waiting ${mins}m` : 'Just now';
  return { text, stale: ms >= STALE_MS };
}

/** Amount after taking `percent` off, as a "1234.50" string. Integer centavos, rounded like the old card did. */
export function netAfterFee(amountSubmitted: string, percent = DEFAULT_FEE_PERCENT) {
  const gross = cents(amountSubmitted);
  return ((gross - Math.round((gross * percent) / 100)) / 100).toFixed(2);
}

export interface Breakdown {
  grossC: number;
  finalC: number;
  feeC: number;
  /** Fee as a percentage of the amount paid. */
  feePercent: number;
  invalid: boolean;
  tooHigh: boolean;
  ok: boolean;
}

/** Everything the decision panel and the approve dialog show about the amounts, in one place. */
export function breakdown(amountSubmitted: string, finalAmount: string): Breakdown {
  const grossC = cents(amountSubmitted);
  const finalC = cents(finalAmount);
  const invalid = !Number.isFinite(finalC) || finalC <= 0;
  const tooHigh = !invalid && finalC > grossC;
  const feeC = invalid ? 0 : grossC - finalC;
  return {
    grossC,
    finalC,
    feeC,
    feePercent: grossC > 0 ? (feeC / grossC) * 100 : 0,
    invalid,
    tooHigh,
    ok: !invalid && !tooHigh,
  };
}
