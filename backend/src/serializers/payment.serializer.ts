import type { Payment } from '@prisma/client';
import { RECEIPT_WIDTHS } from '../validators/payment.validator';

type Role = 'admin' | 'sales';

const THUMB_WIDTH = RECEIPT_WIDTHS[1]; // 800px: readable on a phone, a fraction of the original's bytes

/** Receipt URLs. The image is streamed through the portal; `thumbUrl` is a resized copy for list views. */
export const receiptUrls = (id: string) => ({
    proofImageUrl: `/api/payments/${id}/receipt`,
    thumbUrl: `/api/payments/${id}/receipt?w=${THUMB_WIDTH}`,
});

const isUnseen = (p: Pick<Payment, 'status' | 'salesSeenAt'>) => p.status !== 'pending' && !p.salesSeenAt;

/** The row as one role may see it. Sales never get other users' data, QBO ids or internals. */
export function toListItem(p: Payment, role: Role) {
    const base = {
        id: p.id,
        customerName: p.customerName,
        qboEstimateId: p.qboEstimateId,
        qboEstimateNumber: p.qboEstimateNumber,
        amountSubmitted: p.amountSubmitted,
        finalAmount: p.finalAmount,
        bankDepositedTo: p.bankDepositedTo,
        status: p.status,
        rejectionReason: p.rejectionReason,
        voidReason: p.voidReason,
        createdAt: p.createdAt,
        receivedOn: p.receivedOn,
        receivedBy: p.receivedBy,
        reviewedAt: p.status === 'pending' ? null : p.approvedAt,
        thumbUrl: receiptUrls(p.id).thumbUrl,
    };
    if (role === 'sales') return { ...base, unseen: isUnseen(p) };
    return {
        ...base,
        submittedBy: p.submittedBy,
        submittedById: p.submittedById,
        receivedById: p.receivedById,
        referenceNo: p.referenceNo,
        reviewedBy: p.status === 'pending' ? null : p.approvedBy,
        proofImageUrl: receiptUrls(p.id).proofImageUrl,
        qboPartiallyPosted: Boolean(p.qboPaymentId) && p.status === 'pending',
    };
}

export interface AuditEvent {
    type: 'submitted' | 'approved' | 'rejected' | 'voided';
    at: Date;
    by: string | null;
    note?: string | null;
}

/** Who did what and when, reconstructed from the row (there is no separate audit table yet). */
export function auditEvents(p: Payment): AuditEvent[] {
    const events: AuditEvent[] = [{ type: 'submitted', at: p.createdAt, by: p.submittedBy }];
    if ((p.status === 'approved' || p.status === 'voided') && p.approvedAt) {
        events.push({ type: 'approved', at: p.approvedAt, by: p.approvedBy });
    }
    if (p.status === 'voided' && p.voidedAt) events.push({ type: 'voided', at: p.voidedAt, by: p.voidedBy, note: p.voidReason });
    if (p.status === 'rejected' && p.approvedAt) {
        events.push({ type: 'rejected', at: p.approvedAt, by: p.approvedBy, note: p.rejectionReason });
    }
    return events;
}

/** Single-payment view: the list item plus the audit trail, the bank fee and (admin only) QuickBooks ids. */
export function toDetail(p: Payment, role: Role) {
    const fee = p.finalAmount ? (Number(p.amountSubmitted) * 100 - Number(p.finalAmount) * 100) / 100 : null;
    return {
        ...toListItem(p, role),
        fee,
        events: auditEvents(p),
        ...(role === 'admin' ? { qbo: { paymentId: p.qboPaymentId, depositId: p.qboDepositId, customerId: p.qboCustomerId } } : {}),
    };
}
