import type { User } from '@prisma/client';
import env from '../config/env';
import { OAuthClient, createOAuthClient } from '../config/qbo';
import * as userModel from '../models/user.model';
import { saveTokens } from './qbo.service';
import { decideConnect, decideSignIn, type SignInFailure } from './signInDecision';

export type { SignInFailure };

/* eslint-disable @typescript-eslint/no-explicit-any */

// "Sign in with QuickBooks": one Intuit authorization gives us who the person is (the verified OpenID `sub`)
// and a QuickBooks token of their own. Accounts are linked to an Intuit id by accepting a one-time invite link
// (see invite.service.ts) or by connecting while signed in by email; the Intuit email is never used, because the
// production app does not receive it.

export function getAuthorizeUrl(state: string) {
    return createOAuthClient().authorizeUri({
        // Only what is used: OpenID for the verified Intuit id, Accounting for the user's own QuickBooks access.
        scope: [OAuthClient.scopes.OpenId, OAuthClient.scopes.Accounting],
        state,
    });
}

export class SignInError extends Error {
    constructor(public code: SignInFailure, message = code) {
        super(message);
    }
}

/** The portal's company, plus any extra development sandboxes (QBO_EXTRA_REALM_IDS; always empty in production). */
export const isAllowedRealm = (realmId: string) => realmId === env.QBO_REALM_ID || env.QBO_EXTRA_REALM_IDS.includes(realmId);

type CallbackParams ={ code: string; state: string; realmId: string };

/** The part both sign-in and connect share: exchange the code, verify the signed ID token, check the company. */
async function verifyAuthorization(params: CallbackParams): Promise<{ tokens: any; sub: string; realmId: string }> {
    // The query string is browser-supplied, so this is only an early exit; the company in the signed ID token decides below.
    if (!isAllowedRealm(params.realmId)) {
        // Company ids are not secrets; seeing both makes "wrong company" easy to explain.
        console.warn(`QBO sign-in refused: the callback is for company ${params.realmId}, this portal serves ${env.QBO_REALM_ID} (QBO_REALM_ID).`);
        throw new SignInError('wrong_company');
    }
    // Rebuilt from the three validated values (see callbackParamsSchema) instead of passing the raw request URL on.
    const fullUrl = `${env.QBO_REDIRECT_URI}?${new URLSearchParams({ code: params.code, state: params.state, realmId: params.realmId })}`;

    const client = createOAuthClient();
    let tokens: any;
    let profile: any;
    let step = 'exchanging the code for tokens';
    try {
        tokens = (await client.createToken(fullUrl)).getJson();
        // Who signed in comes from the signed ID token Intuit just issued (openid scope): the library checks its
        // issuer, audience, expiry and RSA signature against Intuit's published keys.
        step = 'verifying the Intuit ID token';
        if (!tokens.id_token) throw new Error('Intuit issued no id_token (is the openid scope enabled for this app?)');
        if (!(await client.validateIdToken())) throw new Error('The Intuit ID token did not verify');
        profile = JSON.parse(Buffer.from(String(tokens.id_token).split('.')[1], 'base64url').toString('utf8'));
    } catch (err: any) {
        // Tokens and personal data are never logged: only what Intuit said went wrong.
        const res = err.authResponse?.response;
        console.error(`QBO sign-in failed while ${step}:`, {
            status: res?.status ?? err.authResponse?.status,
            error: err.error || undefined,
            description: err.error_description || undefined,
            body: typeof err.authResponse?.body === 'string' ? err.authResponse.body.slice(0, 300) : undefined,
            message: err.originalMessage || err.message || undefined,
            intuit_tid: err.intuit_tid || undefined,
            // Intuit only issues an id_token when the openid scope was actually granted to the app.
            idTokenIssued: tokens ? Boolean(tokens.id_token) : undefined,
        });
        throw new SignInError('sign_in_failed');
    }

    const sub = String(profile?.sub ?? '');
    if (!sub) {
        // Names only, never values.
        console.error('QBO sign-in failed: the ID token has no sub. Claims present:', Object.keys(profile ?? {}).join(', ') || '(none)');
        throw new SignInError('sign_in_failed');
    }

    // The company the person actually authorised, from the signed token. The realmId in the URL could have been edited by
    // someone who authorised a different company, so it must not be what keeps outsiders out.
    const realmId = String(profile?.realmid ?? '');
    if (!isAllowedRealm(realmId) || realmId !== params.realmId) {
        console.warn(`QBO sign-in refused: the ID token says company ${profile?.realmid ?? '(none)'} but the callback said ${params.realmId}; this portal serves ${env.QBO_REALM_ID}.`);
        throw new SignInError('wrong_company');
    }
    return { tokens, sub, realmId };
}

/** Completes the OAuth redirect: verifies the Intuit identity, applies the invite if any, stores their QuickBooks tokens. */
export async function signIn(params: CallbackParams, inviteHash?: string | null): Promise<User> {
    const { tokens, sub, realmId } = await verifyAuthorization(params);

    const decision = decideSignIn({
        sub,
        linked: await userModel.findByQboSub(sub),
        hasInvite: Boolean(inviteHash),
        invited: inviteHash ? await userModel.findByInviteHash(inviteHash) : null,
        bootstrapSub: env.SUPERADMIN_QBO_SUB,
    });

    // One line per sign-in so "why did I land in that account?" can be answered from the log. The Intuit id is not a secret.
    console.info(
        `QBO sign-in: intuitId=${sub} invite=${inviteHash ? 'yes' : 'no'} decision=${decision.action}${decision.action === 'refuse' ? `(${decision.reason})` : ''}`,
    );

    let user: User | null = null;
    switch (decision.action) {
        case 'refuse':
            // Not a secret, and the operator needs it once to set SUPERADMIN_QBO_SUB.
            if (decision.reason === 'not_authorized') console.warn(`QBO sign-in refused: unknown Intuit id ${sub}`);
            throw new SignInError(decision.reason);
        case 'sign_in':
            user = await userModel.findById(decision.userId);
            break;
        case 'accept_invite':
            try {
                user = await userModel.linkWithInvite(inviteHash!, sub);
            } catch (err: any) {
                if (err.code === 'P2002') throw new SignInError('already_linked'); // another account got this Intuit id first
                throw err;
            }
            if (!user) throw new SignInError('invite_invalid'); // used or expired while we were checking
            break;
        case 'bootstrap':
            user = await bootstrapSuperadmin(sub);
            break;
    }
    if (!user) throw new SignInError('sign_in_failed');

    await saveTokens(user.id, tokens, realmId);
    return user;
}

/**
 * "Connect QuickBooks" for someone who is already signed in (typically by email and password): attaches their own
 * QuickBooks connection to their account, and links their Intuit login to it the first time.
 */
export async function connect(params: CallbackParams, userId: string): Promise<User> {
    const { tokens, sub, realmId } = await verifyAuthorization(params);
    const user = await userModel.findById(userId);
    if (!user) throw new SignInError('sign_in_failed');

    const decision = decideConnect({ sub, user, owner: await userModel.findByQboSub(sub), bootstrapSub: env.SUPERADMIN_QBO_SUB });
    console.info(`QBO connect: user=${userId} intuitId=${sub} decision=${decision.action}${decision.action === 'refuse' ? `(${decision.reason})` : ''}`);
    if (decision.action === 'refuse') throw new SignInError(decision.reason);

    let linked = user;
    if (!user.qboSub) {
        try {
            linked = await userModel.update(user.id, { qboSub: sub });
        } catch (err: any) {
            if (err.code === 'P2002') throw new SignInError('already_linked'); // someone linked this Intuit login a moment ago
            throw err;
        }
    }
    await saveTokens(linked.id, tokens, realmId);
    return linked;
}

/** SUPERADMIN_QBO_SUB: finds or creates the SuperAdmin account (labelled with SUPERADMIN_EMAIL) and makes sure it is usable. */
async function bootstrapSuperadmin(sub: string): Promise<User> {
    const existing = (await userModel.findByQboSub(sub)) ?? (env.SUPERADMIN_EMAIL ? await userModel.findByEmail(env.SUPERADMIN_EMAIL) : null);
    if (existing) return userModel.update(existing.id, { qboSub: sub, role: 'superadmin', active: true });
    return userModel.create({ name: 'SuperAdmin', email: env.SUPERADMIN_EMAIL!, role: 'superadmin', qboSub: sub });
}
