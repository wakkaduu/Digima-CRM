import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 doesn't catch rejected promises, so wrap async handlers.
const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
    (req, res, next) =>
        Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
