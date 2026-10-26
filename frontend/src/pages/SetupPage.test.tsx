import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetupPage from './SetupPage';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

afterEach(() => vi.unstubAllGlobals());

describe('SetupPage', () => {
  it('shows connection health as a badge and details, with a summarised test result', async () => {
    mockApi({
      'GET /api/auth/qbo/status?verify=true': [200, { connected: true, realmId: '123', companyName: 'Digima Inc', lastVerifiedAt: '2026-10-16T02:00:00.000Z', refreshTokenExpiresAt: '2027-01-24T00:00:00.000Z', expiresInDays: 98 }],
      'GET /api/qbo/estimates?refresh=true': [200, { count: 2, estimates: [{ id: '1' }, { id: '2' }] }],
    });
    renderWithProviders(<SetupPage />);
    expect(await screen.findByText('Digima Inc')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/Oct 16, 2026.*10:00/)).toBeInTheDocument(); // last verified, in Manila time
    expect(screen.getByText('Jan 24, 2027 (in 98 days)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reconnect to QuickBooks/ })).toHaveAttribute('href', '/api/auth/qbo/login?mode=connect&next=%2Fsettings%2Fintegrations');

    await userEvent.click(screen.getByRole('button', { name: /Run test/ }));
    expect(await screen.findByText(/Loaded 2 open estimates/)).toBeInTheDocument();
    // Raw JSON is tucked behind a disclosure, not dumped on the page.
    expect(screen.getByText('Show raw response')).toBeInTheDocument();
  });

  it('asks for a reconnect when QuickBooks rejects the saved connection', async () => {
    mockApi({
      'GET /api/auth/qbo/status?verify=true': [200, { connected: true, realmId: '123', verifyError: 'invalid_grant' }],
    });
    renderWithProviders(<SetupPage />);
    expect(await screen.findByText('Needs reconnecting')).toBeInTheDocument();
    expect(screen.getByText(/QuickBooks rejected the saved connection: invalid_grant/)).toBeInTheDocument();
  });

  it('cannot run the test while disconnected', async () => {
    mockApi({ 'GET /api/auth/qbo/status?verify=true': [200, { connected: false }] });
    renderWithProviders(<SetupPage />);
    expect(await screen.findByRole('link', { name: /Connect QuickBooks/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run test/ })).toBeDisabled();
  });
});
