import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoiceBody, createInvoiceFromEstimate, findTotalMismatch, isPortalInvoice } from '../src/services/qboInvoice';
import type { QboRequest } from '../src/services/qboVoid';

/* eslint-disable @typescript-eslint/no-explicit-any */

const estimate = {
    Id: '77',
    CustomerRef: { value: '5', name: 'Acme' },
    CurrencyRef: { value: 'PHP' },
    GlobalTaxCalculation: 'TaxExcluded',
    CustomerMemo: { value: 'Thanks' },
    BillEmail: { Address: 'acme@example.com' },
    SalesTermRef: { value: '3' },
    TotalAmt: 212,
    TxnTaxDetail: { TxnTaxCodeRef: { value: 'TAX' }, TotalTax: 12, TaxLine: [{ Amount: 12 }] },
    Line: [
        { Id: '1', LineNum: 1, Amount: 100, DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { ItemRef: { value: '9' }, Qty: 1 } },
        { Amount: 100, DetailType: 'SubTotalLineDetail', SubTotalLineDetail: {} },
    ],
};

test('invoice body copies the estimate, links it, and sends no email or terms', () => {
    const body: any = buildInvoiceBody(estimate);
    assert.deepEqual(body.CustomerRef, estimate.CustomerRef);
    assert.deepEqual(body.LinkedTxn, [{ TxnId: '77', TxnType: 'Estimate' }]);
    assert.equal(body.GlobalTaxCalculation, 'TaxExcluded');
    // The whole tax block: with only the code, QuickBooks priced the invoice without the estimate's tax.
    assert.deepEqual(body.TxnTaxDetail, estimate.TxnTaxDetail);
    assert.equal(body.BillEmail, undefined);
    assert.equal(body.SalesTermRef, undefined);
});

test('invoice body drops the subtotal row and line ids', () => {
    const body: any = buildInvoiceBody(estimate);
    assert.equal(body.Line.length, 1);
    assert.equal(body.Line[0].DetailType, 'SalesItemLineDetail');
    assert.equal(body.Line[0].Id, undefined);
    assert.equal(body.Line[0].LineNum, 1);
});

test('creating reads the estimate then posts one invoice with a stable requestid', async () => {
    const calls: { path: string; method?: string; params?: Record<string, string> }[] = [];
    const request: QboRequest = async (path, opts) => {
        calls.push({ path, method: opts?.method, params: opts?.params });
        return path.startsWith('/estimate') ? { Estimate: estimate } : { Invoice: { Id: '900', DocNumber: '1038', TotalAmt: 212, Balance: 212 } };
    };

    const { invoice, matchesEstimate } = await createInvoiceFromEstimate(request, '77');

    assert.equal(invoice.DocNumber, '1038');
    assert.equal(matchesEstimate, true);
    // Read back after posting: the answer to a requestid can be a replay.
    assert.deepEqual(calls.map((c) => `${c.method ?? 'GET'} ${c.path}`), ['GET /estimate/77', 'POST /invoice', 'GET /invoice/900']);
    assert.equal(calls[1].params?.requestid, 'inv-77');
});

test('an estimate with no lines is not invoiced', async () => {
    const request: QboRequest = async () => ({ Estimate: { Id: '1', Line: [] } });
    await assert.rejects(() => createInvoiceFromEstimate(request, '1'), /no lines/);
});

test('an invoice QuickBooks priced differently from the estimate is flagged', async () => {
    // What happened in the sandbox: a 32,400 estimate (30,000 + tax) became a 30,000 invoice.
    const request: QboRequest = async (path) =>
        path.startsWith('/estimate') ? { Estimate: { ...estimate, TotalAmt: 32400 } } : { Invoice: { Id: '900', TotalAmt: 30000 } };
    const { matchesEstimate, estimateTotal } = await createInvoiceFromEstimate(request, '77');
    assert.equal(matchesEstimate, false);
    assert.equal(estimateTotal, 32400);
});

const gone = () => Object.assign(new Error('QuickBooks API error'), { details: { fault: { Error: [{ code: '610' }] } } });

test('a replayed answer for a deleted invoice is detected and a real invoice is created', async () => {
    // The first invoice for this estimate was deleted in QuickBooks; the same requestid still returns it.
    const posts: string[] = [];
    const request: QboRequest = async (path, opts) => {
        if (path.startsWith('/estimate')) return { Estimate: estimate };
        if (opts?.method === 'POST') {
            posts.push(opts.params!.requestid);
            return { Invoice: posts.length === 1 ? { Id: '900', DocNumber: '1038', TotalAmt: 212 } : { Id: '901', DocNumber: '1042', TotalAmt: 212 } };
        }
        if (path === '/invoice/900') throw gone();
        return { Invoice: { Id: '901', DocNumber: '1042', TotalAmt: 212, Balance: 212 } };
    };

    const { invoice, matchesEstimate } = await createInvoiceFromEstimate(request, '77');

    assert.equal(invoice.DocNumber, '1042');
    assert.equal(matchesEstimate, true);
    assert.equal(posts.length, 2);
    assert.equal(posts[0], 'inv-77');
    assert.match(posts[1], /^inv-77-\d+$/);
});

test('the total check uses the invoice as it is now, not the replayed first answer', async () => {
    // Replay says 30,000; the invoice was since corrected to match the 32,400 estimate.
    const request: QboRequest = async (path, opts) => {
        if (path.startsWith('/estimate')) return { Estimate: { ...estimate, TotalAmt: 32400 } };
        if (opts?.method === 'POST') return { Invoice: { Id: '900', TotalAmt: 30000 } };
        return { Invoice: { Id: '900', TotalAmt: 32400, Balance: 32400 } };
    };
    const { matchesEstimate } = await createInvoiceFromEstimate(request, '77');
    assert.equal(matchesEstimate, true);
});

test('an error other than "not found" while reading back is not swallowed', async () => {
    const request: QboRequest = async (path, opts) => {
        if (path.startsWith('/estimate')) return { Estimate: estimate };
        if (opts?.method === 'POST') return { Invoice: { Id: '900', TotalAmt: 212 } };
        throw Object.assign(new Error('QuickBooks API error'), { details: { fault: { Error: [{ code: '500' }] } } });
    };
    await assert.rejects(() => createInvoiceFromEstimate(request, '77'), /QuickBooks API error/);
});

// Estimate #1006 from the sandbox: a rate picked under the subtotal, the item line left non-taxable.
const taxedAsAWhole = {
    Id: '160',
    DocNumber: '1006',
    CustomerRef: { value: '5' },
    TotalAmt: 43200,
    TxnTaxDetail: { TxnTaxCodeRef: { value: '7' }, TotalTax: 3200, TaxLine: [{ Amount: 3200 }] },
    Line: [
        { Id: '1', Amount: 40000, DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { ItemRef: { value: '9' }, TaxCodeRef: { value: 'NON' } } },
        { Amount: 40000, DetailType: 'SubTotalLineDetail', SubTotalLineDetail: {} },
    ],
};
const lineTax = (body: any) => body.Line.map((l: any) => l.SalesItemLineDetail?.TaxCodeRef?.value);

test('an estimate taxed as a whole gets taxable lines, so the invoice carries the same tax', () => {
    const body: any = buildInvoiceBody(taxedAsAWhole);
    assert.deepEqual(lineTax(body), ['TAX']);
    assert.deepEqual(body.TxnTaxDetail.TxnTaxCodeRef, { value: '7' });
});

test('lines a person already marked taxable or not are copied as they are', () => {
    const mixed = {
        ...taxedAsAWhole,
        Line: [
            { Amount: 30000, DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { TaxCodeRef: { value: 'TAX' } } },
            { Amount: 10000, DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { TaxCodeRef: { value: 'NON' } } },
        ],
    };
    assert.deepEqual(lineTax(buildInvoiceBody(mixed)), ['TAX', 'NON']);
});

test('an estimate without tax keeps non-taxable lines', () => {
    const noTax = { ...taxedAsAWhole, TotalAmt: 40000, TxnTaxDetail: { TotalTax: 0 } };
    assert.deepEqual(lineTax(buildInvoiceBody(noTax)), ['NON']);
    assert.deepEqual(lineTax(buildInvoiceBody({ ...taxedAsAWhole, TxnTaxDetail: undefined })), ['NON']);
});

test('the invoice is marked as the portal\'s, keeping the estimate\'s own note', () => {
    const body: any = buildInvoiceBody({ ...taxedAsAWhole, PrivateNote: 'Rush job' });
    assert.equal(body.PrivateNote, 'Created by the payment portal from estimate #1006.\nRush job');
    assert.equal(isPortalInvoice(body), true);
    assert.equal(isPortalInvoice({ PrivateNote: 'Made by hand' }), false);
});

test('a reused portal invoice that does not match the estimate is caught; a hand-made one is not', () => {
    const portal = { DocNumber: '1043', TotalAmt: 40000, PrivateNote: 'Created by the payment portal from estimate #1006.' };
    const byHand = { DocNumber: '1044', TotalAmt: 40000, PrivateNote: '' };
    assert.equal(findTotalMismatch([portal], 43200), portal);
    assert.equal(findTotalMismatch([byHand], 43200), null);
    assert.equal(findTotalMismatch([{ ...portal, TotalAmt: 43200 }], 43200), null);
});
