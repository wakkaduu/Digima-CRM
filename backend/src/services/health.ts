// Health: is the process up (liveness), and can it reach its database (readiness)?

const startedAt = Date.now();

/** Resolves with the ping's result, or rejects after `ms`, so a hung database cannot hang the health check. */
function within<T>(ms: number, p: Promise<T>) {
    return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms).unref?.())]);
}

export async function checkHealth(pingDatabase: () => Promise<unknown>, timeoutMs = 2000, now = Date.now()) {
    const t0 = Date.now();
    let database: 'up' | 'down' = 'up';
    let error: string | undefined;
    try {
        await within(timeoutMs, pingDatabase());
    } catch (err) {
        database = 'down';
        error = err instanceof Error ? err.message : String(err);
    }
    return {
        ok: database === 'up',
        database,
        databaseMs: Date.now() - t0,
        uptimeSeconds: Math.round((now - startedAt) / 1000),
        ...(error ? { error } : {}),
    };
}
