const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieSession = require('cookie-session');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const isProd = env.NODE_ENV === 'production';

if (isProd) app.set('trust proxy', 1); // needed for secure cookies behind Render/Heroku/nginx

app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                'script-src': ["'self'", 'https://cdn.tailwindcss.com'],
                'style-src': ["'self'", "'unsafe-inline'"], // Tailwind CDN injects <style>
                'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
                'upgrade-insecure-requests': isProd ? [] : null, // keep http://localhost working
            },
        },
    })
);
app.use(compression());
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
    cookieSession({
        name: 'pp_session',
        keys: [env.SESSION_SECRET],
        httpOnly: true,
        sameSite: 'lax', // required so the cookie survives Intuit's redirect back to us
        secure: isProd,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
    })
);

// Brute-force protection for the access-code login
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/qbo', require('./routes/qbo.routes'));
app.use('/api/payments', require('./routes/payment.routes'));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;