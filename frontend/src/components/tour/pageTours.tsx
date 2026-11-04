import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  ChartColumn,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Filter,
  Gauge,
  History,
  Landmark,
  ListChecks,
  Plug,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  Timer,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { Role } from '../../api/types';
import type { TourStep } from './steps';

/**
 * A page tour: a few tips the first time someone opens a page, each pointing at one of its controls (`data-tour="p:…"`
 * markers on the page). `roles` limits a step to the people who see that control. A step marked `optional` is left
 * out when its control is not on screen (a desktop-only panel on a phone); the others fall back to a centred card.
 */
export interface PageStep extends TourStep {
  roles?: Role[];
  optional?: boolean;
}

export interface PageTour {
  /** "Tips for <name>" in the card. */
  name: string;
  steps: PageStep[];
}

const step = (id: string, icon: LucideIcon, title: string, target: string, body: string, extra: Partial<PageStep> = {}): PageStep => ({
  id,
  icon,
  title,
  targets: [target],
  body,
  ...extra,
});

/** Ids must match TOUR_PAGES in the backend (controllers/auth.controller.ts). */
export const PAGE_TOURS: Record<string, PageTour> = {
  dashboard: {
    name: 'your dashboard',
    steps: [
      // Sales
      step('s-figures', Gauge, 'Your numbers at a glance', 'p:dashboard.figures', 'What you have posted, what is waiting for review, what was rejected, and your open estimates. Each one opens the matching list.', { roles: ['sales'] }),
      step('s-recent', ReceiptText, 'Recent payments', 'p:dashboard.recent', 'Your latest submissions and where each one stands. Approved means it is recorded in QuickBooks.', { roles: ['sales'] }),
      step('s-collect', Wallet, 'Left to collect', 'p:dashboard.collect', 'Estimates that still have money owed, and how much is paid so far. Open one to record its next payment.', { roles: ['sales'] }),
      // Admin
      step('a-tiles', Gauge, 'The queue at a glance', 'p:dashboard.tiles', 'How many payments are waiting, how long the oldest has waited, and your open estimates and active customers.', { roles: ['admin'] }),
      step('a-queue', ClipboardCheck, 'Needs your review', 'p:dashboard.queue', 'The oldest payments first. Open the queue to check each receipt and approve or reject it.', { roles: ['admin'] }),
      step('a-qbo', Plug, 'Your QuickBooks connection', 'p:dashboard.qbo', 'Approvals post to QuickBooks through your own connection. When it is close to expiring, renew it here so approvals keep working.', { roles: ['admin'] }),
      // SuperAdmin
      step('x-approved', ChartColumn, 'Money approved', 'p:dashboard.approved', 'What the admins approved each day over the last two weeks.', { roles: ['superadmin'] }),
      step('x-waiting', Timer, 'Waiting for review', 'p:dashboard.waiting', 'What the admins still have to check, oldest first. Approving stays with them.', { roles: ['superadmin'] }),
      step('x-strip', Gauge, 'Everything else at a glance', 'p:dashboard.strip', 'Decisions made and how many were rejected, open estimates, active customers and the team.', { roles: ['superadmin'] }),
      step('x-team', UserCog, 'Manage the team', 'p:dashboard.team', 'Invite people and choose what each one can do.', { roles: ['superadmin'] }),
    ],
  },

  submit: {
    name: 'Submit payment',
    steps: [
      step('estimate', FileText, 'Pick the estimate', 'p:submit.estimate', 'Search by customer or estimate number. Once picked, you see its total, what is waiting for review, what is approved and what is left.'),
      step('bank', Landmark, 'Where the money went', 'p:submit.bank', 'Choose the bank or account it was paid into, or Cash. Add the bank reference number from the receipt when there is one: the same reference cannot be submitted twice.'),
      step('receipt', ReceiptText, 'Attach the receipt', 'p:submit.receipt', 'A photo or screenshot of the bank receipt: JPG, PNG or WebP, up to 5 MB. The admin checks it against the bank.'),
      step('received', CalendarDays, 'When and by whom', 'p:submit.received', 'It assumes you received it today. Choose Change if it came in on another day or someone else received it.'),
      step('summary', ListChecks, 'Check before you send', 'p:submit.summary', 'The amount, what will be left to collect after this payment, and what is still missing before you can submit.', { optional: true }),
      step('send', Send, 'Submit for approval', 'p:submit.send', 'An admin checks it, then it is recorded in QuickBooks. You will see the result in My payments.'),
    ],
  },

  'my-payments': {
    name: 'My payments',
    steps: [
      step('figures', Wallet, 'Your totals', 'p:my-payments.figures', 'How much of what you submitted is waiting for review, approved and rejected.'),
      step('filters', Filter, 'Find a payment', 'p:my-payments.filters', 'Filter by status, search by customer or estimate, or by where it was paid.'),
      step('list', ReceiptText, 'Every payment you sent', 'p:my-payments.list', 'Open one for its details and receipt. New results are marked until you have seen them, and a rejected payment shows the reason.'),
    ],
  },

  approvals: {
    name: 'Approvals',
    steps: [
      step('filters', Filter, 'Pending, needs attention, history', 'p:approvals.filters', 'Pending is the queue. Needs attention lists payments only partly posted to QuickBooks, to finish. History is everything already decided. Search or filter by rep, bank or outcome.'),
      step('list', ClipboardCheck, 'Oldest first', 'p:approvals.list', 'Open a payment to see its receipt beside its details, then approve or reject it.'),
    ],
  },

  review: {
    name: 'reviewing a payment',
    steps: [
      step('receipt', ReceiptText, 'Check the receipt', 'p:review.receipt', 'Zoom in and rotate it to read the amount, reference number and date, and compare them with the bank.'),
      step('amount', Banknote, 'The final amount', 'p:review.amount', 'What actually reached the account. If the bank or QR took a fee, the fee button takes the usual rate off; the difference is recorded in QuickBooks as a bank fee.'),
      step('decide', CircleCheck, 'Approve or reject', 'p:review.decide', 'Approve records it in QuickBooks, and creates the estimate’s invoice on its first payment. Reject asks for a reason the sales rep will see; you can undo it for 30 seconds.'),
    ],
  },

  customers: {
    name: 'Customers',
    steps: [
      step('filters', Search, 'Find a customer', 'p:customers.filters', 'Search by name, and switch between active and inactive customers.'),
      step('results', Users, 'Every customer in QuickBooks', 'p:customers.results', 'With what they owe and their last payment. Open one for their estimates and payments.'),
    ],
  },

  customer: {
    name: 'a customer',
    steps: [
      step('tabs', ListChecks, 'Overview, estimates, payments', 'p:customer.tabs', 'Switch between their summary, every estimate, and every payment recorded through the portal.'),
      step('figures', Wallet, 'At a glance', 'p:customer.figures', 'Their open estimates, what they have paid to date and what is still outstanding in QuickBooks.', { optional: true }),
    ],
  },

  estimates: {
    name: 'Estimates',
    steps: [
      step('filters', Filter, 'Find an estimate', 'p:estimates.filters', 'Filter by status (pending, accepted, closed, rejected) or search by customer or estimate number.'),
      step('results', FileText, 'How much is left on each', 'p:estimates.results', 'Every estimate with how much is still to collect. Open one for its details and its payments.'),
    ],
  },

  estimate: {
    name: 'an estimate',
    steps: [
      step('record', Send, 'Record a payment', 'p:estimate.record', 'Starts a payment already linked to this estimate.', { roles: ['sales'], optional: true }),
      step('progress', Gauge, 'Payment progress', 'p:estimate.progress', 'How much of the estimate is approved, waiting for review, and left to collect.'),
      step('invoice', BadgeCheck, 'The QuickBooks invoice', 'p:estimate.invoice', 'What QuickBooks says is still owed on this estimate’s invoice. The invoice is created when its first payment is approved.'),
      step('payments', ReceiptText, 'Payments on this estimate', 'p:estimate.payments', 'Every payment submitted against it, and where each one stands.'),
    ],
  },

  quickbooks: {
    name: 'your QuickBooks connection',
    steps: [
      step('status', ShieldCheck, 'Is it working?', 'p:quickbooks.status', 'Whether your connection works, which company it is for, and when it expires.'),
      step('connect', Plug, 'Connect or renew', 'p:quickbooks.connect', 'Opens Intuit to connect, or to renew before it expires. The portal never sees your QuickBooks password.'),
      step('test', CircleCheck, 'Try it', 'p:quickbooks.test', 'Runs a quick test against QuickBooks to confirm everything works.', { optional: true }),
    ],
  },

  team: {
    name: 'Team',
    steps: [
      step('add', UserPlus, 'Add people', 'p:team.add', 'Add one person, or several at once. Each gets a one-time invite link to send them; it works for 7 days.'),
      step('list', Users, 'Everyone with access', 'p:team.list', 'Change someone’s role, send a new invite link, or deactivate them. There must always be at least one active SuperAdmin.'),
      step('roles', ShieldCheck, 'What each role can do', 'p:team.roles', 'Sales submit payments, admins approve them, SuperAdmins manage the team and see everything.', { optional: true }),
    ],
  },

  reports: {
    name: 'Reports',
    steps: [
      step('range', CalendarDays, 'Pick a period', 'p:reports.range', 'The last 7, 30 or 90 days, a month, this year, or your own dates; and whether the bars show days, weeks or months.'),
      step('collected', ChartColumn, 'What came in', 'p:reports.collected', 'Net collected after bank fees, compared with the period just before.'),
      step('accounts', Landmark, 'Where it landed', 'p:reports.accounts', 'How much went to each bank account, and its share of the total.'),
      step('reps', Users, 'By sales rep', 'p:reports.reps', 'What each rep submitted, how much was approved or rejected, and what they collected.'),
    ],
  },

  activity: {
    name: 'Activity',
    steps: [
      step('tabs', History, 'What kind of activity', 'p:activity.tabs', 'Payments, team changes, or sign-ins and QuickBooks connections.'),
      step('filters', Filter, 'One person, or only failures', 'p:activity.filters', 'See what one person did, or only the attempts that failed, such as an approval QuickBooks refused.'),
      step('list', ListChecks, 'Newest first', 'p:activity.list', 'Every action with who did it and when. Failed attempts are marked, and payment events link to their estimate.'),
    ],
  },
};

/** Which page tour belongs to a path, if any. */
export function pageForPath(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/dashboard') return 'dashboard';
  if (p === '/payments/new') return 'submit';
  if (p === '/payments') return 'my-payments';
  if (p === '/payments/review') return 'approvals';
  if (p.startsWith('/payments/review/')) return 'review';
  if (p === '/customers') return 'customers';
  if (p.startsWith('/customers/')) return 'customer';
  if (p === '/estimates') return 'estimates';
  if (p.startsWith('/estimates/')) return 'estimate';
  if (p === '/settings/integrations') return 'quickbooks';
  if (p === '/settings/team') return 'team';
  if (p === '/reports') return 'reports';
  if (p === '/activity') return 'activity';
  return null;
}

const shown = (target: string) => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  return !!el && el.getClientRects().length > 0;
};

/** The steps of a page's tour for this role, without optional steps whose control is not on screen. */
export function pageSteps(page: string, role: Role): PageStep[] {
  return (PAGE_TOURS[page]?.steps ?? []).filter((s) => (!s.roles || s.roles.includes(role)) && (!s.optional || (s.targets ?? []).some(shown)));
}
