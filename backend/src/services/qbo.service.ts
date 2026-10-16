import type { QboToken } from '@prisma/client';
import * as qboTokenModel from '../models/qboToken.model';
import * as paymentModel from '../models/payment.model';
import { OAuthClient, createOAuthClient, API_BASE } from '../config/qbo';
import HttpError from '../utils/HttpError';
import env from '../config/env';

// QuickBooks responses are external, loosely-typed JSON.
/* eslint-disable @typescript-eslint/no-explicit-any */
type QboJson = any;

interface QboRequestOptions {
    method?: 'GET' | 'POST';
    params?: Record<string, string>;
    body?: unknown;
    retry?: boolean;
}

export interface EstimateDto {
    id: string;
    docNumber: string | null;
    customerId?: string;
    customerName?: string;
    totalAmount: number;
    txnDate: string;
    expirationDate: string | null;
    status?: string;
    currency?: string;
    email: string | null;
}

const MINOR_VERSION = 75;
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh if < 5 min left
const ESTIMATE_CACHE_TTL_MS = 60 * 1000;

/* ───────────────────────── OAuth: connect ───────────────────────── */

export function getAuthorizeUrl(state: string) {
    const client = createOAuthClient();
    return client.authorizeUri({
        scope: [OAuthClient.scopes.Accounting],
        state,
    });
}

async function saveTokens(tokenJson: QboJson, realmId: string) {
    const now = Date.now();
    const data = {
        realmId,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        accessTokenExpiresAt: new Date(now + tokenJson.expires_in * 1000),
        refreshTokenExpiresAt: new Date(now + tokenJson.x_refresh_token_expires_in * 1000),
    };
    return qboTokenModel.save(data);
}

// `fullUrl` is the complete callback URL Intuit redirected to (contains code, realmId, state).
export async function handleCallback(fullUrl: string) {
    const realmId = new URL(fullUrl).searchParams.get('realmId');
    if (!realmId) throw new HttpError(400, 'Missing realmId in QuickBooks callback');

    const client = createOAuthClient();
    const authResponse = await client.createToken(fullUrl);
    return saveTokens(authResponse.getJson(), realmId);
}

/* ───────────────────────── OAuth: refresh ───────────────────────── */

let refreshInFlight: Promise<QboToken> | null = null; // de-dupes concurrent refreshes (refresh tokens rotate!)

async function refreshTokens(row: QboToken) {
    try {
        const client = createOAuthClient();
        const authResponse = await client.refreshUsingToken(row.refreshToken);
        return await saveTokens(authResponse.getJson(), row.realmId);
    } catch (err: any) {
        console.error('QBO token refresh failed:', err.originalMessage || err.message);
        throw new HttpError(
            401,
            'QuickBooks connection expired. An admin must reconnect QuickBooks.',
            { code: 'QBO_REAUTH_REQUIRED' }
        );
    }
}

async function getTokenRow({ force = false }: { force?: boolean } = {}): Promise<QboToken> {
    const row = await qboTokenModel.get();
    if (!row) {
        throw new HttpError(409, 'QuickBooks is not connected yet.', { code: 'QBO_NOT_CONNECTED' });
    }
    if (row.refreshTokenExpiresAt <= new Date()) {
        throw new HttpError(
            401,
            'QuickBooks connection expired. An admin must reconnect QuickBooks.',
            { code: 'QBO_REAUTH_REQUIRED' }
        );
    }

    const stillValid = row.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS;
    if (stillValid && !force) return row;

    if (!refreshInFlight) {
        refreshInFlight = refreshTokens(row).finally(() => {
            refreshInFlight = null;
        });
    }
    return refreshInFlight;
}

/* ───────────────────────── Generic API caller ───────────────────────── */
// Phase 4 will reuse this for POST /payment.

export async function qboRequest(
    path: string,
    { method = 'GET', params = {}, body, retry = true }: QboRequestOptions = {}
): Promise<QboJson> {
    const token = await getTokenRow();

    const url = new URL(`${API_BASE}/v3/company/${token.realmId}${path}`);
    url.searchParams.set('minorversion', String(MINOR_VERSION));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    // Token revoked/expired earlier than expected: refresh once and retry.
    if (res.status === 401 && retry) {
        await getTokenRow({ force: true });
        return qboRequest(path, { method, params, body, retry: false });
    }

    const text = await res.text();
    let json: QboJson = null;
    try {
        json = JSON.parse(text);
    } catch {
        /* non-JSON body */
    }

    if (!res.ok) {
        const fault = json && json.Fault && json.Fault.Error && json.Fault.Error[0];
        throw new HttpError(
            502,
            `QuickBooks API error: ${fault ? `${fault.Message} - ${fault.Detail}` : res.statusText}`,
            { intuitTid: res.headers.get('intuit_tid'), fault: json && json.Fault }
        );
    }
    return json;
}

export const runQuery = (sql: string): Promise<QboJson> => qboRequest('/query', { params: { query: sql } });

/* ───────────────────────── Company info (smoke test) ───────────────────────── */

export async function getCompanyInfo() {
    const token = await getTokenRow();
    const json = await qboRequest(`/companyinfo/${token.realmId}`);
    return json.CompanyInfo;
}

export async function getConnectionStatus(): Promise<{
    connected: boolean;
    /** A token exists but its refresh token has expired: an admin must reconnect. */
    needsReauth: boolean;
    realmId?: string;
    accessTokenExpiresAt?: Date;
    refreshTokenExpiresAt?: Date;
    /** Whole days until the connection lapses (0 = today). The refresh token is renewed on use, so this rarely shrinks. */
    expiresInDays?: number;
    lastVerifiedAt?: Date | null;
    companyName?: string;
    verifyError?: string;
}> {
    const row = await qboTokenModel.get();
    if (!row) return { connected: false, needsReauth: false };
    const connected = row.refreshTokenExpiresAt > new Date();
    return {
        connected,
        needsReauth: !connected,
        realmId: row.realmId,
        accessTokenExpiresAt: row.accessTokenExpiresAt,
        refreshTokenExpiresAt: row.refreshTokenExpiresAt,
        expiresInDays: connected ? Math.floor((row.refreshTokenExpiresAt.getTime() - Date.now()) / 86_400_000) : 0,
        lastVerifiedAt: row.lastVerifiedAt,
    };
}

/* ───────────────────────── Estimates ───────────────────────── */

let estimateCache: { at: number; data: EstimateDto[] | null } = { at: 0, data: null };

// Estimates the Sales picker can show. Rejected is excluded. Closed (already converted to an
// invoice) is included so payments can still be submitted after invoicing. Limited to recent
// estimates (ESTIMATE_LOOKBACK_DAYS) so the list stays manageable.
const PICKABLE_STATUSES = new Set(['Pending', 'Accepted', 'Closed']);

async function fetchAllOpenEstimates() {
    const since = new Date(Date.now() - env.ESTIMATE_LOOKBACK_DAYS * 86400000)
        .toISOString()
        .slice(0, 10);
    const pageSize = 500;
    let useDateFilter = true; // falls back to filtering in Node if QBO refuses the query
    let start = 1;
    const all: QboJson[] = [];

    for (; ;) {
        const where = useDateFilter ? `where TxnDate >= '${since}' ` : '';
        let json: QboJson;
        try {
            json = await runQuery(
                `select * from Estimate ${where}ORDERBY TxnDate DESC STARTPOSITION ${start} MAXRESULTS ${pageSize}`
            );
        } catch (err: any) {
            if (useDateFilter && /queryable/i.test(err.message)) {
                useDateFilter = false;
                continue;
            }
            throw err;
        }
        const page = (json.QueryResponse && json.QueryResponse.Estimate) || [];
        all.push(...page);
        if (page.length < pageSize) break;
        start += pageSize;
    }

    return all.filter(
        (e: QboJson) => (!e.TxnStatus || PICKABLE_STATUSES.has(e.TxnStatus)) && String(e.TxnDate) >= since
    );
}

function toEstimateDto(e: QboJson): EstimateDto {
    return {
        id: e.Id,
        docNumber: e.DocNumber || null,
        customerId: e.CustomerRef && e.CustomerRef.value,
        customerName: e.CustomerRef && e.CustomerRef.name,
        totalAmount: e.TotalAmt,
        txnDate: e.TxnDate,
        expirationDate: e.ExpirationDate || null,
        status: e.TxnStatus,
        currency: e.CurrencyRef && e.CurrencyRef.value,
        email: (e.BillEmail && e.BillEmail.Address) || null,
    };
}

// Attach what's already been submitted in the portal so Sales doesn't double-submit.
async function attachPortalTotals(estimates: EstimateDto[]) {
    if (!estimates.length) return estimates;

    const rows = await paymentModel.listActiveForEstimates(estimates.map((e) => e.id));

    const totals: Record<string, { pendingAmount: number; approvedAmount: number }> = {};
    for (const r of rows) {
        const t = (totals[r.qboEstimateId] ||= { pendingAmount: 0, approvedAmount: 0 });
        if (r.status === 'pending') t.pendingAmount += Number(r.amountSubmitted);
        else t.approvedAmount += Number(r.amountSubmitted);
    }

    return estimates.map((e) => ({
        ...e,
        pendingAmount: (totals[e.id] && totals[e.id].pendingAmount) || 0,
        approvedAmount: (totals[e.id] && totals[e.id].approvedAmount) || 0,
    }));
}

async function loadEstimates(forceRefresh: boolean) {
    const fresh = Date.now() - estimateCache.at < ESTIMATE_CACHE_TTL_MS;
    if (!forceRefresh && fresh && estimateCache.data) return estimateCache.data;
    const data = (await fetchAllOpenEstimates()).map(toEstimateDto);
    estimateCache = { at: Date.now(), data };
    return data;
}

/**
 * Open estimates, optionally filtered by `search` (customer name or estimate number) and capped at `limit`.
 * The cap is applied before the portal totals are looked up, so a search-as-you-type call stays cheap.
 * `total` is the number of matches before the cap.
 */
export async function getOpenEstimates({
    search,
    forceRefresh = false,
    limit,
}: { search?: string; forceRefresh?: boolean; limit?: number } = {}) {
    const base = await loadEstimates(forceRefresh);

    let list = base;
    if (search) {
        const q = search.trim().toLowerCase();
        list = base.filter(
            (e) =>
                (e.docNumber || '').toLowerCase().includes(q) ||
                (e.customerName || '').toLowerCase().includes(q)
        );
    }
    const total = list.length;
    if (limit) list = list.slice(0, limit);
    return { total, estimates: await attachPortalTotals(list) };
}

/** Pickable estimates by id, in the order given (ids that are no longer pickable are skipped). */
export async function getEstimatesByIds(ids: string[]) {
    const byId = new Map((await loadEstimates(false)).map((e) => [e.id, e]));
    const found = ids.map((id) => byId.get(id)).filter((e): e is EstimateDto => Boolean(e));
    return attachPortalTotals(found);
}

/* ───────────────────────── Single estimate (used from Phase 3) ───────────────────────── */
// Fetch one estimate by ID (works for any status, including Closed).
// Also returns the IDs of invoices already linked to it.
export async function getEstimateById(id: string) {
    if (!/^\d+$/.test(String(id))) throw new HttpError(400, 'Invalid estimate id');
    try {
        const json = await qboRequest(`/estimate/${id}`);
        const e = json.Estimate;
        const linkedInvoiceIds = (e.LinkedTxn || [])
            .filter((t: QboJson) => t.TxnType === 'Invoice')
            .map((t: QboJson) => t.TxnId as string);
        return { ...toEstimateDto(e), linkedInvoiceIds };
    } catch (err: any) {
        const code =
            err.details &&
            err.details.fault &&
            err.details.fault.Error &&
            err.details.fault.Error[0] &&
            err.details.fault.Error[0].code;
        if (code === '610') throw new HttpError(404, 'Estimate not found in QuickBooks');
        throw err;
    }
}
