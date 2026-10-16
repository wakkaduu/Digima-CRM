export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Thin fetch wrapper: same-origin cookies, JSON bodies, and errors as ApiError. */
export async function api<T>(path: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  const isForm = rest.body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...rest,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      headers: { ...(json !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}), ...headers },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error?.message || res.statusText, res.status, data?.error?.details?.code);
  }
  return data as T;
}

const LOST = 'Connection lost. Check your signal and tap Retry.';

/**
 * multipart POST with upload progress (fetch cannot report it). Same error shape as `api`.
 * Rejects with code 'NETWORK' when the connection drops and 'TIMEOUT' when the upload stalls. A phone that goes
 * offline mid-upload is detected at once (the browser's offline event) instead of hanging until the timeout, and an
 * upload that makes no progress for `stallMs` is abandoned, so the rep can tap Retry instead of waiting a minute.
 */
export function apiUpload<T>(
  path: string,
  body: FormData,
  {
    onProgress,
    timeoutMs = 90_000,
    stallMs = 25_000,
    headers,
  }: { onProgress?: (percent: number) => void; timeoutMs?: number; stallMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return reject(new ApiError(LOST, 0, 'NETWORK'));
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', path);
    xhr.withCredentials = true;
    for (const [k, v] of Object.entries(headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.timeout = timeoutMs;
    xhr.responseType = 'json';

    let lastActivity = Date.now();
    let done = false;
    const stallTimer = setInterval(() => {
      if (Date.now() - lastActivity >= stallMs) fail('The upload stalled. Check your signal and tap Retry.', 'TIMEOUT');
    }, Math.min(1000, stallMs));
    const onOffline = () => fail(LOST, 'NETWORK');
    window.addEventListener('offline', onOffline);

    function finish() {
      done = true;
      clearInterval(stallTimer);
      window.removeEventListener('offline', onOffline);
    }
    function fail(message: string, code: string) {
      if (done) return;
      finish();
      xhr.abort();
      reject(new ApiError(message, 0, code));
    }

    xhr.upload.onprogress = (e) => {
      lastActivity = Date.now();
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (done) return;
      finish();
      const data = xhr.response ?? {};
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as T);
      reject(new ApiError(data?.error?.message || xhr.statusText, xhr.status, data?.error?.details?.code));
    };
    xhr.onerror = () => fail(LOST, 'NETWORK');
    xhr.ontimeout = () => fail('The upload took too long. Check your signal and tap Retry.', 'TIMEOUT');
    xhr.send(body);
  });
}
