import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMe } from '../api/auth';
import type { Role } from '../api/types';
import { ArrowRight, Compass } from 'lucide-react';
import { Button, buttonClass } from '../components/ui/Button';
import { startTour } from '../lib/tour';
import { PageHeader } from '../components/ui/PageHeader';
import { CONTACT_EMAIL } from '../lib/legal';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/**
 * How the portal works, for the person reading it: their own role's guide first, then what everyone needs to know,
 * then answers to the questions people actually ask. Every statement describes what the code does (limits included),
 * so update this page when a rule changes.
 */
/** Each role's guide, its anchor, and the screens it sends people to. */
const ROLE_GUIDE: Record<Role, { id: string; title: string; reader: string; main: { to: string; label: string }; links: { to: string; label: string }[] }> = {
  sales: {
    id: 'submitting',
    title: 'Submitting a payment',
    reader: 'sales reps',
    main: { to: '/payments/new', label: 'Submit a payment' },
    links: [
      { to: '/payments', label: 'My payments' },
      { to: '/estimates', label: 'Estimates' },
      { to: '/customers', label: 'Customers' },
    ],
  },
  admin: {
    id: 'reviewing',
    title: 'Reviewing payments',
    reader: 'admins',
    main: { to: '/payments/review', label: 'Open approvals' },
    links: [
      { to: '/estimates', label: 'Estimates' },
      { to: '/customers', label: 'Customers' },
    ],
  },
  superadmin: {
    id: 'running',
    title: 'Running the portal',
    reader: 'SuperAdmins',
    main: { to: '/settings/team', label: 'Manage the team' },
    links: [
      { to: '/reports', label: 'Reports' },
      { to: '/activity', label: 'Activity' },
    ],
  },
};

/**
 * How the portal works, for the person reading it: their own role's guide first, then what everyone needs to know,
 * then answers to the questions people actually ask. Every statement describes what the code does (limits included),
 * so update this page when a rule changes.
 *
 * Layout: the guides in a reading column (about 70 characters a line), and beside them a sticky rail with the page's
 * sections, the screens this role uses, and who to ask. On a phone the rail comes first, as a short list of shortcuts.
 */
export default function HelpPage() {
  useDocumentTitle('Help');
  const { data: me } = useMe();
  const role: Role = me?.role ?? 'sales';
  const guide = ROLE_GUIDE[role];
  const sections = [
    { id: guide.id, title: guide.title },
    { id: 'everyone', title: 'For everyone' },
    { id: 'questions', title: 'Common questions' },
  ];

  return (
    <div>
      <PageHeader
        title="Help"
        description={`How the portal works for ${guide.reader}, step by step, and answers to common questions.`}
        actions={
          <Link to={guide.main.to} className={buttonClass({ variant: 'primary' })}>
            {guide.main.label} <ArrowRight aria-hidden className="size-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-6">
        <div className="min-w-0 space-y-4">
          {role === 'sales' && <SalesGuide id={guide.id} />}
          {role === 'admin' && <AdminGuide id={guide.id} />}
          {role === 'superadmin' && <SuperAdminGuide id={guide.id} />}
          <EveryoneGuide />
          <Questions role={role} />
        </div>

        {/* On a phone the guide comes first; the shortcuts and the contact follow it. */}
        <aside aria-label="Help shortcuts" className="space-y-4 lg:sticky lg:top-6">
          <nav aria-label="On this page" className="rounded-card border border-border bg-surface p-4 max-lg:hidden">
            <h2 className="mb-2 text-small font-semibold text-text-muted">On this page</h2>
            <ul className="space-y-1">
              {sections.map((sec) => (
                <li key={sec.id}>
                  <a href={`#${sec.id}`} className="block rounded-control px-2 py-1.5 text-text no-underline hover:bg-surface-sunk">
                    {sec.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Go to" className="rounded-card border border-border bg-surface p-4">
            <h2 className="mb-2 text-small font-semibold text-text-muted">Go to</h2>
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {/* The main job is already the title button; these are the other screens this role uses. */}
              {[...guide.links, { to: '/settings/integrations', label: 'Your QuickBooks connection' }].map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="flex min-h-9 items-center justify-between gap-2 rounded-control px-2 py-1.5 text-accent no-underline hover:bg-surface-sunk max-lg:border max-lg:border-border pointer-coarse:min-h-11"
                  >
                    {l.label} <ArrowRight aria-hidden className="size-3.5 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <section aria-label="Product tour" className="rounded-card border border-border bg-surface p-4">
            <h2 className="font-semibold">New here?</h2>
            <p className="mt-1 text-text-muted">A one-minute tour of the screens you will use.</p>
            <Button className="mt-3" onClick={() => startTour()}>
              <Compass aria-hidden className="size-4" /> Take the tour
            </Button>
          </section>
          <section aria-label="Still stuck" className="rounded-card bg-accent-subtle p-4">
            <h2 className="font-semibold">Still stuck?</h2>
            <p className="mt-1 text-text-muted">Write to us and say what you were trying to do.</p>
            <a className="mt-2 inline-block font-semibold break-all text-accent underline" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Help with Digima CRM')}`}>
              {CONTACT_EMAIL}
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ───────────────────────── Building blocks ───────────────────────── */

function Guide({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-label={title} className="scroll-mt-6 rounded-card border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-title font-semibold">{title}</h2>
      {intro && <p className="mt-1 text-text-muted">{intro}</p>}
      <div className="mt-4 space-y-4 text-input leading-relaxed">{children}</div>
    </section>
  );
}

/** A real ordered list: the order matters, so it is shown by the numbers, not by decoration. */
function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2.5 pl-6 marker:font-semibold marker:text-text-muted">{children}</ol>;
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card bg-surface-sunk px-4 py-3">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1">{children}</p>
    </div>
  );
}

const nav = (to: string, label: string) => (
  <Link to={to} className="font-semibold text-accent underline">
    {label}
  </Link>
);

/* ───────────────────────── Guides ───────────────────────── */

function SalesGuide({ id }: { id: string }) {
  return (
    <Guide id={id} title="Submitting a payment" intro="Record each payment a customer makes against their estimate. An admin checks it and posts it to QuickBooks.">
      <Steps>
        <li>Open {nav('/payments/new', 'Submit payment')} and choose the estimate the customer paid. You see its total, what is waiting for review, what is already approved and what is left.</li>
        <li>
          Enter the <strong>amount received</strong>, before any bank fee, and choose where it was paid: BDO, UnionBank, Digima, Happy Med or Cash.
        </li>
        <li>
          Add the <strong>bank reference number</strong> from the receipt when there is one. The same bank and reference number cannot be submitted twice, so it
          catches duplicates.
        </li>
        <li>Enter the date the money was received and who received it.</li>
        <li>Attach a photo or screenshot of the receipt: JPG, PNG or WebP, up to 5 MB.</li>
        <li>
          Submit. Follow it in {nav('/payments', 'My payments')}: a number on the menu shows decisions you have not looked at yet.
        </li>
      </Steps>
      <Note title="Downpayments and balances">
        A customer can pay in parts. Submit each payment against the same estimate when it arrives; each one is reviewed on its own and recorded on the same
        QuickBooks invoice, which stays open until the estimate is fully paid.
      </Note>
      <Note title="If a payment is rejected">
        The admin’s reason is shown in My payments. Fix what it says (usually the amount or the receipt) and submit it again.
      </Note>
    </Guide>
  );
}

function AdminGuide({ id }: { id: string }) {
  return (
    <Guide id={id} title="Reviewing payments" intro="Check each payment against the bank before it reaches QuickBooks.">
      <Steps>
        <li>Open {nav('/payments/review', 'Approvals')}. Payments are listed oldest first; open one to see the receipt beside its details.</li>
        <li>Check the receipt against the bank: the amount, the reference number and the date.</li>
        <li>
          Set the <strong>final amount</strong>: what actually reached the account after any bank or QR fee. The fee button fills in the usual rate. The difference is
          recorded in QuickBooks as a bank fee.
        </li>
        <li>
          <strong>Approve</strong>. The payment is recorded in QuickBooks. For an estimate’s first approved payment, the portal also creates its invoice for the full
          estimate; later payments are recorded on that same invoice, which stays open until it is fully paid.
        </li>
        <li>
          Or <strong>reject</strong> it with a reason the sales rep will see. You have 30 seconds to undo a rejection.
        </li>
      </Steps>
      <Note title="When QuickBooks says no">
        If QuickBooks cannot create the invoice, or the invoice total does not match the estimate (usually because of tax), the approval stops and the payment stays
        waiting. Nothing is recorded. Fix the invoice in QuickBooks, then approve again.
      </Note>
      <Note title="Reversing an approval">
        Open an approved payment from the history and choose Void. It is reversed in QuickBooks and the invoice’s balance goes back up. Give a reason: it is kept
        with the payment.
      </Note>
    </Guide>
  );
}

function SuperAdminGuide({ id }: { id: string }) {
  return (
    <Guide id={id} title="Running the portal" intro="SuperAdmins manage who can sign in and see everything, but do not submit or approve payments.">
      <Steps>
        <li>
          Add people in {nav('/settings/team', 'Team')}: their name, email and role (Sales, Admin or SuperAdmin). Copy the one-time invite link and send it to them;
          it expires after 7 days. They open it and sign in with QuickBooks.
        </li>
        <li>Lost or expired link? Send a new one from the same page. The old link stops working.</li>
        <li>
          Change someone’s role or deactivate them there too. Deactivating also removes their QuickBooks connection. There must always be at least one active
          SuperAdmin.
        </li>
        <li>
          See how money is coming in in {nav('/reports', 'Reports')}: what was collected over a period, by account and by sales rep, and how long payments wait for
          review.
        </li>
        <li>
          See who did what in {nav('/activity', 'Activity')}: every submission, approval, rejection, void, invite, role change and sign-in, with failed attempts
          marked.
        </li>
      </Steps>
    </Guide>
  );
}

function EveryoneGuide() {
  return (
    <Guide id="everyone" title="For everyone">
      <Note title="Signing in">
        Use Sign in with QuickBooks, with the QuickBooks login you work with. The portal never sees your QuickBooks password. You stay signed in for up to 8 hours;
        after that, sign in again and you are taken back to the page you were on.
      </Note>
      <Note title="Your QuickBooks connection">
        Each person connects their own QuickBooks account. A banner at the top says when yours is missing, has expired or is about to; reconnect from{' '}
        {nav('/settings/integrations', 'QuickBooks')} in the menu.
      </Note>
      <Note title="Working offline">
        If the connection drops, a banner says so. You can keep reading the page, but nothing can be loaded or saved until it is back. Keep the tab open and what you
        typed stays.
      </Note>
      <Note title="Tips on every page">
        The first time you open a page, a few tips point out its main controls. Use Tour this page at the top of any page to see them again.
      </Note>
      <Note title="Finding things fast">Press Ctrl+K (⌘K on a Mac) anywhere to search for a customer, an estimate or a page.</Note>
    </Guide>
  );
}

function Questions({ role }: { role: Role }) {
  const items: { q: string; a: ReactNode; roles?: Role[] }[] = [
    {
      q: 'The page says a new version is ready. What happened?',
      a: 'The portal was updated while your tab was open. Reload the page; it takes a second and nothing is lost.',
    },
    {
      q: 'I saw "This page ran into a problem".',
      a: 'Reload the page; that usually fixes it. The error is reported to the team automatically. If it keeps happening, send the details shown under "If it keeps happening" to the contact below.',
    },
    {
      q: 'Why was I told a similar payment is already pending?',
      a: 'A payment with the same estimate, amount and bank was submitted in the last 24 hours and is still waiting. If it really is a second payment, you can submit it anyway.',
      roles: ['sales'],
    },
    {
      q: 'Why does the approval say the amount is more than the invoice can take?',
      a: 'The payment is larger than what is still owed on the invoice. If you approve it, the extra stays in QuickBooks as unapplied credit for the customer.',
      roles: ['admin'],
    },
    {
      q: 'Someone left the company. What do I do?',
      a: 'Deactivate them in Team. They are signed out at once and their QuickBooks connection is removed. Their past payments stay in the history.',
      roles: ['superadmin'],
    },
    {
      q: 'The portal says it is down for maintenance.',
      a: 'It is being updated. The page checks every 30 seconds and comes back by itself; payments already submitted are safe.',
    },
  ];
  return (
    <Guide id="questions" title="Common questions">
      <div className="divide-y divide-border rounded-card border border-border">
        {items
          .filter((i) => !i.roles || i.roles.includes(role))
          .map((i) => (
            <details key={i.q} className="group px-4 py-3">
              <summary className="min-h-6 cursor-pointer font-semibold">{i.q}</summary>
              <p className="mt-2 text-text-muted">{i.a}</p>
            </details>
          ))}
      </div>
    </Guide>
  );
}
