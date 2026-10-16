// Shapes returned by the backend API (see backend/src/controllers).

export type Role = 'admin' | 'sales';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
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
  proofImageUrl: string;
  qboPartiallyPosted: boolean;
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
  realmId?: string;
  companyName?: string;
  verifyError?: string;
}
