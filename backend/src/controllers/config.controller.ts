import env from '../config/env';
import asyncHandler from '../utils/asyncHandler';
import { BANK_MAP } from '../validators/payment.validator';

// GET /api/config/banks
// One place for the modes of payment and the default bank-fee rate, so the UI does not hard-code them.
//   id  = what to send as `bank` when submitting     key = what payments report in `bankDepositedTo`
export const banks = asyncHandler(async (_req, res) => {
    res.json({
        banks: Object.entries(BANK_MAP).map(([label, key]) => ({
            id: label,
            key,
            label,
            // Cash has no bank reference number; for the others it is optional but used to catch duplicates.
            referenceNumber: label === 'Cash' ? 'none' : 'optional',
        })),
        defaultFeePercent: env.DEFAULT_FEE_PERCENT,
    });
});
