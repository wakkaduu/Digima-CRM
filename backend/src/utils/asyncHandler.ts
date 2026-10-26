import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { runAsQboUser } from './requestContext';

// Express 4 doesn't catch rejected promises, so wrap async handlers.
// Behind requireAuth/requireRole, the handler also runs as that user's QuickBooks connection.
const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
    (req, res, next) => {
        const run = () => Promise.resolve(fn(req, res, next)).catch(next);
        return req.user ? runAsQboUser(req.user.id, run) : run();
    };

export default asyncHandler;
