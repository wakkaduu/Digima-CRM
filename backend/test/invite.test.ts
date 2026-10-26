// Pure-logic tests (no database, no Intuit): invite tokens and who may sign in. Run with `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';

import { INVITE_TTL_DAYS, createInvite, hashToken, inviteTokenSchema } from '../src/services/invite.service';
import { decideSignIn } from '../src/services/signInDecision';

const NOW = new Date('2026-10-21T00:00:00Z');
const future = new Date(NOW.getTime() + 86_400_000);
const past = new Date(NOW.getTime() - 1000);
const acct = (id: string, active = true) => ({ id, active });
const invited = (id: string, expires: Date | null, active = true) => ({ id, active, inviteExpiresAt: expires });

test('invite token: random, 43 url-safe characters, stored only as a hash, expires in 7 days', () => {
    const a = createInvite(NOW);
    const b = createInvite(NOW);
    assert.notEqual(a.token, b.token);
    assert.ok(inviteTokenSchema.safeParse(a.token).success);
    assert.equal(a.hash, hashToken(a.token));
    assert.notEqual(a.hash, a.token);
    assert.equal(a.expiresAt.getTime() - NOW.getTime(), INVITE_TTL_DAYS * 86_400_000);
});

test('invite token: anything that is not a well-formed token is rejected before touching the database', () => {
    for (const bad of ['', 'short', 'x'.repeat(44), `${'a'.repeat(42)}!`, undefined, 123]) {
        assert.equal(inviteTokenSchema.safeParse(bad).success, false, String(bad));
    }
});

test('a known Intuit id signs in, with or without an invite link lying around', () => {
    const base = { sub: 's1', now: NOW, linked: acct('u1'), invited: null };
    assert.deepEqual(decideSignIn({ ...base, hasInvite: false }), { action: 'sign_in', userId: 'u1' });
    assert.deepEqual(decideSignIn({ ...base, hasInvite: true }), { action: 'sign_in', userId: 'u1' });
    assert.deepEqual(decideSignIn({ ...base, hasInvite: true, invited: invited('u1', future) }), { action: 'sign_in', userId: 'u1' });
});

test('a deactivated account cannot sign in', () => {
    assert.deepEqual(decideSignIn({ sub: 's1', now: NOW, linked: acct('u1', false), hasInvite: false, invited: null }), { action: 'refuse', reason: 'deactivated' });
});

test('someone else’s invite opened with an Intuit login that already belongs to another account is refused', () => {
    const out = decideSignIn({ sub: 's1', now: NOW, linked: acct('u1'), hasInvite: true, invited: invited('u2', future) });
    assert.deepEqual(out, { action: 'refuse', reason: 'already_linked' });
});

test('a valid invite links a new Intuit id', () => {
    assert.deepEqual(decideSignIn({ sub: 's9', now: NOW, linked: null, hasInvite: true, invited: invited('u2', future) }), { action: 'accept_invite' });
});

test('an unknown, used or expired invite is refused', () => {
    for (const bad of [null, invited('u2', null), invited('u2', past), invited('u2', NOW)]) {
        assert.deepEqual(decideSignIn({ sub: 's9', now: NOW, linked: null, hasInvite: true, invited: bad }), { action: 'refuse', reason: 'invite_invalid' });
    }
});

test('an invite for a deactivated account is refused', () => {
    assert.deepEqual(decideSignIn({ sub: 's9', now: NOW, linked: null, hasInvite: true, invited: invited('u2', future, false) }), { action: 'refuse', reason: 'deactivated' });
});

test('an Intuit id nobody invited is refused', () => {
    assert.deepEqual(decideSignIn({ sub: 's9', now: NOW, linked: null, hasInvite: false, invited: null }), { action: 'refuse', reason: 'not_authorized' });
});

test('the operator’s own Intuit id (SUPERADMIN_QBO_SUB) always bootstraps, even when deactivated', () => {
    const op = { sub: 'op', bootstrapSub: 'op', now: NOW };
    assert.deepEqual(decideSignIn({ ...op, linked: null, hasInvite: false, invited: null }), { action: 'bootstrap' });
    assert.deepEqual(decideSignIn({ ...op, linked: acct('u1', false), hasInvite: false, invited: null }), { action: 'bootstrap' });
});

test('someone’s invite opened with the operator’s own Intuit login is refused, not silently signed in as SuperAdmin', () => {
    const out = decideSignIn({ sub: 'op', bootstrapSub: 'op', now: NOW, linked: null, hasInvite: true, invited: invited('u2', future) });
    assert.deepEqual(out, { action: 'refuse', reason: 'already_linked' });
});

test('with no SUPERADMIN_QBO_SUB set nobody is bootstrapped', () => {
    assert.deepEqual(decideSignIn({ sub: 'op', now: NOW, linked: null, hasInvite: false, invited: null }), { action: 'refuse', reason: 'not_authorized' });
});
