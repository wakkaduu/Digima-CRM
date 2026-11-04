import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const SAFE_ID = /^[A-Za-z0-9._-]{8,100}$/;

/**
 * Gives every request an id: the one a proxy already set (X-Request-Id), or a fresh one. It goes back in the response
 * header and in every error reply, and into each log line, so "error abc123" from a user finds its line in the logs.
 */
export const requestId: RequestHandler = (req, res, next) => {
    const incoming = req.get('x-request-id');
    req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    res.set('X-Request-Id', req.id);
    next();
};
