import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma';

export const findById = (id: string) => prisma.user.findUnique({ where: { id } });

// Employees who can be named as the person who received a payment: active sales accounts only.
export const listReceivers = () =>
  prisma.user.findMany({
    where: { role: 'sales', active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

export const findByEmail = (email: string) => prisma.user.findUnique({ where: { email } });

export const findByQboSub = (qboSub: string) => prisma.user.findUnique({ where: { qboSub } });

export const findByInviteHash = (inviteTokenHash: string) => prisma.user.findUnique({ where: { inviteTokenHash } });

/** Replaces any earlier invite for this account. */
export const setInvite = (id: string, inviteTokenHash: string, inviteExpiresAt: Date) =>
  prisma.user.update({ where: { id }, data: { inviteTokenHash, inviteExpiresAt } });

/**
 * Uses up an invite: links the Intuit id to the invited account and clears the link, in one atomic step so two
 * browsers racing with the same link cannot both win. Null when the link is unknown, expired or already used.
 */
export const linkWithInvite = (hash: string, qboSub: string) =>
  prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { inviteTokenHash: hash, inviteExpiresAt: { gt: new Date() }, active: true },
      data: { qboSub, inviteTokenHash: null, inviteExpiresAt: null },
    });
    return claimed.count === 1 ? tx.user.findUnique({ where: { qboSub } }) : null;
  });

export const create = (data: Prisma.UserCreateInput) => prisma.user.create({ data });

export const update = (id: string, data: Prisma.UserUpdateInput) => prisma.user.update({ where: { id }, data });

/** Everyone, with whether they have signed in with QuickBooks yet (for the account list). */
export const listAll = () =>
  prisma.user.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, email: true, role: true, active: true, qboSub: true, inviteTokenHash: true, inviteExpiresAt: true, createdAt: true, qboToken: { select: { updatedAt: true } } },
  });

export const countActiveByRole = (role: UserRole) => prisma.user.count({ where: { role, active: true } });
