import { onlineManager } from '@tanstack/react-query';
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
