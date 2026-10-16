import { ApiError, apiUpload } from './client';

class FakeXhr {
  static last: FakeXhr;
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  status = 0;
  statusText = '';
  response: unknown = null;
  timeout = 0;
  responseType = '';
  withCredentials = false;
  constructor() {
    FakeXhr.last = this;
  }
  headers: Record<string, string> = {};
  open() {}
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  aborted = false;
  abort() {
    this.aborted = true;
  }
  send() {}
}

beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr));
afterEach(() => vi.unstubAllGlobals());

describe('apiUpload', () => {
  it('reports progress and resolves with the JSON body', async () => {
    const seen: number[] = [];
    const p = apiUpload<{ ok: boolean }>('/x', new FormData(), { onProgress: (n) => seen.push(n) });
    FakeXhr.last.upload.onprogress?.({ lengthComputable: true, loaded: 31, total: 100 });
    FakeXhr.last.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    FakeXhr.last.status = 200;
    FakeXhr.last.response = { ok: true };
    FakeXhr.last.onload?.();
    await expect(p).resolves.toEqual({ ok: true });
    expect(seen).toEqual([31, 100]);
  });

  it('turns server errors into ApiError with the error code', async () => {
    const p = apiUpload('/x', new FormData());
    FakeXhr.last.status = 409;
    FakeXhr.last.response = { error: { message: 'Duplicate', details: { code: 'DUPLICATE_PENDING' } } };
    FakeXhr.last.onload?.();
    await expect(p).rejects.toMatchObject({ status: 409, code: 'DUPLICATE_PENDING', message: 'Duplicate' });
  });

  it('flags dropped connections and timeouts so the UI can offer Retry', async () => {
    const a = apiUpload('/x', new FormData());
    FakeXhr.last.onerror?.();
    await expect(a).rejects.toBeInstanceOf(ApiError);
    await expect(a).rejects.toMatchObject({ code: 'NETWORK' });
    const b = apiUpload('/x', new FormData());
    FakeXhr.last.ontimeout?.();
    await expect(b).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('sends extra headers such as the Idempotency-Key', () => {
    void apiUpload('/x', new FormData(), { headers: { 'Idempotency-Key': 'abc12345' } }).catch(() => undefined);
    expect(FakeXhr.last.headers).toEqual({ 'Idempotency-Key': 'abc12345' });
  });

  it('gives up at once when the phone goes offline mid-upload, and does not even start when already offline', async () => {
    const p = apiUpload('/x', new FormData());
    window.dispatchEvent(new Event('offline'));
    await expect(p).rejects.toMatchObject({ code: 'NETWORK' });
    expect(FakeXhr.last.aborted).toBe(true);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const before = FakeXhr.last;
    await expect(apiUpload('/x', new FormData())).rejects.toMatchObject({ code: 'NETWORK' });
    expect(FakeXhr.last).toBe(before); // no request was made
    vi.restoreAllMocks();
  });

  it('abandons an upload that stops making progress', async () => {
    vi.useFakeTimers();
    const p = apiUpload('/x', new FormData(), { stallMs: 5000 });
    const caught = p.catch((e) => e);
    FakeXhr.last.upload.onprogress?.({ lengthComputable: true, loaded: 10, total: 100 });
    await vi.advanceTimersByTimeAsync(3000);
    FakeXhr.last.upload.onprogress?.({ lengthComputable: true, loaded: 20, total: 100 }); // still moving: not a stall
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await caught).toMatchObject({ code: 'TIMEOUT' });
    expect(FakeXhr.last.aborted).toBe(true);
    vi.useRealTimers();
  });
});
