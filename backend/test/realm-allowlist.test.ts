import test from 'node:test';
import assert from 'node:assert/strict';

// env.ts exits the process when the environment is incomplete, so give it throwaway values before the import.
Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000', DATABASE_URL: 'postgresql://u:p@localhost/db', S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's', QBO_CLIENT_ID: 'c', QBO_CLIENT_SECRET: 's',
    QBO_REDIRECT_URI: 'http://localhost:3000/cb', QBO_REALM_ID: '1', QBO_EXTRA_REALM_IDS: ' 22, 333 ,', SESSION_SECRET: 'x'.repeat(20),
});

test('the main company and each extra development company are allowed, anything else is not', async () => {
    const { isAllowedRealm } = await import('../src/services/qboAuth.service.js');
    for (const id of ['1', '22', '333']) assert.equal(isAllowedRealm(id), true, id);
    for (const id of ['', '2', '223', '1,22']) assert.equal(isAllowedRealm(id), false, id);
});
