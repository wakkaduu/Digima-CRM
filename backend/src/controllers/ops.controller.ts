import { z } from 'zod';
import { prisma } from '../config/prisma';
import { loadUser } from '../middleware/requireRole';
import { checkHealth } from '../services/health';
import asyncHandler from '../utils/asyncHandler';

// GET /api/health/live -> the process is up. For a host that restarts the app when this fails: it never touches the
// database, so a database outage does not turn into a restart loop.
export const live = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true });

// GET /api/health -> the process is up AND the database answers (2 s timeout). 503 when it does not, for uptime monitors.
export const health = asyncHandler(async (req, res) => {
    const result = await checkHealth(() => prisma.$queryRaw`SELECT 1`);
    if (!result.ok) console.error(`[health] ${req.id} database down: ${result.error}`);
    const { error: _hidden, ...publicResult } = result; // the raw driver error stays in the log
    res.status(result.ok ? 200 : 503).json(publicResult);
});

const clip = (n: number) => z.string().trim().max(n * 4).transform((s) => s.slice(0, n));

export const clientErrorSchema = z.object({
    message: clip(500),
    name: clip(100).optional(),
    stack: clip(4000).optional(),
    path: clip(300).optional(),
    kind: z.enum(['crash', 'stale-build']).default('crash'),
});

// POST /api/client-errors -> a page crashed in someone's browser. Logged with who and where, so it can be found and
// fixed without asking the user for a screenshot. Never fails: a broken report must not cause another error.
export const clientError = asyncHandler(async (req, res) => {
    const parsed = clientErrorSchema.safeParse(req.body);
    if (parsed.success) {
        const user = await loadUser(req).catch(() => null);
        const e = parsed.data;
        console.error(
            `[client-error] ${req.id} ${e.kind} on ${e.path ?? '?'} by ${user ? `${user.name} (${user.role})` : 'signed-out visitor'}: ${e.name ?? 'Error'}: ${e.message}`,
            e.stack ? `\n${e.stack}` : ''
        );
    }
    res.status(204).end();
});
