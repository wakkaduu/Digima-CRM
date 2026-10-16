const $ = (id) => document.getElementById(id);

const peso = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n) || 0);
const bankLabel = (b) => (b === 'HappyMeal' ? 'Happy Meal' : b);
const cents = (v) => Math.round(Number(String(v).replace(/,/g, '')) * 100);

async function api(path, options = {}) {
    const res = await fetch(path, {
        credentials: 'same-origin',
        ...options,
        headers: options.body ? { 'Content-Type': 'application/json' } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error((data.error && data.error.message) || res.statusText);
        err.status = res.status;
        err.code = data.error && data.error.details && data.error.details.code;
        throw err;
    }
    return data;
}

function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
}

function toast(message, type = 'success') {
    const t = $('toast');
    t.textContent = message;
    t.className =
        'rounded px-3 py-2 text-sm ' +
        (type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ───────── Session ───────── */

function showLoggedIn(user) {
    $('loginCard').classList.add('hidden');
    ['userBar', 'refreshBtn', 'count'].forEach((id) => $(id).classList.remove('hidden'));
    $('userName').textContent = user.name;
    loadPending();
}

function showLoggedOut() {
    $('loginCard').classList.remove('hidden');
    ['userBar', 'refreshBtn', 'count'].forEach((id) => $(id).classList.add('hidden'));
    $('list').replaceChildren();
}

$('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('loginError').textContent = '';
    try {
        const { user } = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', name: $('loginName').value, code: $('loginCode').value }),
        });
        showLoggedIn(user);
    } catch (err) {
        $('loginError').textContent = err.message;
    }
});

$('logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    showLoggedOut();
});
$('refreshBtn').addEventListener('click', loadPending);

/* ───────── Pending list ───────── */

async function loadPending() {
    try {
        const { count, payments } = await api('/api/payments/pending');
        $('count').textContent = count ? `${count} awaiting review` : '';
        const list = $('list');
        list.replaceChildren();
        if (!payments.length) {
            list.appendChild(el('p', 'text-slate-500 text-center py-10', 'Nothing pending. All caught up! 🎉'));
            return;
        }
        payments.forEach((p) => list.appendChild(renderCard(p)));
    } catch (err) {
        if (err.status === 401 || err.status === 403) return showLoggedOut();
        toast(err.message, 'error');
    }
}

function renderCard(p) {
    const grossCents = cents(p.amountSubmitted);
    const card = el('article', 'bg-white rounded-xl border shadow-sm p-4 space-y-3');

    // Header
    const head = el('div', 'flex items-start justify-between gap-3');
    const title = el('div');
    title.append(
        el('div', 'font-semibold', p.customerName),
        el('div', 'text-xs text-slate-500', `Estimate #${p.qboEstimateNumber || p.qboEstimateId} · submitted by ${p.submittedBy} · ${new Date(p.createdAt).toLocaleString()}`)
    );
    head.append(title, el('div', 'text-lg font-semibold whitespace-nowrap', peso(p.amountSubmitted)));

    // Body: receipt + details
    const body = el('div', 'flex gap-3');
    const link = el('a', 'shrink-0');
    link.href = p.proofImageUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const img = el('img', 'w-28 h-36 object-cover rounded border');
    img.src = p.proofImageUrl;
    img.alt = 'Receipt';
    img.loading = 'lazy';
    link.appendChild(img);

    const details = el('div', 'text-sm space-y-1');
    details.append(
        el('div', '', `Deposited to: ${bankLabel(p.bankDepositedTo)}`),
        el('div', '', `Reference no.: ${p.referenceNo || '—'}`),
        el('div', 'text-xs text-slate-500', 'Tap the receipt to open it full size.')
    );
    body.append(link, details);

    // Partial-sync notice
    let notice = null;
    if (p.qboPartiallyPosted) {
        notice = el(
            'div',
            'rounded bg-amber-50 text-amber-800 text-sm px-3 py-2',
            'An earlier approval was only partly posted to QuickBooks. Approving again finishes the sync using the same amount.'
        );
    }

    // Final amount + fee
    const amountRow = el('div', 'space-y-1');
    amountRow.appendChild(el('label', 'block text-sm font-medium', 'Final amount (net deposit after bank fees)'));
    const inputRow = el('div', 'flex gap-2');
    const input = el('input', 'flex-1 border rounded px-3 py-2');
    input.inputMode = 'decimal';
    input.value = p.qboPartiallyPosted && p.finalAmount ? Number(p.finalAmount).toFixed(2) : Number(p.amountSubmitted).toFixed(2);
    input.readOnly = p.qboPartiallyPosted;
    const feeBtn = el('button', 'border rounded px-3 py-2 text-sm hover:bg-slate-100', '− 1.5% fee');
    feeBtn.type = 'button';
    feeBtn.disabled = p.qboPartiallyPosted;
    feeBtn.addEventListener('click', () => {
        input.value = ((grossCents - Math.round(grossCents * 0.015)) / 100).toFixed(2);
        updateFee();
    });
    inputRow.append(input, feeBtn);
    const feeText = el('div', 'text-xs text-slate-500');
    amountRow.append(inputRow, feeText);

    function updateFee() {
        const finalC = cents(input.value);
        if (!Number.isFinite(finalC) || finalC <= 0) {
            feeText.textContent = 'Enter a valid amount';
            feeText.className = 'text-xs text-red-600';
        } else if (finalC > grossCents) {
            feeText.textContent = 'Final amount cannot exceed the amount submitted';
            feeText.className = 'text-xs text-red-600';
        } else {
            const fee = grossCents - finalC;
            feeText.textContent = `Bank fee: ${peso(fee / 100)} (${((fee / grossCents) * 100).toFixed(2)}%). Invoice is closed for the full ${peso(grossCents / 100)}.`;
            feeText.className = 'text-xs text-slate-500';
        }
    }
    input.addEventListener('input', updateFee);
    updateFee();

    // Actions
    const actions = el('div', 'flex gap-2 pt-1');
    const approveBtn = el('button', 'flex-1 bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50', 'Approve & post to QuickBooks');
    const rejectBtn = el('button', 'border border-red-300 text-red-700 rounded px-4 py-2 disabled:opacity-50', 'Reject');
    actions.append(approveBtn, rejectBtn);

    const setBusy = (busy) => {
        approveBtn.disabled = busy;
        rejectBtn.disabled = busy;
        approveBtn.textContent = busy ? 'Posting…' : 'Approve & post to QuickBooks';
    };

    approveBtn.addEventListener('click', async () => {
        const finalC = cents(input.value);
        if (!Number.isFinite(finalC) || finalC <= 0 || finalC > grossCents) {
            return toast('Check the final amount first.', 'error');
        }
        const fee = (grossCents - finalC) / 100;
        if (!confirm(`Approve ${p.customerName}?\n\nPaid: ${peso(grossCents / 100)}\nFee: ${peso(fee)}\nNet to ${bankLabel(p.bankDepositedTo)}: ${peso(finalC / 100)}`)) return;

        setBusy(true);
        try {
            const { qbo } = await api(`/api/payments/approve/${p.id}`, {
                method: 'POST',
                body: JSON.stringify({ finalAmount: input.value }),
            });
            let msg = `Approved and posted to QuickBooks (payment #${qbo.paymentId}${qbo.depositId ? `, deposit #${qbo.depositId}` : ''}).`;
            if (qbo.unappliedCredit > 0) msg += ` Note: ${peso(qbo.unappliedCredit)} was more than the invoice balance and remains as unapplied credit in QBO.`;
            toast(msg, 'success');
            card.remove();
            loadPending();
        } catch (err) {
            if (err.status === 401 && err.code === 'QBO_REAUTH_REQUIRED') {
                toast('QuickBooks connection expired. Reconnect it on the QuickBooks setup page.', 'error');
            } else if (err.status === 401 || err.status === 403) {
                return showLoggedOut();
            } else {
                toast(err.message, 'error');
            }
            setBusy(false);
            loadPending(); // pick up any partial-sync state
        }
    });

    rejectBtn.addEventListener('click', async () => {
        const reason = prompt('Reason for rejecting (the sales rep will see this):');
        if (reason === null) return;
        if (reason.trim().length < 3) return toast('Please give a reason (at least 3 characters).', 'error');
        setBusy(true);
        try {
            await api(`/api/payments/reject/${p.id}`, { method: 'POST', body: JSON.stringify({ reason }) });
            toast('Payment rejected.', 'success');
            card.remove();
            loadPending();
        } catch (err) {
            toast(err.message, 'error');
            setBusy(false);
        }
    });

    card.append(head, body);
    if (notice) card.appendChild(notice);
    card.append(amountRow, actions);
    return card;
}

/* ───────── Init ───────── */

api('/api/auth/me').then(({ user }) =>
    user && user.role === 'admin' ? showLoggedIn(user) : showLoggedOut()
);