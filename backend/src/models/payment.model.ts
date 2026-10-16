import type { BankAccount, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

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
