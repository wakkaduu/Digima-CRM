// Pure-logic tests (no database): encrypting stored QuickBooks tokens, and the sign-in callback parameters.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

import { decrypt, encrypt, parseKey } from '../src/utils/secretBox';
import { callbackParamsSchema } from '../src/validators/auth.validator';

const key = crypto.randomBytes(32);

test('secret box: round-trips, and stored values do not contain the secret', () => {
    const sealed = encrypt('refresh-token-123', key);
    assert.ok(sealed.startsWith('enc:v1:'));
    assert.ok(!sealed.includes('refresh-token-123'));
    assert.equal(decrypt(sealed, key), 'refresh-token-123');
    assert.notEqual(encrypt('same', key), encrypt('same', key)); // fresh IV every time
});

test('secret box: tampering, a wrong key or a missing key never yields plaintext', () => {
    const sealed = encrypt('secret', key);
    const flipped = sealed.slice(0, -2) + (sealed.endsWith('AA') ? 'BB' : 'AA');
    assert.throws(() => decrypt(flipped, key));
    assert.throws(() => decrypt(sealed, crypto.randomBytes(32)));
    assert.throws(() => decrypt(sealed, null));
    assert.throws(() => decrypt('enc:v1:garbage', key));
});

test('secret box: without a key nothing changes, and tokens saved before encryption was enabled still read', () => {
    assert.equal(encrypt('plain', null), 'plain');
    assert.equal(decrypt('plain', null), 'plain');
    assert.equal(decrypt('plain', key), 'plain');
});

test('secret box: the key must be exactly 32 bytes', () => {
    assert.equal(parseKey(undefined), null);
    assert.equal(parseKey(key.toString('base64'))!.length, 32);
    assert.throws(() => parseKey(Buffer.from('short').toString('base64')));
});

test('callback parameters: real Intuit values pass, anything crafted is refused before it reaches the OAuth library', () => {
    const ok = { code: 'XAB11792577165LP5A1E3G1toIvDuQzMDtoMlt9LnCpp2qfeFU', state: '343d53eec568b443bf118e9a862c8386', realmId: '9341458480632046' };
    assert.ok(callbackParamsSchema.safeParse(ok).success);
    for (const bad of [
        { ...ok, code: '%'.repeat(5000) },
        { ...ok, code: 'a%E0%A4%A' },
        { ...ok, state: 'x y' },
        { ...ok, realmId: '12ab' },
        { ...ok, code: ['a', 'b'] },
        { ...ok, state: { $ne: 1 } },
        { code: ok.code, state: ok.state },
    ]) {
        assert.equal(callbackParamsSchema.safeParse(bad).success, false, JSON.stringify(bad).slice(0, 60));
    }
});
