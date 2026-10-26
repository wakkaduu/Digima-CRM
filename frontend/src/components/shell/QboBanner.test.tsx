import { screen } from '@testing-library/react';
import { QboBanner } from './QboBanner';
import { mockApi, renderWithProviders } from '../../test/renderWithProviders';

afterEach(() => vi.unstubAllGlobals());

const banner = (status: unknown, route = '/customers') => {
  mockApi({ 'GET /api/auth/qbo/status': [200, status] });
  renderWithProviders(<QboBanner />, route);
};

describe('QboBanner', () => {
  it('stays quiet while the connection is healthy', async () => {
    banner({ connected: true, needsReauth: false, expiresInDays: 90 });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks someone who has never connected (for example an email login) to connect, and returns them to the same page', async () => {
    banner({ connected: false, needsReauth: false }, '/estimates?tab=Accepted');
    expect(await screen.findByRole('alert')).toHaveTextContent('not connected to your account yet');
    expect(screen.getByRole('link', { name: 'Connect QuickBooks' })).toHaveAttribute(
      'href',
      '/api/auth/qbo/login?mode=connect&next=%2Festimates%3Ftab%3DAccepted',
    );
  });

  it('asks to reconnect when the connection has expired', async () => {
    banner({ connected: false, needsReauth: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('has expired');
    expect(screen.getByRole('link', { name: 'Reconnect QuickBooks' })).toBeInTheDocument();
  });

  it('warns ahead of time when the connection lapses within two weeks', async () => {
    banner({ connected: true, needsReauth: false, expiresInDays: 6 });
    expect(await screen.findByRole('alert')).toHaveTextContent('expires in 6 days');
  });
});
