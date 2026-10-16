import type { User } from '@prisma/client';

declare global {
    namespace Express {
        interface Request {
            /** Set by requireAuth / requireRole; only read in handlers behind them. */
            user: User;
        }
    }

    namespace CookieSessionInterfaces {
        interface CookieSessionObject {
            user?: { id: string; name: string; role: string };
            qboState?: string | null;
        }
    }
}

export {};
