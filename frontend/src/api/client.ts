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
