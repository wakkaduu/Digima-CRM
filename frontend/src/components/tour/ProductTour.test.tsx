import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '../../api/types';
import { closeTour, startTour } from '../../lib/tour';
import { mockApi, renderWithProviders } from '../../test/renderWithProviders';
import { ProductTour } from './ProductTour';
import { STEPS } from './steps';

const ann = (over: Partial<User> = {}): User => ({ id: 'u1', name: 'Ann Cruz', email: 'a@b.co', role: 'sales', hasPassword: false, tourDone: false, ...over });
const tourPosts = (fn: ReturnType<typeof mockApi>) =>
  fn.mock.calls.filter(([url]) => String(url) === '/api/auth/tour').map(([, init]) => JSON.parse(String(init?.body)));

afterEach(() => {
  act(() => closeTour());
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe('product tour', () => {
  it('opens by itself right after signing in, once per sign-in, and again at the next sign-in', async () => {
    mockApi({ 'POST /api/auth/tour': [200, { ok: true }] });
    const first = renderWithProviders(<ProductTour user={ann({ signedInAt: 1000 })} />);
    const dialog = await screen.findByRole('dialog', { name: 'Welcome, Ann' }, { timeout: 2000 });
    expect(dialog).toHaveTextContent(`${STEPS.sales.length} stops`);
    first.unmount();
    act(() => closeTour());

    // Same sign-in (another page load, or a second tab): not offered again.
    const again = renderWithProviders(<ProductTour user={ann({ signedInAt: 1000 })} />);
    await new Promise((r) => setTimeout(r, 1100));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    again.unmount();

    // Signed out and in again, even in the same tab: a new sign-in, so it is offered again.
    renderWithProviders(<ProductTour user={ann({ signedInAt: 2000 })} />);
    expect(await screen.findByRole('dialog', { name: 'Welcome, Ann' }, { timeout: 2000 })).toBeInTheDocument();
    expect(Object.keys(localStorage).filter((k) => k.startsWith('digima.tour.offered.u1.'))).toEqual(['digima.tour.offered.u1.2000.main']);
  });

  it('never opens by itself once done, or when the server did not say', async () => {
    renderWithProviders(<ProductTour user={ann({ tourDone: true })} />);
    renderWithProviders(<ProductTour user={ann({ id: 'u2', tourDone: undefined })} />);
    await new Promise((r) => setTimeout(r, 1100));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Not now" without ticking the box saves nothing, so it comes back at the next sign-in', async () => {
    const fetchMock = mockApi({ 'POST /api/auth/tour': [200, { ok: true }] });
    renderWithProviders(<ProductTour user={ann()} />);
    act(() => startTour());
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tourPosts(fetchMock)).toEqual([]);
    expect(await screen.findByText(/will open again next time you sign in/)).toBeInTheDocument();
  });

  it('"Don’t show this tour again" is saved on the account, from any step', async () => {
    const fetchMock = mockApi({ 'POST /api/auth/tour': [200, { ok: true }] });
    renderWithProviders(<ProductTour user={ann()} />);
    act(() => startTour());
    await userEvent.click(await screen.findByRole('button', { name: /Start the tour/ }));
    await userEvent.click(screen.getByLabelText('Don’t show this tour again'));
    await userEvent.click(screen.getByRole('button', { name: 'Close the tour' }));
    await waitFor(() => expect(tourPosts(fetchMock)).toEqual([{ outcome: 'dismissed' }]));
    expect(await screen.findByText(/will not open by itself again/)).toBeInTheDocument();
  });

  it('clicking Next to the end walks every stop, then finishing saves it', async () => {
    const fetchMock = mockApi({ 'POST /api/auth/tour': [200, { ok: true }] });
    renderWithProviders(<ProductTour user={ann()} />);
    act(() => startTour());
    await userEvent.click(await screen.findByRole('button', { name: /Start the tour/ }));
    for (const [i, step] of STEPS.sales.entries()) {
      const dialog = screen.getByRole('dialog', { name: step.title });
      expect(within(dialog).getByRole('img', { name: `${i + 1} of ${STEPS.sales.length}` })).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: /Next/ }));
    }
    const end = screen.getByRole('dialog', { name: 'You are all set' });
    expect(within(end).getByRole('button', { name: /Submit your first payment/ })).toBeInTheDocument();
    await userEvent.click(within(end).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(tourPosts(fetchMock)).toEqual([{ outcome: 'finished' }]));
  });

  it('works from the keyboard: arrows move, Escape leaves', async () => {
    mockApi({ 'POST /api/auth/tour': [200, { ok: true }] });
    renderWithProviders(<ProductTour user={ann({ role: 'admin' })} />);
    act(() => startTour());
    await screen.findByRole('dialog', { name: 'Welcome, Ann' });
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog', { name: STEPS.admin[0]!.title })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('dialog', { name: 'Welcome, Ann' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('points at the real menu item when it is on screen, and says where it is on a phone', async () => {
    mockApi({ 'POST /api/auth/tour': [200, { ok: true }] });
    // jsdom has no layout: give the "More" button a box so the tour can point at it.
    const more = document.createElement('button');
    more.setAttribute('data-tour', 'nav:more');
    more.getClientRects = () => [{}] as unknown as DOMRectList;
    more.getBoundingClientRect = () => ({ top: 700, left: 300, width: 60, height: 50, bottom: 750, right: 360, x: 300, y: 700, toJSON: () => ({}) });
    document.body.append(more);

    renderWithProviders(<ProductTour user={ann()} />);
    act(() => startTour());
    await userEvent.click(await screen.findByRole('button', { name: /Start the tour/ }));
    // Submit and My payments are not on screen here; Estimates falls back to "More".
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('dialog', { name: 'Estimates and customers' })).toHaveTextContent('On a phone, Estimates is under More.');
    more.remove();
  });

  it('a replay for someone who already finished it has no "don’t show again" box and saves nothing', async () => {
    const fetchMock = mockApi({});
    renderWithProviders(<ProductTour user={ann({ tourDone: true })} />);
    act(() => startTour());
    await screen.findByRole('dialog', { name: 'Welcome, Ann' });
    expect(screen.queryByLabelText('Don’t show this tour again')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(tourPosts(fetchMock)).toEqual([]);
  });
});

describe('where the tour card goes', () => {
  const W = 368;
  const H = 260;
  it('beside a sidebar link, above a tab bar item, below a top bar button, never off screen', async () => {
    const { placeCard } = await import('./ProductTour');
    const sidebar = placeCard({ top: 260, left: 8, width: 216, height: 40 }, W, H, 1440, 900);
    expect(sidebar.left).toBe(8 + 216 + 14); // to its right
    const tab = placeCard({ top: 960, left: 150, width: 160, height: 56 }, W, H, 768, 1024);
    expect(tab.top + H).toBeLessThanOrEqual(960); // fully above the tab bar
    const search = placeCard({ top: 10, left: 260, width: 450, height: 36 }, W, H, 1440, 900);
    expect(search.top).toBe(10 + 36 + 14); // below it
    const phoneW = 390 - 32; // the card is min(23rem, 100vw - 2rem) wide
    const corner = placeCard({ top: 980, left: 340, width: 50, height: 40 }, phoneW, H, 390, 1040);
    expect(corner.left).toBeGreaterThanOrEqual(12);
    expect(corner.left + phoneW).toBeLessThanOrEqual(390 - 12); // clamped inside a phone screen
  });
});

describe('page tours', () => {
  const sales = (over: Partial<User> = {}) => ann({ tourDone: true, pageToursOff: false, tourPagesDone: [], signedInAt: 5000, ...over });
  /** The Submit payment page's controls, as the tour finds them by their markers. */
  function SubmitMarkers({ summary = true }: { summary?: boolean }) {
    return (
      <div>
        {['estimate', 'bank', 'receipt', 'received', 'send', ...(summary ? ['summary'] : [])].map((t) => (
          <div key={t} data-tour={`p:submit.${t}`} ref={(el) => {
            if (el) el.getClientRects = () => [{}] as unknown as DOMRectList; // jsdom has no layout: say it is on screen
          }}>
            {t}
          </div>
        ))}
      </div>
    );
  }

  it('opens the first time a page is visited, once its controls are on screen, and finishing saves that page', async () => {
    const fetchMock = mockApi({ 'POST /api/auth/tour': [200, { ok: true }] });
    renderWithProviders(
      <>
        <SubmitMarkers />
        <ProductTour user={sales()} />
      </>,
      '/payments/new',
    );
    const dialog = await screen.findByRole('dialog', { name: 'Pick the estimate' }, { timeout: 2000 });
    expect(dialog).toHaveTextContent('Tips for Submit payment');
    expect(within(dialog).queryByRole('button', { name: /Back/ })).not.toBeInTheDocument(); // nothing before the first tip
    for (let i = 0; i < 5; i++) await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(tourPosts(fetchMock)).toEqual([{ outcome: 'finished', page: 'submit' }]));
  });

  it('leaves out a tip whose control is not on screen (the summary panel on a phone)', async () => {
    mockApi({});
    renderWithProviders(
      <>
        <SubmitMarkers summary={false} />
        <ProductTour user={sales()} />
      </>,
      '/payments/new',
    );
    const dialog = await screen.findByRole('dialog', { name: 'Pick the estimate' }, { timeout: 2000 });
    expect(within(dialog).getByRole('img', { name: '1 of 5' })).toBeInTheDocument();
  });

  it('"Don’t show page tours again" turns them all off', async () => {
    const fetchMock = mockApi({ 'POST /api/auth/tour': [200, { ok: true }] });
    renderWithProviders(
      <>
        <SubmitMarkers />
        <ProductTour user={sales()} />
      </>,
      '/payments/new',
    );
    await screen.findByRole('dialog', { name: 'Pick the estimate' }, { timeout: 2000 });
    await userEvent.click(screen.getByLabelText('Don’t show page tours again'));
    await userEvent.click(screen.getByRole('button', { name: 'Close the tips' }));
    await waitFor(() => expect(tourPosts(fetchMock)).toEqual([{ outcome: 'dismissed', page: 'submit' }]));
    expect(await screen.findByText(/Page tours are off/)).toBeInTheDocument();
  });

  it('does not open when page tours are off, the page is done, or the welcome tour has not been offered yet', async () => {
    mockApi({});
    for (const user of [sales({ pageToursOff: true }), sales({ id: 'u2', tourPagesDone: ['submit'] }), sales({ id: 'u3', tourDone: false })]) {
      const r = renderWithProviders(
        <>
          <SubmitMarkers />
          <ProductTour user={user} />
        </>,
        '/payments/new',
      );
      await new Promise((res) => setTimeout(res, 700));
      expect(screen.queryByRole('dialog', { name: 'Pick the estimate' })).not.toBeInTheDocument();
      r.unmount();
      act(() => closeTour());
    }
  });

  it('"Tour this page" replays a page tour any time', async () => {
    mockApi({});
    const { PageTourButton } = await import('./PageTourButton');
    renderWithProviders(
      <>
        <SubmitMarkers />
        <PageTourButton />
        <ProductTour user={sales({ tourPagesDone: ['submit'] })} />
      </>,
      '/payments/new',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tour this page' }));
    expect(await screen.findByRole('dialog', { name: 'Pick the estimate' })).toBeInTheDocument();
  });

  it('knows which page tour belongs to each address', async () => {
    const { pageForPath } = await import('./pageTours');
    expect(pageForPath('/payments')).toBe('my-payments');
    expect(pageForPath('/payments/new')).toBe('submit');
    expect(pageForPath('/payments/review')).toBe('approvals');
    expect(pageForPath('/payments/review/abc')).toBe('review');
    expect(pageForPath('/estimates/160')).toBe('estimate');
    expect(pageForPath('/help')).toBeNull();
  });
});
