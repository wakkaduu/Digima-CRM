import test from 'node:test';
import assert from 'node:assert/strict';
import HttpError from '../src/utils/HttpError';

// env.ts exits the process when the environment is incomplete, so give it throwaway values before the import.
Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000', DATABASE_URL: 'postgresql://u:p@localhost/db', S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's', QBO_CLIENT_ID: 'c', QBO_CLIENT_SECRET: 's',
    QBO_REDIRECT_URI: 'http://localhost:3000/cb', QBO_REALM_ID: '1', SESSION_SECRET: 'x'.repeat(20),
});

const run = async (err: unknown) => {
    const { errorHandler } = await import('../src/middleware/errorHandler.js');
    let out: any;
    const res: any = { status: () => res, json: (b: unknown) => (out = b) };
    const log = console.error;
    console.error = () => {};
    try {
        errorHandler(err, {} as any, res, () => {});
    } finally {
        console.error = log;
    }
    return out.error;
};

test('errors: the raw QuickBooks fault and Intuit transaction id never reach the browser', async () => {
    const e = await run(new HttpError(502, 'QuickBooks API error: Stale object', { intuitTid: 'abc', fault: { Error: [{ code: '5010' }] } }));
    assert.equal(e.message, 'QuickBooks API error: Stale object');
    assert.equal(e.details, undefined);
});

test('errors: the stable code the UI switches on is kept', async () => {
    const e = await run(new HttpError(409, 'No invoice', { code: 'NO_INVOICE', fault: {} }));
    assert.deepEqual(e.details, { code: 'NO_INVOICE' });
});

test('errors: field-level validation details pass through', async () => {
    const e = await run(new HttpError(400, 'bad', { amount: ['Required'] }));
    assert.deepEqual(e.details, { amount: ['Required'] });
});
