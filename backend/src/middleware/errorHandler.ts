import type { ErrorRequestHandler, RequestHandler } from 'express';
import env from '../config/env';
import HttpError from '../utils/HttpError';

export const notFound: RequestHandler = (req, res, next) =>
    next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);

    const hideMessage = status === 500 && env.NODE_ENV === 'production';
    res.status(status).json({
        error: {
            message: hideMessage ? 'Internal server error' : err.message,
            details: err.details,
        },
    });
};
