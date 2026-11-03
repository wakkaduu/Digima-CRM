import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportsPage from './ReportsPage';
import { renderWithProviders } from '../test/renderWithProviders';
import type { Report } from '../api/types';

const report: Report = {
  range: { from: '2026-10-06', to: '2026-11-04', days: 30, group: 'day' },
  previous: { from: '2026-09-06', to: '2026-10-05' },
  collections: {
    count: 3,
    gross: 45000,
    fees: 300,
    net: 44700,
    voided: 1,
    previousCount: 2,
    previousNet: 40000,
    series: [
      { start: '2026-11-03', count: 1, net: 20000 },
      { start: '2026-11-04', count: 2, net: 24700 },
    ],
  },
  banks: [
    { bank: 'BDO', count: 2, gross: 30000, fees: 300, net: 29700 },
    { bank: 'UnionBank', count: 1, gross: 15000, fees: 0, net: 15000 },
    { bank: 'Digima', count: 0, gross: 0, fees: 0, net: 0 },
    { bank: 'HappyMed', count: 0, gross: 0, fees: 0, net: 0 },
    { bank: 'Cash', count: 0, gross: 0, fees: 0, net: 0 },
  ],
  reps: [
    { id: 'u1', name: 'Ana Reyes', submitted: 4, approved: 2, rejected: 1, waiting: 1, collected: 29700 },
    { id: 'u2', name: 'Ben Cruz', submitted: 1, approved: 1, rejected: 0, waiting: 0, collected: 15000 },
  ],
  turnaround: {
    decided: 5,
    rejected: 1,
    medianMinutes: 200,
    p90Minutes: 1500,
    bands: [
      { label: 'Under 1 hour', count: 1 },
      { label: '1 to 4 hours', count: 2 },
      { label: '4 to 24 hours', count: 1 },
      { label: '1 to 3 days', count: 1 },
      { label: 'Over 3 days', count: 0 },
    ],
    waiting: {
      count: 1,
      amount: 12000,
      oldest: [{ id: 'p9', customerName: 'Cool Cars', submittedBy: 'Ana Reyes', amount: 12000, createdAt: '2026-11-02T00:00:00Z', waitingMinutes: 2 * 1440 }],
    },
  },
};

function stubReports(answer: (url: string) => [number, unknown] = () => [200, report]) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const [status, body] = answer(String(input));
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('ReportsPage', () => {
  it('leads with what was collected and how it compares', async () => {
    stubReports();
    renderWithProviders(<ReportsPage />, '/reports');
    expect(await screen.findByText(/₱44,700\.00 collected from 3 approved payments/)).toBeInTheDocument();
    const collected = screen.getByRole('region', { name: 'Collected' });
    expect(within(collected).getByText('+₱4,700.00 (+11.8%)')).toBeInTheDocument();
    expect(within(collected).getByText(/₱300\.00 in bank fees \(0\.7%\)/)).toBeInTheDocument();
    expect(within(collected).getByText(/1 payment was approved and later voided/)).toBeInTheDocument();
  });

  it('shows every account, the reps with their numbers, the queue and the turnaround', async () => {
    stubReports();
    renderWithProviders(<ReportsPage />, '/reports');
    const accounts = await screen.findByRole('region', { name: 'Collected by account' });
    await within(accounts).findByText('Happy Med');
    expect(within(accounts).getAllByText('No payments')).toHaveLength(3);

    const rep = screen.getByRole('row', { name: /Ana Reyes/ });
    expect(within(rep).getByText('₱29,700.00')).toBeInTheDocument();
    expect(within(rep).getByText('1 waiting for review')).toBeInTheDocument();
    expect(within(rep).getByText('33%')).toBeInTheDocument(); // 1 rejected of 3 decided

    const queue = screen.getByRole('region', { name: 'Waiting for review now' });
    expect(within(queue).getByText('waiting 2 d')).toBeInTheDocument();

    const turnaround = screen.getByRole('region', { name: 'Review turnaround' });
    expect(within(turnaround).getByText('3 h 20 min')).toBeInTheDocument();
    expect(within(turnaround).getByText('90% within 1 d 1 h')).toBeInTheDocument();
    expect(within(turnaround).getByText('20.0%')).toBeInTheDocument();
  });

  it('asks the server for the chosen period and bar size', async () => {
    const fetchMock = stubReports();
    renderWithProviders(<ReportsPage />, '/reports');
    await screen.findByText(/collected from/);

    await userEvent.click(screen.getByRole('radio', { name: 'Week' }));
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)![0])).toMatch(/group=week/));

    await userEvent.click(screen.getByRole('radio', { name: '90 days' }));
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)![0])).not.toMatch(/group=/)); // a new range picks its own bar size
    expect(screen.getByRole('radio', { name: 'Day' })).toBeEnabled(); // 90 days of daily bars is still readable

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T04:00:00Z'));
    await userEvent.click(screen.getByRole('radio', { name: 'This year' }));
    expect(screen.getByRole('radio', { name: 'Day' })).toBeDisabled(); // 307 days: a bar per day would be a smear
    vi.useRealTimers();
  });

  it('explains a bad custom range instead of sending it', async () => {
    const fetchMock = stubReports();
    renderWithProviders(<ReportsPage />, '/reports?range=custom&from=2026-10-31&to=2026-10-01');
    expect(await screen.findByText(/must be on or before the end date/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('from=2026-10-31'))).toBe(true);
  });

  it('says so plainly when nothing was collected', async () => {
    const empty: Report = {
      ...report,
      collections: { ...report.collections, count: 0, gross: 0, fees: 0, net: 0, voided: 0, previousNet: 0, previousCount: 0, series: [] },
      reps: [],
      turnaround: { ...report.turnaround, decided: 0, rejected: 0, medianMinutes: null, p90Minutes: null, waiting: { count: 0, amount: 0, oldest: [] } },
    };
    stubReports(() => [200, empty]);
    renderWithProviders(<ReportsPage />, '/reports');
    expect(await screen.findByText(/Nothing was collected from/)).toBeInTheDocument();
    expect(screen.getByText('No payments were submitted or decided in this period.')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is waiting/)).toBeInTheDocument();
    expect(screen.getAllByText('No decisions yet')).toHaveLength(2);
  });

  it('offers a retry when the report cannot be loaded', async () => {
    stubReports(() => [500, { error: { message: 'boom' } }]);
    renderWithProviders(<ReportsPage />, '/reports');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the report');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
