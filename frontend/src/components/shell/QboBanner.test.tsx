import { screen } from '@testing-library/react';
import { QboBanner } from './QboBanner';
import { mockApi, renderWithProviders } from '../../test/renderWithProviders';

const admin = { id: '1', name: 'Ana', email: 'a@x.co', role: 'admin' as const, mustChangePassword: false };
afterEach(() => vi.unstubAllGlobals());

const banner = (status: unknown, user = admin) => {
  mockApi({ 'GET /api/auth/qbo/status': [200, status] });
  renderWithProviders(<QboBanner user={user} />);
};

describe('QboBanner', () => {
  it('stays quiet while the connection is healthy', async () => {
    banner({ connected: true, needsReauth: false, expiresInDays: 90 });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns when QuickBooks is not connected, with a link to fix it', async () => {
    banner({ connected: false, needsReauth: false });
    expect(await screen.findByRole('alert')).toHaveTextContent('QuickBooks is not connected');
    expect(screen.getByRole('link', { name: 'Reconnect QuickBooks' })).toHaveAttribute('href', '/setup');
  });

  it('warns when the connection has expired', async () => {
    banner({ connected: false, needsReauth: true, expiresInDays: 0 });
    expect(await screen.findByRole('alert')).toHaveTextContent('has expired');
  });

  it('warns ahead of time when the connection lapses within two weeks', async () => {
    banner({ connected: true, needsReauth: false, expiresInDays: 6 });
    expect(await screen.findByRole('alert')).toHaveTextContent('expires in 6 days');
  });

  it('is for admins only and never calls the API for sales', async () => {
    const fetchMock = mockApi({});
    renderWithProviders(<QboBanner user={{ ...admin, role: 'sales' }} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
