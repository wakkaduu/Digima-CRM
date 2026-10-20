import type { BankAccount, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { ListQuery, SortField } from '../validators/payment.validator';

/** Time an admin has to undo a rejection. */
export const REJECT_UNDO_WINDOW_MS = 30_000;

const MINE_SELECT = {
    id: true,
    customerName: true,
    qboEstimateId: true,
    qboEstimateNumber: true,
    amountSubmitted: true,
    finalAmount: true,
    bankDepositedTo: true,
    status: true,
    rejectionReason: true,
    createdAt: true,
    salesSeenAt: true,
    receivedOn: true,
    receivedBy: true,
};

export const findById = (id: string) => prisma.payment.findUnique({ where: { id } });

export const findReceiptInfo = (id: string) =>
    prisma.payment.findUnique({
        where: { id },
        select: { submittedById: true, proofImageUrl: true, proofPublicId: true },
    });

export const listPending = () =>
    prisma.payment.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' }, // oldest first
    });

export const listBySubmitter = (userId: string, take = 30) =>
    prisma.payment.findMany({
        where: { submittedById: userId },
        orderBy: { createdAt: 'desc' },
        take,
        select: MINE_SELECT,
    });

export const listActiveForEstimates = (estimateIds: string[]) =>
    prisma.payment.findMany({
        where: {
            qboEstimateId: { in: estimateIds },
            status: { in: ['pending', 'approved'] },
        },
        select: { qboEstimateId: true, status: true, amountSubmitted: true, finalAmount: true },
    });

// Same bank + same reference number among live payments = true duplicate.
export const findActiveByReference = (bank: BankAccount, referenceNo: string) =>
    prisma.payment.findFirst({
        where: { bankDepositedTo: bank, referenceNo, status: { in: ['pending', 'approved'] } },
        select: { id: true },
    });

export const findRecentPendingDuplicate = ({
    estimateId,
    amount,
    bank,
    since,
}: {
    estimateId: string;
    amount: string;
    bank: BankAccount;
    since: Date;
}) =>
    prisma.payment.findFirst({
        where: {
            qboEstimateId: estimateId,
            amountSubmitted: amount,
            bankDepositedTo: bank,
            status: 'pending',
            createdAt: { gte: since },
        },
        select: { id: true },
    });

export const create = (data: Prisma.PaymentUncheckedCreateInput) => prisma.payment.create({ data, select: { id: true, status: true } });

export const update = (id: string, data: Prisma.PaymentUncheckedUpdateInput) => prisma.payment.update({ where: { id }, data });

// Only touches the row if it is still pending; returns the number of rows changed.
export const rejectIfPending = async (id: string, data: Prisma.PaymentUncheckedUpdateInput) => {
    const { count } = await prisma.payment.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'rejected', ...data },
    });
    return count;
};

export const markApprovedAsSeen = (userId: string) =>
    prisma.payment.updateMany({
        where: {
            submittedById: userId,
            status: { in: ['approved', 'rejected'] },
            salesSeenAt: null,
        },
        data: { salesSeenAt: new Date() },
    });

/* ── Listing (UI-5.1) ── */

const DAY_MS = 24 * 60 * 60 * 1000;
// Day boundaries are Manila midnight (UTC+8, no daylight saving).
const manilaStart = (ymd: string) => new Date(`${ymd}T00:00:00+08:00`);

/** Filters + role scope -> Prisma where. Sales are always limited to their own rows. */
export function buildListWhere(q: ListQuery, scope: { role: 'admin' | 'sales'; userId: string }): Prisma.PaymentWhereInput {
    const and: Prisma.PaymentWhereInput[] = [];
    if (scope.role === 'sales') and.push({ submittedById: scope.userId });
    else if (q.rep) and.push({ submittedById: q.rep });
    if (q.status?.length) and.push({ status: { in: q.status } });
    if (q.bank) and.push({ bankDepositedTo: q.bank as BankAccount });
    if (q.customerId) and.push({ qboCustomerId: q.customerId });
    if (q.estimateId) and.push({ qboEstimateId: q.estimateId });
    if (q.from) and.push({ createdAt: { gte: manilaStart(q.from) } });
    if (q.to) and.push({ createdAt: { lt: new Date(manilaStart(q.to).getTime() + DAY_MS) } }); // inclusive of the "to" day
    if (q.q) {
        const contains = { contains: q.q, mode: 'insensitive' as const };
        and.push({
            OR: [
                { customerName: contains },
                { qboEstimateNumber: contains },
                ...(scope.role === 'admin' ? [{ referenceNo: contains }, { submittedBy: contains }] : []),
            ],
        });
    }
    return and.length ? { AND: and } : {};
}

export async function search(q: ListQuery, scope: { role: 'admin' | 'sales'; userId: string }) {
    const where = buildListWhere(q, scope);
    const [field, dir] = q.sort.split(':') as [SortField, 'asc' | 'desc'];
    const [items, total] = await prisma.$transaction([
        prisma.payment.findMany({
            where,
            // `id` breaks ties so pages never repeat or skip rows.
            orderBy: [{ [field]: dir }, { id: 'asc' }],
            skip: (q.page - 1) * q.pageSize,
            take: q.pageSize,
        }),
        prisma.payment.count({ where }),
    ]);
    return { items, total };
}

/* ── Badges, recents ── */

export const countPending = () => prisma.payment.count({ where: { status: 'pending' } });

export const countUnseen = (userId: string) =>
    prisma.payment.count({ where: { submittedById: userId, status: { in: ['approved', 'rejected'] }, salesSeenAt: null } });

/** The estimates this user submitted payments for most recently (newest first, no repeats). */
export async function recentEstimateIds(userId: string, take = 5) {
    const rows = await prisma.payment.findMany({
        where: { submittedById: userId },
        orderBy: { createdAt: 'desc' },
        distinct: ['qboEstimateId'],
        take,
        select: { qboEstimateId: true },
    });
    return rows.map((r) => r.qboEstimateId);
}

/* ── Idempotent submit ── */

export const findByIdempotencyKey = (userId: string, key: string) =>
    prisma.payment.findUnique({ where: { submittedById_idempotencyKey: { submittedById: userId, idempotencyKey: key } } });

/* ── Reject undo ── */

/**
 * Puts a rejected payment back in the queue, but only for the admin who rejected it, within the undo window,
 * and while nothing was posted to QuickBooks. One atomic statement, so two clicks cannot both win.
 */
export async function undoReject(id: string, reviewerId: string) {
    const { count } = await prisma.payment.updateMany({
        where: {
            id,
            status: 'rejected',
            reviewedById: reviewerId,
            qboPaymentId: null,
            approvedAt: { gte: new Date(Date.now() - REJECT_UNDO_WINDOW_MS) },
        },
        data: {
            status: 'pending',
            rejectionReason: null,
            approvedBy: null,
            approvedAt: null,
            reviewedById: null,
            salesSeenAt: null,
        },
    });
    return count;
};

/* ── Customers module ── */

/** Per QuickBooks customer: payments approved so far (as submitted, matching the estimate progress) and the most recent submission. */
export async function customerPaymentStats() {
    const rows = await prisma.payment.groupBy({
        by: ['qboCustomerId', 'status'],
        where: { qboCustomerId: { not: null } },
        _sum: { amountSubmitted: true },
        _max: { createdAt: true },
        _count: { _all: true },
    });
    const stats = new Map<string, { paidToDate: number; pendingCount: number; lastPaymentAt: Date | null }>();
    for (const r of rows) {
        const s = stats.get(r.qboCustomerId!) ?? { paidToDate: 0, pendingCount: 0, lastPaymentAt: null };
        if (r.status === 'approved') s.paidToDate += Number(r._sum.amountSubmitted ?? 0);
        if (r.status === 'pending') s.pendingCount += r._count._all;
        const at = r._max.createdAt;
        if (at && (!s.lastPaymentAt || at > s.lastPaymentAt)) s.lastPaymentAt = at;
        stats.set(r.qboCustomerId!, s);
    }
    return stats;
}
