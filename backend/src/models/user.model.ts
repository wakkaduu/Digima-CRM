import type { Prisma } from '@prisma/client';
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

export const create = (data: Prisma.UserCreateInput) => prisma.user.create({ data });

export const updatePassword = (id: string, passwordHash: string) =>
    prisma.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: false },
    });
