import type { User } from '@prisma/client';

declare global {
    namespace Express {
        interface Request {
            /** Set by requireAuth / requireRole; only read in handlers behind them. */
            user: User;
            /** Set first thing for every request (middleware/requestId.ts); in the logs and in every error reply. */
            id: string;
        }
    }

    namespace CookieSessionInterfaces {
        interface CookieSessionObject {
            user?: { id: string; name: string; role: string };
            /** When this session's sign-in happened (ms). Each sign-in gets a new value, so "once per sign-in" can be told apart. */
            signedInAt?: number;
            qboState?: string | null;
            /** Set when a signed-in user starts "Connect QuickBooks": the callback attaches the connection to this account. */
            connectUserId?: string | null;
            /** SHA-256 of the invite link opened in this browser, used by the next QuickBooks sign-in. */
            inviteHash?: string | null;
            /** Same-site path to return to after QuickBooks sign-in. */
            next?: string | null;
        }
    }
}

export {};
