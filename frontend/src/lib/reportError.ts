// Sends a crash to the server log (POST /api/client-errors), so it can be found and fixed without anyone having to
// describe it. Best effort: a report that cannot be sent is dropped, never turned into a second error.

const sent = new Set<string>();

export function reportClientError(error: Error, kind: 'crash' | 'stale-build' = 'crash') {
  const key = `${kind}:${error.name}:${error.message}`;
  if (sent.has(key)) return; // the same crash re-rendering is one report, not fifty
  sent.add(key);
  try {
    void fetch('/api/client-errors', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true, // still sent if the person reloads straight away, which the error page invites
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, name: error.name, message: error.message, stack: error.stack, path: window.location.pathname }),
    }).catch(() => undefined);
  } catch {
    /* no fetch (old browser, tests): nothing to do */
  }
}
