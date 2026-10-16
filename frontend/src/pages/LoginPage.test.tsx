import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { LoginPage } from './LoginPage';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

const page = (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<p>Home screen</p>} />
    <Route path="/admin" element={<p>Admin screen</p>} />
  </Routes>
);

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage', () => {
  it('shows field errors and does not call the API when the form is empty', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': [200, { user: null }] });
    renderWithProviders(page, '/login');

    await userEvent.click(await screen.findByRole('button', { name: 'Log in' }));

    expect(await screen.findByText(/Enter your email address, for example/)).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('shows the server error for a wrong password', async () => {
    mockApi({
      'GET /api/auth/me': [200, { user: null }],
      'POST /api/auth/login': [401, { error: { message: 'Incorrect email or password.' } }],
    });
    renderWithProviders(page, '/login');

    await userEvent.type(await screen.findByLabelText('Email address'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });

  it('sends an admin to /admin after login', async () => {
    const admin = { id: '1', name: 'Ann', email: 'a@b.co', role: 'admin', mustChangePassword: false };
    mockApi({
      'GET /api/auth/me': [200, { user: null }],
      'POST /api/auth/login': [200, { user: admin }],
    });
    renderWithProviders(page, '/login');

    await userEvent.type(await screen.findByLabelText('Email address'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByText('Admin screen')).toBeInTheDocument());
  });
});
