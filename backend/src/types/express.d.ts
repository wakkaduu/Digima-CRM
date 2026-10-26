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
            /** SHA-256 of the invite link opened in this browser, used by the next QuickBooks sign-in. */
            inviteHash?: string | null;
            /** Same-site path to return to after QuickBooks sign-in. */
            next?: string | null;
        }
    }
}

export {};
