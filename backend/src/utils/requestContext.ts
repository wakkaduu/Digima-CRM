import { AsyncLocalStorage } from 'node:async_hooks';
import HttpError from './HttpError';

// Whose QuickBooks connection a request should use. Set by asyncHandler once a route's middleware
// has authenticated the user, so every QuickBooks call below a controller runs as that user.
const qboUser = new AsyncLocalStorage<string>();

export const runAsQboUser = <T>(userId: string, fn: () => T): T => qboUser.run(userId, fn);

export function currentQboUserId(): string {
    const id = qboUser.getStore();
    if (!id) throw new HttpError(401, 'Please sign in with QuickBooks first.', { code: 'QBO_REAUTH_REQUIRED' });
    return id;
}
