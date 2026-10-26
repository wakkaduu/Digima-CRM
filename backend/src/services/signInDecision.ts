// What a verified Intuit identity is allowed to do. Pure (no database, no env), so every branch is unit-tested.

/** Why a sign-in was refused. These codes reach the login page as ?error=<code>. */
export type SignInFailure =
    | 'wrong_company'
    | 'not_authorized'
    | 'deactivated'
    | 'invite_invalid'
    | 'already_linked'
    | 'login_mismatch'
    | 'sign_in_failed';

interface Account {
    id: string;
    active: boolean;
}

export type SignInDecision =
    | { action: 'sign_in'; userId: string }
    /** Link this Intuit id to the invited account and use up the link. */
    | { action: 'accept_invite' }
    /** The operator's own Intuit id (SUPERADMIN_QBO_SUB): create or repair the SuperAdmin account. */
    | { action: 'bootstrap' }
    | { action: 'refuse'; reason: SignInFailure };

export function decideSignIn(input: {
    /** Verified Intuit id from the ID token. */
    sub: string;
    /** The account already linked to this Intuit id, if any. */
    linked: Account | null;
    /** A one-time link was opened in this browser before signing in. */
    hasInvite: boolean;
    /** The account that link belongs to (null if the link is unknown or already used). */
    invited: (Account & { inviteExpiresAt: Date | null }) | null;
    bootstrapSub?: string;
    now?: Date;
}): SignInDecision {
    const { sub, linked, hasInvite, invited, bootstrapSub, now = new Date() } = input;

    // The operator's identity always works and can recover a lockout; it is never handed to anyone's invite. If an
    // invite was opened in this browser, say so instead of silently signing in as someone else (the usual cause:
    // Intuit reused the operator's own Intuit session rather than asking the invited person to sign in).
    if (bootstrapSub && sub === bootstrapSub) {
        return hasInvite && invited ? { action: 'refuse', reason: 'already_linked' } : { action: 'bootstrap' };
    }

    if (linked) {
        // Someone else's invite opened with an Intuit login that already belongs to another account.
        if (hasInvite && invited && invited.id !== linked.id) return { action: 'refuse', reason: 'already_linked' };
        return linked.active ? { action: 'sign_in', userId: linked.id } : { action: 'refuse', reason: 'deactivated' };
    }

    if (hasInvite) {
        if (!invited || !invited.inviteExpiresAt || invited.inviteExpiresAt <= now) return { action: 'refuse', reason: 'invite_invalid' };
        if (!invited.active) return { action: 'refuse', reason: 'deactivated' };
        return { action: 'accept_invite' };
    }

    return { action: 'refuse', reason: 'not_authorized' };
}

/**
 * Someone already signed in (by email or QuickBooks) connects their own QuickBooks. The Intuit login must not belong to
 * another account, and must be the same login if this account has already been linked to one.
 */
export function decideConnect(input: {
    sub: string;
    user: Account & { qboSub: string | null };
    /** The account this Intuit id is already linked to, if any. */
    owner: { id: string } | null;
    bootstrapSub?: string;
}): { action: 'connect' } | { action: 'refuse'; reason: SignInFailure } {
    const { sub, user, owner, bootstrapSub } = input;
    if (!user.active) return { action: 'refuse', reason: 'deactivated' };
    if (owner && owner.id !== user.id) return { action: 'refuse', reason: 'already_linked' };
    if (user.qboSub && user.qboSub !== sub) return { action: 'refuse', reason: 'login_mismatch' };
    // The operator's Intuit id belongs to the SuperAdmin account (SUPERADMIN_QBO_SUB), whoever asks first.
    if (bootstrapSub && sub === bootstrapSub && user.qboSub !== sub) return { action: 'refuse', reason: 'already_linked' };
    return { action: 'connect' };
}
