import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieSession from 'cookie-session';
import rateLimit from 'express-rate-limit';

import env from './config/env';
import { notFound, errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import qboRoutes from './routes/qbo.routes';
import paymentRoutes from './routes/payment.routes';
import configRoutes from './routes/config.routes';
import { customerRoutes, estimateRoutes } from './routes/crm.routes';

const app = express();
const isProd = env.NODE_ENV === 'production';

if (isProd) app.set('trust proxy', 1); // needed for secure cookies behind Render/Heroku/nginx

app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                'script-src': ["'self'"],
                'style-src': ["'self'", "'unsafe-inline'"], // React inline style attributes
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
app.use('/api/auth', authRoutes);
app.use('/api/qbo', qboRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/config', configRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/estimates', estimateRoutes);

// JSON API only. The React app is served separately (Vite on :5173, which proxies /api here).
app.use(notFound);
app.use(errorHandler);

export default app;