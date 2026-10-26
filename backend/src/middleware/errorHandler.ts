import type { ErrorRequestHandler, RequestHandler } from 'express';
import env from '../config/env';
import HttpError from '../utils/HttpError';

export const notFound: RequestHandler = (req, res, next) =>
    next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);

    // QuickBooks' raw fault and Intuit's transaction id are for our logs, not for the browser.
    let details = err.details;
    if (details && typeof details === 'object' && !Array.isArray(details)) {
        const { fault, intuitTid, ...rest } = details as Record<string, unknown>;
        if (fault || intuitTid) console.error('QuickBooks error', { intuitTid, fault });
        details = Object.keys(rest).length ? rest : undefined;
    }

    const hideMessage = status === 500 && env.NODE_ENV === 'production';
    res.status(status).json({
        error: {
            message: hideMessage ? 'Internal server error' : err.message,
            details,
        },
    });
};
