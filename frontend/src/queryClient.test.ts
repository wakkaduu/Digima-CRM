import { onlineManager } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { queryClient } from './queryClient';

afterEach(() => onlineManager.setOnline(true));

describe('queryClient offline behaviour', () => {
  it('still runs a mutation while the browser reports offline, so a failed upload surfaces instead of hanging', async () => {
    onlineManager.setOnline(false);
    const ran = queryClient.getMutationCache().build(queryClient, { mutationFn: async () => 'ran' }).execute(undefined);
    const outcome = await Promise.race([ran, new Promise((r) => setTimeout(() => r('hung'), 300))]);
    expect(outcome).toBe('ran');
  });

  it('runs queries offline too, so a screen shows an error with Retry rather than loading forever', async () => {
    onlineManager.setOnline(false);
    const result = await Promise.race([
      queryClient.fetchQuery({ queryKey: ['offline-probe'], queryFn: async () => 'fetched' }),
      new Promise((r) => setTimeout(() => r('hung'), 300)),
    ]);
    expect(result).toBe('fetched');
  });
});

describe('queryClient QuickBooks sign-in', () => {
  const reauth = () => {
    throw new ApiError('Your QuickBooks connection has expired.', 401, 'QBO_REAUTH_REQUIRED');
  };
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockClear();
    sessionStorage.clear();
    vi.stubGlobal('location', { assign, pathname: '/customers', search: '?tab=active' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the user through QuickBooks sign-in when a read finds the connection expired, then back to the same page', async () => {
    await queryClient.fetchQuery({ queryKey: ['reauth-1'], queryFn: reauth }).catch(() => undefined);
    expect(assign).toHaveBeenCalledWith('/api/auth/qbo/login?mode=connect&next=%2Fcustomers%3Ftab%3Dactive');
  });

  it('does not loop: a second failure right after shows the error instead of redirecting again', async () => {
    await queryClient.fetchQuery({ queryKey: ['reauth-2'], queryFn: reauth }).catch(() => undefined);
    await queryClient.fetchQuery({ queryKey: ['reauth-3'], queryFn: reauth }).catch(() => undefined);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('keeps the web session when only the QuickBooks connection expired', async () => {
    queryClient.setQueryData(['me'], { id: '1' });
    await queryClient.fetchQuery({ queryKey: ['reauth-4'], queryFn: reauth }).catch(() => undefined);
    expect(queryClient.getQueryData(['me'])).toEqual({ id: '1' });
  });
});
