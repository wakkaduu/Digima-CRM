import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { CATEGORIES, type AuditInput, type Category } from '../services/audit';

/**
 * Records one event. Never throws: the log must not be the reason an approval or an invite fails, so a write that
 * fails is only reported in the server log.
 */
export async function record(e: AuditInput | null) {
    if (!e) return;
    try {
        await prisma.auditEvent.create({
            data: {
                actorId: e.actor.id,
                actorName: e.actor.name,
                actorRole: e.actor.role,
                action: e.action,
                outcome: e.outcome ?? 'ok',
                paymentId: e.paymentId ?? null,
                targetUserId: e.targetUserId ?? null,
                summary: e.summary,
                details: (e.details ?? undefined) as Prisma.InputJsonValue | undefined,
            },
        });
    } catch (err) {
        console.error(`[audit] could not record ${e.action}: ${e.summary}`, err);
    }
}

export interface EventQuery {
    category?: Category;
    actorId?: string;
    failedOnly?: boolean;
    /** Inclusive start and exclusive end, as instants. */
    from?: Date;
    until?: Date;
    page: number;
    pageSize: number;
}

export function eventWhere(q: Omit<EventQuery, 'page' | 'pageSize'>): Prisma.AuditEventWhereInput {
    return {
        ...(q.category ? { OR: CATEGORIES[q.category].map((prefix) => ({ action: { startsWith: prefix } })) } : {}),
        ...(q.actorId ? { actorId: q.actorId } : {}),
        ...(q.failedOnly ? { outcome: 'failed' } : {}),
        ...(q.from || q.until ? { at: { ...(q.from ? { gte: q.from } : {}), ...(q.until ? { lt: q.until } : {}) } } : {}),
    };
}

/** Newest first, with the total for paging. */
export async function list(q: EventQuery) {
    const where = eventWhere(q);
    const [items, total] = await prisma.$transaction([
        prisma.auditEvent.findMany({ where, orderBy: [{ at: 'desc' }, { id: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
        prisma.auditEvent.count({ where }),
    ]);
    return { items, total };
}
