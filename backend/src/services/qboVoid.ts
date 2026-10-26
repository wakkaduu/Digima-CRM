// Reversing a posted payment in QuickBooks. The request function is passed in, so the order of the
// calls and the retry behaviour can be tested without QuickBooks.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type QboRequest = (
    path: string,
    opts?: { method?: 'GET' | 'POST'; params?: Record<string, string>; body?: unknown }
) => Promise<any>;

/** QuickBooks answers "object not found" (code 610) for something that was already deleted. */
export const isGone = (err: any) => err?.details?.fault?.Error?.[0]?.code === '610';

/**
 * The Deposit is deleted first (QuickBooks will not void a payment whose money was deposited), then the Payment is
 * voided: the balance goes back on the invoice and a zeroed record marked "Voided" stays for the audit trail.
 * Safe to run again after a failure, because each step checks what is already done.
 */
export async function voidPosted(request: QboRequest, { paymentId, depositId }: { paymentId: string; depositId?: string | null }) {
    if (depositId) {
        let deposit: any = null;
        try {
            deposit = (await request(`/deposit/${depositId}`)).Deposit;
        } catch (err) {
            if (!isGone(err)) throw err; // deleted by an earlier attempt
        }
        if (deposit) {
            await request('/deposit', {
                method: 'POST',
                params: { operation: 'delete' },
                body: { Id: deposit.Id, SyncToken: deposit.SyncToken },
            });
        }
    }

    const current = (await request(`/payment/${paymentId}`)).Payment;
    const alreadyVoided = Number(current.TotalAmt) === 0 && /void/i.test(String(current.PrivateNote ?? ''));
    if (!alreadyVoided) {
        await request('/payment', {
            method: 'POST',
            params: { operation: 'update', include: 'void' },
            body: { Id: current.Id, SyncToken: current.SyncToken, sparse: true },
        });
    }
}
