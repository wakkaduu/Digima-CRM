import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordPage } from './PasswordPage';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

afterEach(() => vi.unstubAllGlobals());

const me = (hasPassword: boolean) => ({ 'GET /api/auth/me': [200, { user: { id: '1', name: 'Ann', email: 'a@b.co', role: 'sales', hasPassword } }] as [number, unknown] });

describe('PasswordPage', () => {
  it('checks the new password before sending it', async () => {
    const fetchMock = mockApi(me(true));
    renderWithProviders(<PasswordPage />);

    await userEvent.type(await screen.findByLabelText('Current password'), 'old-password');
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    await userEvent.type(screen.getByLabelText('Type the new password again'), 'other');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText(/must be at least 10 characters/)).toBeInTheDocument();
    expect(screen.getByText('The two new passwords do not match.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('shows the server error when the current password is wrong', async () => {
    mockApi({ ...me(true), 'POST /api/auth/change-password': [422, { error: { message: 'The current password is incorrect.' } }] });
    renderWithProviders(<PasswordPage />);

    await userEvent.type(await screen.findByLabelText('Current password'), 'wrong-password');
    await userEvent.type(screen.getByLabelText('New password'), 'a-brand-new-one');
    await userEvent.type(screen.getByLabelText('Type the new password again'), 'a-brand-new-one');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText('The current password is incorrect.')).toBeInTheDocument();
  });

  it('tells a QuickBooks-only account it has no password', async () => {
    mockApi(me(false));
    renderWithProviders(<PasswordPage />);
    expect(await screen.findByText(/signs in with QuickBooks, so it has no password/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
  });
});
