// Pure-logic tests (no database, no Intuit): sign-in redirects, account validators, per-user QuickBooks scope.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';

import { safeNextSchema } from '../src/validators/auth.validator';
import { createUserSchema, updateUserSchema } from '../src/validators/user.validator';
import { dataScope } from '../src/config/roles';
import asyncHandler from '../src/utils/asyncHandler';
import { currentQboUserId } from '../src/utils/requestContext';

test('sign-in return path: same-site paths only', () => {
    for (const ok of ['/', '/customers', '/payments/review/abc?x=1']) assert.ok(safeNextSchema.safeParse(ok).success, ok);
    for (const bad of ['https://evil.example', '//evil.example', 'customers', '/\\evil.example', undefined]) {
        assert.equal(safeNextSchema.safeParse(bad).success, false, String(bad));
    }
});

test('create account: email is normalised, unknown roles refused', () => {
    const ok = createUserSchema.parse({ name: ' Ana ', email: ' Ana@Example.COM ', role: 'sales' });
    assert.deepEqual(ok, { name: 'Ana', email: 'ana@example.com', role: 'sales' });
    assert.equal(createUserSchema.safeParse({ name: 'Ana', email: 'ana@example.com', role: 'owner' }).success, false);
    assert.equal(createUserSchema.safeParse({ name: 'Ana', email: 'nope', role: 'sales' }).success, false);
});

test('update account: partial, never empty, no password or Intuit id', () => {
    assert.deepEqual(updateUserSchema.parse({ active: false }), { active: false });
    assert.equal(updateUserSchema.safeParse({}).success, false);
    assert.deepEqual(updateUserSchema.parse({ role: 'admin', qboSub: 'x', passwordHash: 'x' }), { role: 'admin' });
});

test('payment visibility: only sales are limited to their own rows', () => {
    assert.equal(dataScope('sales'), 'sales');
    assert.equal(dataScope('admin'), 'admin');
    assert.equal(dataScope('superadmin'), 'admin');
});

test('QuickBooks calls run as the signed-in user, across awaits and concurrent requests', async () => {
    const seen: string[] = [];
    const handler = asyncHandler(async (req) => {
        await new Promise((r) => setTimeout(r, Math.random() * 10));
        seen.push(`${req.user.id}:${currentQboUserId()}`);
    });
    const run = (id: string) =>
        handler({ user: { id } } as unknown as Request, {} as Response, (err?: unknown) => assert.ifError(err)) as unknown as Promise<void>;
    await Promise.all(['a', 'b', 'c'].map(run));
    assert.deepEqual(seen.sort(), ['a:a', 'b:b', 'c:c']);
});

test('QuickBooks calls without a signed-in user ask for sign-in instead of using someone else’s token', () => {
    assert.throws(() => currentQboUserId(), (e: any) => e.status === 401 && e.details?.code === 'QBO_REAUTH_REQUIRED');
});
