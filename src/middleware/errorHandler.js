const env = require('../config/env');

class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

// Express 4 doesn't catch rejected promises, so wrap async handlers.
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res, next) =>
    next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
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

module.exports = { HttpError, asyncHandler, notFound, errorHandler };