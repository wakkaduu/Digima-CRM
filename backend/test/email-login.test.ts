// Pure-logic tests (no database, no Intuit): password rules, password hashing, and who may connect QuickBooks.
import test from 'node:test';
import assert from 'node:assert/strict';

import { changePasswordSchema, inviteSetPasswordSchema, loginSchema, newPasswordSchema } from '../src/validators/auth.validator';
import { hashPassword, verifyPassword } from '../src/services/password';
import { decideConnect } from '../src/services/signInDecision';

test('login: the email is trimmed and lower-cased, and junk is rejected', () => {
    assert.deepEqual(loginSchema.parse({ email: '  Ana@Example.COM ', password: 'x' }), { email: 'ana@example.com', password: 'x' });
    for (const bad of [{ email: 'nope', password: 'x' }, { email: 'a@b.co', password: '' }, { email: 'a@b.co', password: 'x'.repeat(201) }, { email: 'a@b.co' }]) {
        assert.equal(loginSchema.safeParse(bad).success, false, JSON.stringify(bad).slice(0, 50));
    }
});

test('new passwords: 10 to 200 characters', () => {
    assert.equal(newPasswordSchema.safeParse('123456789').success, false);
    assert.ok(newPasswordSchema.safeParse('1234567890').success);
    assert.equal(newPasswordSchema.safeParse('x'.repeat(201)).success, false);
    assert.equal(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'short' }).success, false);
    assert.equal(inviteSetPasswordSchema.safeParse({ token: 't', password: 'short' }).success, false);
});

test('password hashing: verifies the right password only, with a fresh salt each time, and never throws on junk', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    assert.notEqual(a, b);
    assert.ok(a.startsWith('scrypt$'));
    assert.equal(await verifyPassword('correct horse battery', a), true);
    assert.equal(await verifyPassword('correct horse batterz', a), false);
    for (const junk of ['', 'plain', 'scrypt$', 'scrypt$zz$zz', 'bcrypt$a$b']) assert.equal(await verifyPassword('x', junk), false, junk);
});

const mine = { id: 'u1', active: true, qboSub: null as string | null };

test('connect QuickBooks: a free Intuit login links to the signed-in account', () => {
    assert.deepEqual(decideConnect({ sub: 's1', user: mine, owner: null }), { action: 'connect' });
});

test('connect QuickBooks: the same Intuit login again just renews the connection', () => {
    assert.deepEqual(decideConnect({ sub: 's1', user: { ...mine, qboSub: 's1' }, owner: { id: 'u1' } }), { action: 'connect' });
});

test('connect QuickBooks: an Intuit login that belongs to someone else is refused', () => {
    assert.deepEqual(decideConnect({ sub: 's1', user: mine, owner: { id: 'u2' } }), { action: 'refuse', reason: 'already_linked' });
});

test('connect QuickBooks: an account already linked to one Intuit login cannot silently switch to another', () => {
    assert.deepEqual(decideConnect({ sub: 's2', user: { ...mine, qboSub: 's1' }, owner: null }), { action: 'refuse', reason: 'login_mismatch' });
});

test('connect QuickBooks: the operator’s Intuit id (SUPERADMIN_QBO_SUB) cannot be claimed by another account', () => {
    assert.deepEqual(decideConnect({ sub: 'op', user: mine, owner: null, bootstrapSub: 'op' }), { action: 'refuse', reason: 'already_linked' });
    assert.deepEqual(decideConnect({ sub: 'op', user: { ...mine, qboSub: 'op' }, owner: { id: 'u1' }, bootstrapSub: 'op' }), { action: 'connect' });
});

test('connect QuickBooks: a deactivated account cannot connect', () => {
    assert.deepEqual(decideConnect({ sub: 's1', user: { ...mine, active: false }, owner: null }), { action: 'refuse', reason: 'deactivated' });
});
