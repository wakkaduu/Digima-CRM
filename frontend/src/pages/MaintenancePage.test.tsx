import { act, screen } from '@testing-library/react';
import { App } from '../App';
import { api } from '../api/client';
import { clearMaintenance } from '../lib/maintenance';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

const MAINTENANCE: [number, unknown] = [
  503,
  { error: { message: 'The portal is down for maintenance.', details: { code: 'MAINTENANCE', until: null, message: 'Moving to a faster server.' } } },
];

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => clearMaintenance());
});

describe('maintenance', () => {
  it('switches the whole app to the maintenance page when the server says so', async () => {
    mockApi({ 'GET /api/auth/me': MAINTENANCE });
    renderWithProviders(<App />, '/privacy');
    await act(async () => {
      await api('/api/auth/me').catch(() => undefined);
    });
    expect(screen.getByRole('heading', { name: 'Down for maintenance' })).toBeInTheDocument();
    expect(screen.getByText('Moving to a faster server.')).toBeInTheDocument();
    expect(screen.getByText(/reloads by itself/)).toBeInTheDocument();
  });

  it('ignores other 503s', async () => {
    mockApi({ 'GET /api/x': [503, { error: { message: 'busy' } }] });
    renderWithProviders(<App />, '/privacy');
    await act(async () => {
      await api('/api/x').catch(() => undefined);
    });
    expect(screen.queryByRole('heading', { name: 'Down for maintenance' })).not.toBeInTheDocument();
  });
});
