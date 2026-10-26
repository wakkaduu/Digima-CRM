import http from 'node:http';
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const users = {
  admin: { id: 'a1', name: 'Ana Admin', email: 'ana@x.co', role: 'admin', mustChangePassword: false },
  superadmin: { id: 'o1', name: 'Olive Owner', email: 'olive@x.co', role: 'superadmin', mustChangePassword: false },
  sales: { id: 's1', name: 'Sam Reyes', email: 'sam@x.co', role: 'sales', mustChangePassword: false },
};
const LONG = 'Extraordinarily Long Customer Name Incorporated of the Philippines and Southeast Asia';
const pend = (i, o = {}) => ({
  id: `p${i}`, customerName: i === 2 ? LONG : ['Marikina Steel', 'Batangas Feeds', 'Gensan Foods', 'Delta LLC', 'Echo Trading', 'Foxtrot Co'][i % 6],
  qboEstimateId: String(100 + i), qboEstimateNumber: String(1000 + i), amountSubmitted: String(1500 * (i + 1)) + '.00', finalAmount: null,
  bankDepositedTo: ['BDO', 'UnionBank', 'Digima', 'HappyMed', 'Cash'][i % 5], status: 'pending', createdAt: hoursAgo(3 + i * 11), submittedBy: ['Sam Reyes', 'Tina Lopez'][i % 2],
  submittedById: ['s1', 's2'][i % 2], referenceNo: i % 5 === 4 ? null : 'REF' + (10000 + i), receivedOn: '2026-10-15', receivedBy: 'Sam Reyes',
  proofImageUrl: `/api/payments/p${i}/receipt`, thumbUrl: `/api/payments/p${i}/receipt?w=800`, qboPartiallyPosted: false, ...o,
});
// The SuperAdmin overview is also inspected by the design tooling, which rejects sample names such as "Acme".
const real = (x) => ({ ...x, customerName: x.customerName.replace('Marikina Steel', 'Marikina Steel') });
const pending = [0, 1, 2, 3, 4, 5].map((i) => pend(i, i === 3 ? { qboPartiallyPosted: true, finalAmount: '5,900.00'.replace(',', '') } : {}));
const mine = Array.from({ length: 30 }, (_, i) => ({
  id: `m${i}`, customerName: i === 2 ? LONG : ['Marikina Steel', 'Batangas Feeds', 'Gensan Foods'][i % 3], qboEstimateId: String(i), qboEstimateNumber: String(2000 + i),
  amountSubmitted: String(900 + i * 250) + '.00', finalAmount: null, bankDepositedTo: ['BDO', 'UnionBank', 'Cash'][i % 3], status: ['pending', 'approved', 'rejected'][i % 3],
  rejectionReason: i % 3 === 2 ? 'Receipt is unclear, please send a sharper screenshot of the whole page.' : null, createdAt: hoursAgo(i * 7 + 1), receivedOn: '2026-10-14', receivedBy: 'Sam Reyes', unseen: i < 3, thumbUrl: '',
}));
const history = Array.from({ length: 12 }, (_, i) => pend(20 + i, { status: i % 4 === 0 ? 'rejected' : 'approved', finalAmount: '1000.00', rejectionReason: i % 4 === 0 ? 'Wrong amount' : null, reviewedBy: 'Ana Admin', reviewedAt: hoursAgo(i + 1), createdAt: hoursAgo(30 + i * 5), receivedById: 's1' }));
const est = (i, n) => ({ id: String(i), docNumber: String(1000 + i), customerName: n, totalAmount: 25000 + i * 1000, txnDate: '2026-10-01', expirationDate: null, status: 'Accepted', email: null, pendingAmount: 1000, approvedAmount: 2000 });
const estimates = [est(1, 'Marikina Steel'), est(2, LONG), est(3, 'Marikina Holdings'), est(4, 'Batangas Feeds')];
const customers = Array.from({ length: 40 }, (_, i) => ({ id: String(50 + i), name: i === 1 ? LONG : ['Marikina Steel', 'Batangas Feeds', 'Gensan Foods', 'Davao Cold Chain'][i % 4] + (i > 3 ? ` ${i}` : ''), company: null, email: i % 3 ? `ap${i}@example.test` : null, phone: i % 2 ? '0917 123 4567' : null, active: i % 7 !== 6, balance: i * 1250, openEstimates: i % 4, lastPaymentAt: i % 5 ? hoursAgo(i * 9) : null }));
const allEstimates = Array.from({ length: 30 }, (_, i) => ({ ...est(i + 1, i === 1 ? LONG : customers[i % 4].name), customerId: customers[i % 4].id, status: ['Pending', 'Accepted', 'Closed', 'Rejected'][i % 4] }));
const banks = { banks: ['BDO', 'UnionBank', 'Digima', 'Happy Med', 'Cash'].map((l) => ({ id: l, key: l.replace(' ', ''), label: l, referenceNumber: l === 'Cash' ? 'none' : 'optional' })), defaultFeePercent: 1.5 };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#fff"/><rect x="20" y="20" width="560" height="860" fill="none" stroke="#888"/><text x="40" y="80" font-size="32" font-family="sans-serif">BANK TRANSFER RECEIPT</text><text x="40" y="140" font-size="24" font-family="sans-serif">PHP 2,500.00  Ref 12345678</text></svg>`;

const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); const p = url.pathname; const role = /role=(admin|sales|superadmin)/.exec(req.headers.cookie || '')?.[1] ?? process.env.MOCK_ROLE;
  const user = role && users[role];
  const delay = Number(/delay=(\d+)/.exec(req.headers.cookie || '')?.[1] || 0);
  const go = () => {
    if (p === '/api/auth/me') return send(res, 200, { user: user ?? null });
    if (p === '/api/auth/login') return send(res, 200, { user: users.sales });
    if (!user) return send(res, 401, { error: { message: 'Please log in first' } });
    if (p === '/api/payments/counts') return send(res, 200, role === 'admin' ? { pending: pending.length } : { unseen: 3 });
    if (p === '/api/payments/pending') return send(res, 200, { count: pending.length, payments: pending });
    if (p === '/api/payments/mine') return send(res, 200, { payments: mine, unseenCount: 3 });
    if (p === '/api/users') return send(res, 200, { users: [{ id: 'o1', name: 'Olive Owner', email: 'olive@x.co', role: 'superadmin', active: true, linked: true, invitePending: false, inviteExpiresAt: null, createdAt: hoursAgo(900) }, { id: 'a1', name: 'Ana Admin', email: 'ana@x.co', role: 'admin', active: true, linked: true, invitePending: false, inviteExpiresAt: null, createdAt: hoursAgo(800) }, { id: 's1', name: 'Sam Reyes', email: 'sam@x.co', role: 'sales', active: true, linked: true, invitePending: false, inviteExpiresAt: null, createdAt: hoursAgo(700) }, { id: 's2', name: 'Tina Lopez', email: 'tina@x.co', role: 'sales', active: true, linked: false, invitePending: true, inviteExpiresAt: hoursAgo(-40), createdAt: hoursAgo(20) }] });
    if (p === '/api/payments' && url.searchParams.get('status') === 'pending') return send(res, 200, { items: [...pending].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(real), total: pending.length, page: 1, pageSize: 100 });
    if (p === '/api/payments' && role === 'superadmin') { const days = [0, 0, 1, 2, 2, 3, 4, 5, 5, 6, 8, 9, 9, 10, 11, 12]; const items = days.map((d, i) => pend(40 + i, { status: i % 9 === 4 ? 'rejected' : 'approved', amountSubmitted: String(1800 + ((i * 3170) % 9200)) + '.00', finalAmount: String(1750 + ((i * 3170) % 9200)) + '.00', bankDepositedTo: ['BDO', 'BDO', 'UnionBank', 'Digima', 'BDO', 'HappyMed', 'Cash'][i % 7], reviewedBy: 'Ana Admin', reviewedAt: hoursAgo(d * 24 + (i % 5) * 2 + 1), createdAt: hoursAgo(d * 24 + 30) })); return send(res, 200, { items: items.map(real), total: items.length, page: 1, pageSize: 100 }); }
    if (p === '/api/payments' ) return send(res, 200, { items: history, total: 40, page: 1, pageSize: 25 });
    if (p === '/api/payments/receivers') return send(res, 200, { receivers: [{ id: 's1', name: 'Sam Reyes' }, { id: 's2', name: 'Tina Lopez' }] });
    if (p === '/api/payments/recent-estimates') return send(res, 200, { estimates: estimates.slice(0, 2) });
    if (p === '/api/config/banks') return send(res, 200, banks);
    if (p === '/api/qbo/estimates') { const q = (url.searchParams.get('q') || '').toLowerCase(); const l = Number(url.searchParams.get('limit') || 99); const r = estimates.filter((e) => !q || e.customerName.toLowerCase().includes(q) || e.docNumber.includes(q)); return send(res, 200, { count: Math.min(l, r.length), total: r.length, estimates: r.slice(0, l) }); }
    if (p === '/api/customers') { const q = (url.searchParams.get('q') || '').toLowerCase(); const st = url.searchParams.get('status'); const r = customers.filter((c) => (!q || c.name.toLowerCase().includes(q)) && (!st || c.active === (st === 'active'))); const size = Number(url.searchParams.get('pageSize') || 25), pg = Number(url.searchParams.get('page') || 1); return send(res, 200, { items: r.slice((pg - 1) * size, pg * size), total: r.length, page: pg, pageSize: size, counts: { all: customers.length, active: customers.filter((c) => c.active).length, inactive: customers.filter((c) => !c.active).length } }); }
    const cm = /^\/api\/customers\/(\d+)$/.exec(p);
    if (cm) { const c = customers.find((x) => x.id === cm[1]); return c ? send(res, 200, { customer: { ...c, paidToDate: 42000, pendingPayments: 1, outstanding: c.balance }, lookbackDays: 90 }) : send(res, 404, { error: { message: 'Customer not found in QuickBooks' } }); }
    if (p === '/api/estimates') { const q = (url.searchParams.get('q') || '').toLowerCase(); const st = url.searchParams.get('status'); const cid = url.searchParams.get('customerId'); const r = allEstimates.filter((e) => (!q || e.customerName.toLowerCase().includes(q) || e.docNumber.includes(q)) && (!st || e.status === st) && (!cid || e.customerId === cid)); const size = Number(url.searchParams.get('pageSize') || 25), pg = Number(url.searchParams.get('page') || 1); return send(res, 200, { items: r.slice((pg - 1) * size, pg * size), total: r.length, page: pg, pageSize: size, lookbackDays: 90, counts: { all: allEstimates.length, Pending: 8, Accepted: 8, Closed: 7, Rejected: 7 } }); }
    const em = /^\/api\/estimates\/(\d+)$/.exec(p);
    if (em) { const e = allEstimates.find((x) => x.id === em[1]); return e ? send(res, 200, { estimate: { ...e, lines: [{ description: 'Installation of 12 units', quantity: 12, amount: 18000 }, { description: 'Delivery', quantity: 1, amount: 7000 }], memo: 'Thank you for your business.', linkedInvoiceIds: [] } }) : send(res, 404, { error: { message: 'Estimate not found in QuickBooks' } }); }
    if (p === '/api/auth/qbo/status') return send(res, 200, { connected: true, needsReauth: false, realmId: '9130', companyName: 'Digima Inc', lastVerifiedAt: hoursAgo(1), refreshTokenExpiresAt: new Date(Date.now() + 98 * 864e5).toISOString(), expiresInDays: 98 });
    if (/^\/api\/payments\/[^/]+\/receipt$/.test(p)) return send(res, 200, svg, 'image/svg+xml');
    if (p === '/api/payments/submit' && req.method === 'POST') { req.resume(); return req.on('end', () => send(res, 201, { payment: { id: 'new', status: 'pending' } })); }
    const m = /^\/api\/payments\/([^/]+)$/.exec(p);
    if (m && req.method === 'GET') { const row = [...history, ...pending].find((x) => x.id === m[1]); return row ? send(res, 200, { payment: { ...row, fee: 13.5, events: [{ type: 'submitted', at: row.createdAt, by: row.submittedBy }, ...(row.status !== 'pending' ? [{ type: row.status, at: row.reviewedAt, by: 'Ana Admin', note: row.rejectionReason }] : [])], qbo: { paymentId: '77', depositId: '78', customerId: '5' } } }) : send(res, 404, { error: { message: 'Payment not found' } }); }
    send(res, 404, { error: { message: 'no mock for ' + req.method + ' ' + p } });
  };
  delay ? setTimeout(go, delay) : go();
}).listen(Number(process.env.PORT) || 3100, () => console.log('mock api on', Number(process.env.PORT) || 3100));
