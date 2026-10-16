const { prisma } = require('../config/prisma');
const { OAuthClient, createOAuthClient, API_BASE } = require('../config/qbo');
const { HttpError } = require('../middleware/errorHandler');
const env = require('../config/env');

const MINOR_VERSION = 75;
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh if < 5 min left
const ESTIMATE_CACHE_TTL_MS = 60 * 1000;

/* ───────────────────────── OAuth: connect ───────────────────────── */

function getAuthorizeUrl(state) {
    const client = createOAuthClient();
    return client.authorizeUri({
        scope: [OAuthClient.scopes.Accounting],
        state,
    });
}

async function saveTokens(tokenJson, realmId) {
    const now = Date.now();
    const data = {
        realmId,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        accessTokenExpiresAt: new Date(now + tokenJson.expires_in * 1000),
        refreshTokenExpiresAt: new Date(now + tokenJson.x_refresh_token_expires_in * 1000),
    };
    return prisma.qboToken.upsert({
        where: { id: 1 },
        create: { id: 1, ...data },
        update: data,
    });
}

// `fullUrl` is the complete callback URL Intuit redirected to (contains code, realmId, state).
async function handleCallback(fullUrl) {
    const realmId = new URL(fullUrl).searchParams.get('realmId');
    if (!realmId) throw new HttpError(400, 'Missing realmId in QuickBooks callback');

    const client = createOAuthClient();
    const authResponse = await client.createToken(fullUrl);
    return saveTokens(authResponse.getJson(), realmId);
}

/* ───────────────────────── OAuth: refresh ───────────────────────── */

let refreshInFlight = null; // de-dupes concurrent refreshes (refresh tokens rotate!)

async function refreshTokens(row) {
    try {
        const client = createOAuthClient();
        const authResponse = await client.refreshUsingToken(row.refreshToken);
        return await saveTokens(authResponse.getJson(), row.realmId);
    } catch (err) {
        console.error('QBO token refresh failed:', err.originalMessage || err.message);
        throw new HttpError(
            401,
            'QuickBooks connection expired. An admin must reconnect QuickBooks.',
            { code: 'QBO_REAUTH_REQUIRED' }
        );
    }
}

async function getTokenRow({ force = false } = {}) {
    const row = await prisma.qboToken.findUnique({ where: { id: 1 } });
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

async function qboRequest(path, { method = 'GET', params = {}, body, retry = true } = {}) {
    const token = await getTokenRow();

    const url = new URL(`${API_BASE}/v3/company/${token.realmId}${path}`);
    url.searchParams.set('minorversion', MINOR_VERSION);
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
    let json = null;
    try {
        json = JSON.parse(text);
    } catch (_) {
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

const runQuery = (sql) => qboRequest('/query', { params: { query: sql } });

/* ───────────────────────── Company info (smoke test) ───────────────────────── */

async function getCompanyInfo() {
    const token = await getTokenRow();
    const json = await qboRequest(`/companyinfo/${token.realmId}`);
    return json.CompanyInfo;
}

async function getConnectionStatus() {
    const row = await prisma.qboToken.findUnique({ where: { id: 1 } });
    if (!row) return { connected: false };
    return {
        connected: row.refreshTokenExpiresAt > new Date(),
        realmId: row.realmId,
        accessTokenExpiresAt: row.accessTokenExpiresAt,
        refreshTokenExpiresAt: row.refreshTokenExpiresAt,
    };
}

/* ───────────────────────── Estimates ───────────────────────── */

let estimateCache = { at: 0, data: null };

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
    const all = [];

    for (; ;) {
        const where = useDateFilter ? `where TxnDate >= '${since}' ` : '';
        let json;
        try {
            json = await runQuery(
                `select * from Estimate ${where}ORDERBY TxnDate DESC STARTPOSITION ${start} MAXRESULTS ${pageSize}`
            );
        } catch (err) {
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
        (e) => (!e.TxnStatus || PICKABLE_STATUSES.has(e.TxnStatus)) && String(e.TxnDate) >= since
    );
}

function toEstimateDto(e) {
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
async function attachPortalTotals(estimates) {
    if (!estimates.length) return estimates;

    const rows = await prisma.payment.findMany({
        where: {
            qboEstimateId: { in: estimates.map((e) => e.id) },
            status: { in: ['pending', 'approved'] },
        },
        select: { qboEstimateId: true, status: true, amountSubmitted: true, finalAmount: true },
    });

    const totals = {};
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

async function getOpenEstimates({ search, forceRefresh = false } = {}) {
    const fresh = Date.now() - estimateCache.at < ESTIMATE_CACHE_TTL_MS;
    let base;
    if (!forceRefresh && fresh && estimateCache.data) {
        base = estimateCache.data;
    } else {
        base = (await fetchAllOpenEstimates()).map(toEstimateDto);
        estimateCache = { at: Date.now(), data: base };
    }

    let list = base;
    if (search) {
        const q = search.trim().toLowerCase();
        list = base.filter(
            (e) =>
                (e.docNumber || '').toLowerCase().includes(q) ||
                (e.customerName || '').toLowerCase().includes(q)
        );
    }
    return attachPortalTotals(list);
}

/* ───────────────────────── Single estimate (used from Phase 3) ───────────────────────── */
// Fetch one estimate by ID (works for any status, including Closed).
// Also returns the IDs of invoices already linked to it.
async function getEstimateById(id) {
    if (!/^\d+$/.test(String(id))) throw new HttpError(400, 'Invalid estimate id');
    try {
        const json = await qboRequest(`/estimate/${id}`);
        const e = json.Estimate;
        const linkedInvoiceIds = (e.LinkedTxn || [])
            .filter((t) => t.TxnType === 'Invoice')
            .map((t) => t.TxnId);
        return { ...toEstimateDto(e), linkedInvoiceIds };
    } catch (err) {
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

// Fetch one estimate by ID (works for any status, including Closed).
// Also returns the IDs of invoices already linked to it (needed for option (a) in Phase 4).
async function getEstimateById(id) {
    if (!/^\d+$/.test(String(id))) throw new HttpError(400, 'Invalid estimate id');
    try {
        const json = await qboRequest(`/estimate/${id}`);
        const e = json.Estimate;
        const linkedInvoiceIds = (e.LinkedTxn || [])
            .filter((t) => t.TxnType === 'Invoice')
            .map((t) => t.TxnId);
        return { ...toEstimateDto(e), linkedInvoiceIds };
    } catch (err) {
        const code = err.details && err.details.fault && err.details.fault.Error &&
            err.details.fault.Error[0] && err.details.fault.Error[0].code;
        if (code === '610') throw new HttpError(404, 'Estimate not found in QuickBooks');
        throw err;
    }
}

module.exports = {
    getAuthorizeUrl,
    handleCallback,
    getConnectionStatus,
    getCompanyInfo,
    getOpenEstimates,
    getEstimateById,
    qboRequest,
    runQuery,
    getEstimateById,
};