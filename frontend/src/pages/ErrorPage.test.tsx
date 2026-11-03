import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ErrorPage, isStaleBuild } from './ErrorPage';
import { renderWithProviders } from '../test/renderWithProviders';

function Bomb({ fail }: { fail: boolean }): ReactNode {
  if (fail) throw new Error('kaboom');
  return <p>All good</p>;
}

function Harness() {
  const [fail, setFail] = useState(true);
  return (
    <>
      <button onClick={() => setFail(false)}>fix it</button>
      <ErrorBoundary fallback={(err, reset) => <ErrorPage error={err} onRetry={reset} />}>
        <Bomb fail={fail} />
      </ErrorBoundary>
    </>
  );
}

describe('ErrorPage', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('replaces a crashed page with a plain explanation, a reload and a way out', async () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole('heading', { name: 'This page ran into a problem' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText(/Error: kaboom/)).toBeInTheDocument(); // folded away, for whoever investigates

    await userEvent.click(screen.getByRole('button', { name: 'fix it' }));
    await userEvent.click(screen.getByRole('button', { name: 'Try again without reloading' }));
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('treats a page that cannot load after a deploy as an update, not a bug', () => {
    const err = new TypeError('Failed to fetch dynamically imported module: /assets/ReportsPage-abc.js');
    expect(isStaleBuild(err)).toBe(true);
    expect(isStaleBuild(new Error('x is undefined'))).toBe(false);
    renderWithProviders(<ErrorPage error={err} />);
    expect(screen.getByRole('heading', { name: 'A new version of the portal is ready' })).toBeInTheDocument();
    expect(screen.queryByText(/If it keeps happening/)).not.toBeInTheDocument();
  });
});
