import type { RequestHandler } from 'express';

export interface MaintenanceConfig {
    enabled: boolean;
    /** ISO date-time it is expected back, if known. */
    until?: string;
    message?: string;
}

/**
 * While maintenance is on, every API call answers 503 with code MAINTENANCE (the app then shows its maintenance page),
 * except the health check, so the host keeps seeing a live server. Retry-After tells clients when to look again.
 */
export function maintenanceGate(config: MaintenanceConfig): RequestHandler {
    return (req, res, next) => {
        if (!config.enabled || req.path === '/api/health') return next();
        const secondsLeft = config.until ? Math.ceil((Date.parse(config.until) - Date.now()) / 1000) : NaN;
        res.set('Retry-After', String(secondsLeft > 0 ? Math.min(secondsLeft, 3600) : 120));
        res.status(503).json({
            error: {
                message: 'The portal is down for maintenance. Please try again shortly.',
                details: { code: 'MAINTENANCE', until: config.until ?? null, message: config.message ?? null },
            },
        });
    };
}
