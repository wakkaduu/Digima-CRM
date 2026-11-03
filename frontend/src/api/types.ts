// Shapes returned by the backend API (see backend/src/controllers).

export type Role = 'admin' | 'sales' | 'superadmin';
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'voided';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Can sign in with email and password (and so change it). */
  hasPassword: boolean;
}

/** A row from GET /api/users (SuperAdmin account management). */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  /** Their Intuit login is linked (they accepted an invite). */
  linked: boolean;
  /** A one-time invite link is outstanding; it may have expired (see inviteExpiresAt). */
  invitePending: boolean;
  inviteExpiresAt: string | null;
  createdAt: string;
}

export interface Estimate {
  id: string;
  docNumber: string | null;
  customerId?: string;
  customerName: string;
  totalAmount: number;
  txnDate: string;
  expirationDate: string | null;
  status: string;
  currency?: string;
  email: string | null;
  pendingAmount: number;
  approvedAmount: number;
}

/** A row from GET /api/payments/mine. */
export interface MyPayment {
  id: string;
  customerName: string;
  qboEstimateId: string;
  qboEstimateNumber: string | null;
  amountSubmitted: string;
  finalAmount: string | null;
  bankDepositedTo: string;
  status: PaymentStatus;
  rejectionReason: string | null;
  voidReason?: string | null;
  createdAt: string;
  receivedOn: string | null;
  receivedBy: string | null;
  unseen: boolean;
}

/** A row from GET /api/payments/pending. */
export interface PendingPayment {
  id: string;
  customerName: string;
  qboEstimateId: string;
  qboEstimateNumber: string | null;
  amountSubmitted: string;
  finalAmount: string | null;
  bankDepositedTo: string;
  status: PaymentStatus;
  createdAt: string;
  submittedBy: string;
  referenceNo: string | null;
  receivedOn: string | null;
  receivedBy: string | null;
  submittedById: string | null;
  proofImageUrl: string;
  /** Resized copy of the receipt for list and review views (full size is `proofImageUrl`). */
  thumbUrl: string;
  qboPartiallyPosted: boolean;
}

/** A row from GET /api/payments as an admin sees it (history). */
export interface HistoryPayment extends PendingPayment {
  receivedById: string | null;
  rejectionReason: string | null;
  voidReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface AuditEvent {
  type: 'submitted' | 'approved' | 'rejected' | 'voided';
  at: string;
  by: string | null;
  note?: string | null;
}

/** GET /api/payments/:id (admin view; `qbo` is admin-only). */
export interface PaymentDetail extends HistoryPayment {
  fee: number | null;
  events: AuditEvent[];
  qbo?: {
    paymentId: string | null;
    depositId: string | null;
    /** QuickBooks' internal invoice id; `invoiceNumber` is the one people search for. */
    invoiceId?: string | null;
    invoiceNumber?: string | null;
    /** Opens the invoice in the QuickBooks web app. */
    invoiceUrl?: string | null;
    customerId: string | null;
  };
}

export interface BankOption {
  /** What to send as `bank` when submitting. */
  id: string;
  /** What payments report in `bankDepositedTo`. */
  key: string;
  label: string;
  referenceNumber: 'optional' | 'none';
}

export interface BankConfig {
  banks: BankOption[];
  defaultFeePercent: number;
}

export interface Receiver {
  id: string;
  name: string;
}

export interface ApproveResult {
  qbo: {
    paymentId: string;
    depositId?: string | null;
    /** The invoice the payment was recorded against. */
    invoiceId?: string | null;
    /** The invoice number shown and searchable in QuickBooks (`invoiceId` is QuickBooks' internal id). */
    invoiceNumber?: string | null;
    /** True when this approval created the invoice (the first payment for the estimate). */
    invoiceCreated?: boolean;
    fee: number;
    unappliedCredit: number;
  };
}

export interface QboStatus {
  connected: boolean;
  /** A connection exists but has expired: the user must sign in with QuickBooks again. */
  needsReauth?: boolean;
  realmId?: string;
  companyName?: string;
  verifyError?: string;
  /** Last time Intuit confirmed the connection works. */
  lastVerifiedAt?: string | null;
  refreshTokenExpiresAt?: string;
  expiresInDays?: number;
}

/* ── CRM modules (Customers, Estimates) ── */

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** A row from GET /api/customers (QuickBooks customer plus CRM figures). */
export interface CustomerRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  /** What the customer owes in QuickBooks. */
  balance: number;
  openEstimates: number;
  lastPaymentAt: string | null;
}

export interface CustomerDetail extends CustomerRow {
  paidToDate: number;
  pendingPayments: number;
  outstanding: number;
}

export type EstimateStatus = 'Pending' | 'Accepted' | 'Closed' | 'Rejected';

/** A row from GET /api/estimates. */
export interface EstimateRow {
  id: string;
  docNumber: string | null;
  customerId?: string;
  customerName?: string;
  totalAmount: number;
  txnDate: string;
  expirationDate: string | null;
  status?: EstimateStatus | string;
  email: string | null;
  /** Payments submitted in the portal: waiting for review / already approved. */
  pendingAmount: number;
  approvedAmount: number;
}

export interface EstimateDetail extends EstimateRow {
  lines: { description: string | null; quantity: number | null; amount: number }[];
  memo: string | null;
  linkedInvoiceIds: string[];
}

/** A payment as shown on the Customers / Estimates tabs (admin rows carry a few more fields). */
export type LinkedPayment = Pick<
  HistoryPayment,
  'id' | 'customerName' | 'qboEstimateId' | 'qboEstimateNumber' | 'amountSubmitted' | 'finalAmount' | 'bankDepositedTo' | 'status' | 'createdAt'
> &
  Partial<Pick<HistoryPayment, 'submittedBy'>>;

/** GET /api/estimates/:id/invoices: what QuickBooks says about the invoices made from an estimate. */
export interface InvoiceSummary {
  invoices: { id: string; docNumber: string | null; txnDate: string; dueDate: string | null; total: number; balance: number }[];
  total: number;
  /** Still owed in QuickBooks. */
  balance: number;
  /** Total minus balance (includes payments recorded directly in QuickBooks). */
  paid: number;
}

export type ReportGroup = 'day' | 'week' | 'month';

/** GET /api/reports: money in pesos, waits in minutes, days as YYYY-MM-DD in Manila time. */
export interface Report {
  range: { from: string; to: string; days: number; group: ReportGroup };
  /** The same number of days right before `from`, for the comparison. */
  previous: { from: string; to: string };
  collections: {
    count: number;
    gross: number;
    fees: number;
    net: number;
    /** Approved in the period, then reversed: not counted as collected. */
    voided: number;
    previousCount: number;
    previousNet: number;
    /** One entry per day, week (Monday) or month (1st), oldest first, empty periods included. */
    series: { start: string; count: number; net: number }[];
  };
  banks: { bank: string; count: number; gross: number; fees: number; net: number }[];
  /** Most collected first. `submitted` counts payments sent in the period; the rest count decisions made in it. */
  reps: { id: string | null; name: string; submitted: number; approved: number; rejected: number; waiting: number; collected: number }[];
  turnaround: {
    decided: number;
    rejected: number;
    medianMinutes: number | null;
    p90Minutes: number | null;
    bands: { label: string; count: number }[];
    waiting: {
      count: number;
      amount: number;
      oldest: { id: string; customerName: string; submittedBy: string; amount: number; createdAt: string; waitingMinutes: number }[];
    };
  };
}
