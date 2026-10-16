import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

// Single-row table: the one QuickBooks company this portal is connected to.
const SINGLETON_ID = 1;

export const get = () => prisma.qboToken.findUnique({ where: { id: SINGLETON_ID } });

export const save = (data: Omit<Prisma.QboTokenCreateInput, 'id'>) =>
    prisma.qboToken.upsert({
        where: { id: SINGLETON_ID },
        create: { id: SINGLETON_ID, ...data },
        update: data,
    });
