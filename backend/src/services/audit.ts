// The activity log's vocabulary: which actions exist, how each reads as a sentence, and how to record one.
// The sentence is written when the event happens (a snapshot), so the log reads right even after names or amounts change.
import type { Payment, User } from '@prisma/client';
import type { SignInFailure } from './signInDecision';

export const ACTIONS = [
    'payment.submitted',
    'payment.approved',
    'payment.approve_failed',
    'payment.rejected',
    'payment.reject_undone',
    'payment.voided',
    'payment.void_failed',
    'user.invited',
    'user.reinvited',
    'user.updated',
    'auth.signed_in',
    'auth.sign_in_refused',
    'qbo.connected',
    'qbo.disconnected',
] as const;
export type Action = (typeof ACTIONS)[number];

/** The filter tabs of the activity log, by action prefix. */
export const CATEGORIES = { payments: ['payment.'], team: ['user.'], access: ['auth.', 'qbo.'] } as const;
export type Category = keyof typeof CATEGORIES;

export interface Actor {
    id: string | null;
    name: string;
    role: string | null;
}

export interface AuditInput {
    actor: Actor;
    action: Action;
    outcome?: 'ok' | 'failed';
    paymentId?: string | null;
    targetUserId?: string | null;
    summary: string;
    details?: Record<string, unknown>;
}

export const actorOf = (u: Pick<User, 'id' | 'name' | 'role'> | null | undefined): Actor =>
    u ? { id: u.id, name: u.name, role: u.role } : { id: null, name: 'Unknown', role: null };

const ROLE_LABEL: Record<string, string> = { sales: 'Sales', admin: 'Admin', superadmin: 'SuperAdmin' };
const roleLabel = (r: string) => ROLE_LABEL[r] ?? r;

const money = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const peso = (v: { toString(): string } | number | null | undefined) => `₱${money.format(Number(String(v ?? 0)))}`;

/** What an event needs to know about a payment: a stored row, or the values of one being submitted. */
type PaymentFacts = Pick<Payment, 'id' | 'customerName' | 'qboEstimateNumber' | 'qboEstimateId'> & { amountSubmitted: { toString(): string } | number | string };

/** "₱15,000.00 from Cool Cars (estimate #1001)" */
const what = (p: PaymentFacts) => `${peso(p.amountSubmitted)} from ${p.customerName}${p.qboEstimateNumber ? ` (estimate #${p.qboEstimateNumber})` : ''}`;
const paymentDetails = (p: PaymentFacts) => ({ estimateId: p.qboEstimateId, estimateNumber: p.qboEstimateNumber, customerName: p.customerName, amount: Number(String(p.amountSubmitted)) });

/* ── Payments ── */

export const submitted = (actor: Actor, p: PaymentFacts & { bankDepositedTo: string }): AuditInput => ({
    actor,
    action: 'payment.submitted',
    paymentId: p.id,
    summary: `Submitted ${what(p)}`,
    details: { ...paymentDetails(p), bank: p.bankDepositedTo },
});

export const approved = (
    actor: Actor,
    p: PaymentFacts,
    r: { finalAmount: number; invoiceNumber: string | null; invoiceCreated: boolean; qboPaymentId: string | null }
): AuditInput => {
    const invoice = r.invoiceNumber ? (r.invoiceCreated ? `; created invoice #${r.invoiceNumber}` : `; recorded on invoice #${r.invoiceNumber}`) : '';
    const net = Number(String(p.amountSubmitted)) !== r.finalAmount ? `, ${peso(r.finalAmount)} after bank fees` : '';
    return {
        actor,
        action: 'payment.approved',
        paymentId: p.id,
        summary: `Approved ${what(p)}${net}${invoice}`,
        details: { ...paymentDetails(p), finalAmount: r.finalAmount, invoiceNumber: r.invoiceNumber, invoiceCreated: r.invoiceCreated, qboPaymentId: r.qboPaymentId },
    };
};

export const approveFailed = (actor: Actor, p: PaymentFacts, err: { message: string; code?: string }): AuditInput => ({
    actor,
    action: 'payment.approve_failed',
    outcome: 'failed',
    paymentId: p.id,
    summary: `Could not approve ${what(p)}: ${err.message}`,
    details: { ...paymentDetails(p), code: err.code ?? null },
});

export const rejected = (actor: Actor, p: PaymentFacts, reason: string): AuditInput => ({
    actor,
    action: 'payment.rejected',
    paymentId: p.id,
    summary: `Rejected ${what(p)}: “${reason}”`,
    details: { ...paymentDetails(p), reason },
});

export const rejectUndone = (actor: Actor, p: PaymentFacts): AuditInput => ({
    actor,
    action: 'payment.reject_undone',
    paymentId: p.id,
    summary: `Undid the rejection of ${what(p)}; it is back in the queue`,
    details: paymentDetails(p),
});

export const voided = (actor: Actor, p: PaymentFacts, reason: string): AuditInput => ({
    actor,
    action: 'payment.voided',
    paymentId: p.id,
    summary: `Voided ${what(p)} in QuickBooks: “${reason}”`,
    details: { ...paymentDetails(p), reason },
});

export const voidFailed = (actor: Actor, p: PaymentFacts, err: { message: string; code?: string }): AuditInput => ({
    actor,
    action: 'payment.void_failed',
    outcome: 'failed',
    paymentId: p.id,
    summary: `Could not void ${what(p)}: ${err.message}`,
    details: { ...paymentDetails(p), code: err.code ?? null },
});

/* ── Team ── */

type Person = Pick<User, 'id' | 'name' | 'email' | 'role' | 'active'>;

export const invited = (actor: Actor, u: Person): AuditInput => ({
    actor,
    action: 'user.invited',
    targetUserId: u.id,
    summary: `Invited ${u.name} (${u.email}) as ${roleLabel(u.role)}`,
    details: { name: u.name, email: u.email, role: u.role },
});

export const reinvited = (actor: Actor, u: Person): AuditInput => ({
    actor,
    action: 'user.reinvited',
    targetUserId: u.id,
    summary: `Sent a new invite link to ${u.name}`,
    details: { name: u.name, email: u.email },
});

/** Only what changed, in words: "Changed Ana Reyes: role Sales → Admin; deactivated". Null when nothing did. */
export function updated(actor: Actor, before: Person, after: Person): AuditInput | null {
    const changes: string[] = [];
    if (before.name !== after.name) changes.push(`name “${before.name}” → “${after.name}”`);
    if (before.role !== after.role) changes.push(`role ${roleLabel(before.role)} → ${roleLabel(after.role)}`);
    if (before.active !== after.active) changes.push(after.active ? 'reactivated' : 'deactivated');
    if (!changes.length) return null;
    return {
        actor,
        action: 'user.updated',
        targetUserId: after.id,
        summary: `Changed ${before.name}: ${changes.join('; ')}`,
        details: { before: { name: before.name, role: before.role, active: before.active }, after: { name: after.name, role: after.role, active: after.active } },
    };
}

/* ── Access ── */

const REFUSAL: Record<SignInFailure, string> = {
    wrong_company: 'from a QuickBooks company other than ours',
    not_authorized: 'by someone who has not been invited',
    deactivated: 'by a deactivated account',
    invite_invalid: 'with an invite link that was used or expired',
    already_linked: 'with an Intuit login already linked to another account',
    login_mismatch: 'with a different Intuit login than the one linked to the account',
    sign_in_failed: 'because the sign-in could not be completed',
};

export const signedIn = (actor: Actor): AuditInput => ({ actor, action: 'auth.signed_in', summary: 'Signed in with QuickBooks' });

export const signInRefused = (code: SignInFailure): AuditInput => ({
    actor: { id: null, name: 'Unknown visitor', role: null },
    action: 'auth.sign_in_refused',
    outcome: 'failed',
    summary: `A QuickBooks sign-in was refused ${REFUSAL[code] ?? `(${code})`}`,
    details: { code },
});

export const qboConnected = (actor: Actor): AuditInput => ({ actor, action: 'qbo.connected', summary: 'Connected their QuickBooks account' });
export const qboDisconnected = (actor: Actor): AuditInput => ({ actor, action: 'qbo.disconnected', summary: 'Disconnected their QuickBooks account' });
