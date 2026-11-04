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
import userRoutes from './routes/user.routes';
import paymentRoutes from './routes/payment.routes';
import configRoutes from './routes/config.routes';
import { customerRoutes, estimateRoutes } from './routes/crm.routes';
import reportRoutes from './routes/report.routes';
import { maintenanceGate } from './middleware/maintenance';
import { requestId } from './middleware/requestId';
import opsRoutes from './routes/ops.routes';
import activityRoutes from './routes/activity.routes';

const app = express();
const isProd = env.NODE_ENV === 'production';

if (isProd) app.set('trust proxy', 1); // needed for secure cookies behind Render/Heroku/nginx

app.use(requestId);
// Private tool: no search engine should index anything the API returns.
app.use((req, res, next) => (res.set('X-Robots-Tag', 'noindex, nofollow'), next()));

app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                'script-src': ["'self'"],
                'style-src': ["'self'", "'unsafe-inline'"], // React inline style attributes
                'img-src': ["'self'", 'data:', 'blob:'],
                'upgrade-insecure-requests': isProd ? [] : null, // keep http://localhost working
            },
        },
    })
);
app.use(compression());
// Each access line carries the request id, so it lines up with the error lines for the same request.
morgan.token('id', (req) => (req as express.Request).id);
app.use(morgan(isProd ? ':id :remote-addr ":method :url" :status :res[content-length] :response-time ms ":user-agent"' : ':id :method :url :status :response-time ms'));
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

// Each sign-in attempt costs an Intuit round trip; cap them per client
app.use('/api/auth/invite', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 })); // invite tokens are unguessable; this just stops hammering
app.use('/api/auth/qbo/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }));

app.use(maintenanceGate({ enabled: env.MAINTENANCE_MODE, until: env.MAINTENANCE_UNTIL, message: env.MAINTENANCE_MESSAGE }));
app.use('/api', opsRoutes); // /api/health, /api/health/live, /api/client-errors
app.use('/api/auth', authRoutes);
app.use('/api/qbo', qboRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/config', configRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity', activityRoutes);

// JSON API only. The React app is served separately (Vite on :5173, which proxies /api here).
app.use(notFound);
app.use(errorHandler);

export default app;