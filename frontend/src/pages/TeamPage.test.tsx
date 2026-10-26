import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamPage from './TeamPage';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

afterEach(() => vi.unstubAllGlobals());

const me = { id: 'u1', name: 'Cy Boss', email: 'cy@x.co', role: 'superadmin' };
const none = { invitePending: false, inviteExpiresAt: null };
const members = [
  { id: 'u1', name: 'Cy Boss', email: 'cy@x.co', role: 'superadmin', active: true, linked: true, ...none, createdAt: '2026-10-01T00:00:00Z' },
  { id: 'u2', name: 'Sam Reyes', email: 'sam@x.co', role: 'sales', active: true, linked: false, invitePending: true, inviteExpiresAt: '2099-01-01T00:00:00Z', createdAt: '2026-10-02T00:00:00Z' },
  { id: 'u3', name: 'Old Hand', email: 'old@x.co', role: 'admin', active: false, linked: true, ...none, createdAt: '2026-09-01T00:00:00Z' },
  { id: 'u4', name: 'Late Larry', email: 'larry@x.co', role: 'sales', active: true, linked: false, invitePending: true, inviteExpiresAt: '2020-01-01T00:00:00Z', createdAt: '2026-10-03T00:00:00Z' },
  { id: 'u5', name: 'New Nora', email: 'nora@x.co', role: 'sales', active: true, linked: false, ...none, createdAt: '2026-10-04T00:00:00Z' },
];
const base: Record<string, [number, unknown]> = {
  'GET /api/auth/me': [200, { user: me }],
  'GET /api/users': [200, { users: members }],
};

describe('TeamPage', () => {
  it('lists everyone with where their invite stands, and protects your own account', async () => {
    mockApi({ ...base });
    renderWithProviders(<TeamPage />);

    expect(await screen.findByText('Sam Reyes')).toBeInTheDocument();
    expect(screen.getByText(/Invite pending · expires/)).toBeInTheDocument();
    expect(screen.getByText('Invite expired')).toBeInTheDocument();
    expect(screen.getByText('Not invited yet')).toBeInTheDocument();
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role for Cy Boss' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Deactivate Cy Boss' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reactivate Old Hand' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /invite link for Cy Boss/ })).not.toBeInTheDocument();
  });

  it('changes a role straight from the list', async () => {
    const fetchMock = mockApi({ ...base, 'PATCH /api/users/u2': [200, { user: { ...members[1], role: 'admin' } }] });
    renderWithProviders(<TeamPage />);

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Role for Sam Reyes' }), 'admin');

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ role: 'admin' });
    });
    expect(await screen.findByText('Sam Reyes is now Admin.')).toBeInTheDocument();
  });

  it('asks before deactivating, and says what will happen', async () => {
    const fetchMock = mockApi({ ...base, 'PATCH /api/users/u2': [200, { user: { ...members[1], active: false } }] });
    renderWithProviders(<TeamPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate Sam Reyes' }));
    expect(await screen.findByText(/QuickBooks connection is removed/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);

    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ active: false });
    });
  });

  it('shows the server error when the last SuperAdmin cannot be removed', async () => {
    mockApi({ ...base, 'PATCH /api/users/u2': [409, { error: { message: 'There must be at least one active SuperAdmin.' } }] });
    renderWithProviders(<TeamPage />);

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Role for Sam Reyes' }), 'superadmin');
    expect(await screen.findByText('There must be at least one active SuperAdmin.')).toBeInTheDocument();
  });

  it('adds a person and shows their one-time invite link', async () => {
    const link = 'http://localhost:5173/invite#abc123';
    const fetchMock = mockApi({
      ...base,
      'POST /api/users': [201, { user: { id: 'u9', name: 'Ana Cruz', email: 'ana@x.co', role: 'sales', active: true, linked: false, invitePending: true, inviteExpiresAt: '2099-01-01T00:00:00Z', createdAt: '2026-10-21T00:00:00Z' }, inviteUrl: link, inviteExpiresAt: '2099-01-01T00:00:00Z' }],
    });
    renderWithProviders(<TeamPage />);

    await userEvent.click(await screen.findByRole('button', { name: /Add person/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add person' }));
    expect(await screen.findByText('Enter their name.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Ana Cruz');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'ana@x.co');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add person' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ name: 'Ana Cruz', email: 'ana@x.co', role: 'sales' });
    });
    expect(await screen.findByLabelText('One-time invite link')).toHaveValue(link);
  });

  it('creates a replacement invite link for someone who lost theirs', async () => {
    const link = 'http://localhost:5173/invite#fresh';
    mockApi({ ...base, 'POST /api/users/u4/invite': [200, { user: members[3], inviteUrl: link, inviteExpiresAt: '2099-01-01T00:00:00Z' }] });
    renderWithProviders(<TeamPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'New invite link for Late Larry' }));
    expect(await screen.findByLabelText('One-time invite link')).toHaveValue(link);
  });
});
