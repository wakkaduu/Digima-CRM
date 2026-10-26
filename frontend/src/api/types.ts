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
  qbo?: { paymentId: string | null; depositId: string | null; customerId: string | null };
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
  qbo: { paymentId: string; depositId?: string | null; fee: number; unappliedCredit: number };
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
