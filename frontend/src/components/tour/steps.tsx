import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChartColumn,
  CircleHelp,
  ClipboardCheck,
  FileText,
  History,
  LayoutDashboard,
  Plug,
  ReceiptText,
  Search,
  Send,
  Sparkles,
  UserCog,
  Users,
} from 'lucide-react';
import type { Role } from '../../api/types';

export interface TourStep {
  id: string;
  title: string;
  body: ReactNode;
  icon: LucideIcon;
  /**
   * What to point at, best first: `data-tour` values. The first one that is visible on screen is highlighted; when none
   * is (a phone with the item under "More", say), the step is shown as a centred card.
   */
  targets?: string[];
  /** Said when the step points at "More" instead of the item itself (phones). */
  underMore?: string;
}

const SEARCH: TourStep = {
  id: 'search',
  title: 'Find anything fast',
  icon: Search,
  targets: ['search'],
  body: (
    <>
      Search for a customer or an estimate from any page. On a computer, press <kbd className="font-sans font-semibold">Ctrl</kbd>+
      <kbd className="font-sans font-semibold">K</kbd> (<kbd className="font-sans font-semibold">⌘K</kbd> on a Mac).
    </>
  ),
};

const QUICKBOOKS: TourStep = {
  id: 'quickbooks',
  title: 'Your QuickBooks connection',
  icon: Plug,
  targets: ['nav:/settings/integrations', 'nav:more'],
  underMore: 'On a phone, it is under More.',
  body: 'Customers, estimates and payment posting all go through your own QuickBooks connection. A banner at the top tells you if it is missing or about to expire; reconnect here.',
};

const HELP: TourStep = {
  id: 'help',
  title: 'Help is always here',
  icon: CircleHelp,
  targets: ['nav:/help', 'nav:more'],
  underMore: 'On a phone, it is under More.',
  body: 'Step-by-step guides for your role and answers to common questions. You can take this tour again from there any time.',
};

const SALES: TourStep[] = [
  {
    id: 'submit',
    title: 'Submit a payment',
    icon: Send,
    targets: ['nav:/payments/new'],
    body: 'When a customer pays, record it here: pick their estimate, enter the amount and where it was paid, and attach a photo of the receipt. An admin checks it and posts it to QuickBooks.',
  },
  {
    id: 'mine',
    title: 'Follow your payments',
    icon: ReceiptText,
    targets: ['nav:/payments'],
    body: 'See whether each payment was approved or rejected, and why. A number on this item means there are decisions you have not looked at yet.',
  },
  {
    id: 'estimates',
    title: 'Estimates and customers',
    icon: FileText,
    targets: ['nav:/estimates', 'nav:more'],
    underMore: 'On a phone, Estimates is under More.',
    body: 'See what each customer owes: the estimate total, what is already approved and what is left to collect. Downpayments and balances all go against the same estimate.',
  },
  SEARCH,
  QUICKBOOKS,
  HELP,
];

const ADMIN: TourStep[] = [
  {
    id: 'approvals',
    title: 'Approve payments',
    icon: ClipboardCheck,
    targets: ['nav:/payments/review'],
    body: 'Payments waiting for you, oldest first; the number shows how many. Open one to see the receipt beside its details, check it against the bank, then approve or reject it.',
  },
  {
    id: 'posting',
    title: 'QuickBooks is kept in step',
    icon: Sparkles,
    body: 'Approving records the payment in QuickBooks. On an estimate’s first payment the portal also creates its invoice for the full amount; later payments go on that same invoice until it is paid. If QuickBooks refuses, nothing is recorded and you are told why.',
  },
  {
    id: 'estimates',
    title: 'Estimates and customers',
    icon: FileText,
    targets: ['nav:/estimates', 'nav:more'],
    underMore: 'On a phone, Estimates is under More.',
    body: 'Every estimate with what has been paid against it and what is left, and every customer with their balance.',
  },
  SEARCH,
  QUICKBOOKS,
  HELP,
];

const SUPERADMIN: TourStep[] = [
  {
    id: 'overview',
    title: 'Your overview',
    icon: LayoutDashboard,
    targets: ['nav:/dashboard'],
    body: 'How much was approved over the last two weeks, what is waiting for review, and the latest decisions, at a glance.',
  },
  {
    id: 'team',
    title: 'Bring in the team',
    icon: UserCog,
    targets: ['nav:/settings/team', 'nav:more'],
    underMore: 'On a phone, Team is under More.',
    body: 'Add people as Sales, Admin or SuperAdmin and send each one their invite link (it works for 7 days). Change roles or deactivate someone here too.',
  },
  {
    id: 'reports',
    title: 'Reports',
    icon: ChartColumn,
    targets: ['nav:/reports', 'nav:more'],
    underMore: 'On a phone, Reports is under More.',
    body: 'What was collected over any period, by bank account and by sales rep, and how long payments wait for review.',
  },
  {
    id: 'activity',
    title: 'Activity',
    icon: History,
    targets: ['nav:/activity', 'nav:more'],
    underMore: 'On a phone, Activity is under More.',
    body: 'Who did what: every submission, approval, rejection, invite and sign-in, with failed attempts marked.',
  },
  {
    id: 'customers',
    title: 'Customers and estimates',
    icon: Users,
    targets: ['nav:/customers', 'nav:more'],
    underMore: 'On a phone, Customers is under More.',
    body: 'Everything in QuickBooks, with how much of each estimate has been paid through the portal.',
  },
  QUICKBOOKS,
  HELP,
];

export const STEPS: Record<Role, TourStep[]> = { sales: SALES, admin: ADMIN, superadmin: SUPERADMIN };

/** What finishing the tour leads to: the first real thing to do. */
export const FIRST_JOB: Record<Role, { to: string; label: string }> = {
  sales: { to: '/payments/new', label: 'Submit your first payment' },
  admin: { to: '/payments/review', label: 'Open approvals' },
  superadmin: { to: '/settings/team', label: 'Invite your team' },
};

export const ROLE_READER: Record<Role, string> = { sales: 'a sales rep', admin: 'an admin', superadmin: 'a SuperAdmin' };
