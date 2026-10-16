const $ = (id) => document.getElementById(id);
const MAX_BYTES = 5 * 1024 * 1024;
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const STATUS_TEXT = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' };

let estimates = [];
let selected = null;
let previewUrl = null;
let qboDown = false;

const remainingOf = (e) => Math.max(0, e.totalAmount - e.pendingAmount - e.approvedAmount);
const statusText = (s) => (s === 'Closed' ? 'Invoiced (closed in QuickBooks)' : s);
const cleanAmount = (v) => v.replace(/,/g, '').trim();

UI.start().then(() => {
    loadEstimates();
    loadMine();
});

/* ───────── Estimates ───────── */

async function loadEstimates() {
    $('estCount').textContent = 'Loading estimates…';
    try {
        estimates = (await UI.api('/api/qbo/estimates')).estimates;
        $('estCount').textContent = '';
        qboDown = false;
        UI.clearMessage($('qboNotice'));
        $('estSearch').disabled = false;
        $('submitBtn').disabled = false;
    } catch (err) {
        $('estCount').textContent = '';
        if (err.code === 'QBO_NOT_CONNECTED' || err.code === 'QBO_REAUTH_REQUIRED') {
            qboDown = true;
            UI.showMessage($('qboNotice'), 'QuickBooks is not connected right now, so estimates cannot be loaded. Please ask an admin to reconnect it.', 'error');
            $('estSearch').disabled = true;
            $('submitBtn').disabled = true;
        } else {
            UI.showMessage($('message'), err.message, 'error');
        }
    }
}

function hideResults() {
    $('estResults').hidden = true;
}

function renderResults(query) {
    const list = $('estResults');
    list.replaceChildren();
    const q = query.trim().toLowerCase();
    if (!q) {
        $('estCount').textContent = '';
        return hideResults();
    }

    const matches = estimates.filter(
        (e) => (e.docNumber || '').toLowerCase().includes(q) || (e.customerName || '').toLowerCase().includes(q)
    );
    $('estCount').textContent = matches.length
        ? `${matches.length} found${matches.length > 8 ? '. Showing the first 8, so type more to narrow the list' : ''}.`
        : 'No estimate matches. Check the spelling or the estimate number.';

    matches.slice(0, 8).forEach((e) => {
        const li = document.createElement('li');
        const btn = UI.el('button');
        btn.type = 'button';
        btn.append(
            UI.el('div', '', `#${e.docNumber || e.id} · ${e.customerName}`),
            UI.el('div', 'sub', `${UI.peso(e.totalAmount)} · ${statusText(e.status)}`)
        );
        btn.addEventListener('click', () => selectEstimate(e));
        li.appendChild(btn);
        list.appendChild(li);
    });
    list.hidden = !matches.length;
}

function selectEstimate(e) {
    selected = e;
    hideResults();
    $('estPicker').hidden = true;
    $('estSelected').hidden = false;
    UI.setFieldError($('estSearch'), null);
    $('selCustomer').textContent = e.customerName;
    $('selNumber').textContent = e.docNumber || e.id;
    $('selStatus').textContent = statusText(e.status);
    $('selTotal').textContent = UI.peso(e.totalAmount);
    $('selPending').textContent = UI.peso(e.pendingAmount);
    $('selApproved').textContent = UI.peso(e.approvedAmount);
    $('selRemaining').textContent = UI.peso(remainingOf(e));
    updateAmountWarning();
    $('amount').focus();
}

function clearEstimate() {
    selected = null;
    $('estSelected').hidden = true;
    $('estPicker').hidden = false;
    $('amountWarn').hidden = true;
    $('estSearch').value = '';
    $('estCount').textContent = '';
    $('estSearch').focus();
}

$('estSearch').addEventListener('input', (e) => {
    UI.setFieldError($('estSearch'), null);
    renderResults(e.target.value);
});
$('estSearch').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
        const first = $('estResults').querySelector('button');
        if (first) { e.preventDefault(); first.focus(); }
    }
    if (e.key === 'Escape') hideResults();
});
$('estResults').addEventListener('keydown', (e) => {
    const buttons = [...$('estResults').querySelectorAll('button')];
    const i = buttons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i < buttons.length - 1) { e.preventDefault(); buttons[i + 1].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? buttons[i - 1] : $('estSearch')).focus(); }
    if (e.key === 'Escape') { hideResults(); $('estSearch').focus(); }
});
$('selClear').addEventListener('click', clearEstimate);

/* ───────── Amount, receipt ───────── */

function updateAmountWarning() {
    const amt = Number(cleanAmount($('amount').value));
    if (selected && amt > 0 && remainingOf(selected) > 0 && amt > remainingOf(selected)) {
        UI.showMessage(
            $('amountWarn'),
            `This is more than the estimated remaining balance (${UI.peso(remainingOf(selected))}). Check the amount before you submit.`,
            'info'
        );
    } else {
        $('amountWarn').hidden = true;
    }
}

$('amount').addEventListener('input', () => {
    UI.setFieldError($('amount'), null);
    updateAmountWarning();
});
$('amount').addEventListener('blur', () => {
    const raw = cleanAmount($('amount').value);
    if (/^\d{1,12}(\.\d{1,2})?$/.test(raw) && Number(raw) > 0) $('amount').value = Number(raw).toFixed(2);
});
['bank', 'refNo'].forEach((id) => $(id).addEventListener('input', () => UI.setFieldError($(id), null)));

function resetPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    $('preview').hidden = true;
    $('fileInfo').hidden = true;
}

$('proof').addEventListener('change', () => {
    UI.setFieldError($('proof'), null);
    resetPreview();
    const file = $('proof').files[0];
    if (!file) return;

    if (!FILE_TYPES.includes(file.type)) {
        $('proof').value = '';
        return UI.setFieldError($('proof'), 'This file is not a JPG, PNG or WebP image. Take a screenshot of the receipt and attach that.');
    }
    if (file.size > MAX_BYTES) {
        $('proof').value = '';
        return UI.setFieldError($('proof'), 'This image is larger than 5 MB. Choose a smaller screenshot.');
    }
    previewUrl = URL.createObjectURL(file);
    $('preview').src = previewUrl;
    $('preview').hidden = false;
    $('fileInfo').textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`;
    $('fileInfo').hidden = false;
});

/* ───────── Submit ───────── */

function validate() {
    let first = null;
    const fail = (input, msg) => { UI.setFieldError(input, msg); first = first || input; };

    if (!selected) fail($('estSearch'), 'Search for the customer or estimate number, then choose one from the list.');

    const amt = cleanAmount($('amount').value);
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(amt) || Number(amt) <= 0) {
        fail($('amount'), 'Enter an amount greater than 0, with up to 2 decimals (for example 2500.00).');
    }
    if (!$('bank').value) fail($('bank'), 'Select the bank that received the payment.');

    const ref = $('refNo').value.replace(/\s+/g, '');
    if (ref.length < 4) fail($('refNo'), 'Enter the reference number shown on the receipt (at least 4 characters).');

    if (!$('proof').files[0]) fail($('proof'), 'Attach a screenshot of the receipt.');

    if (first) first.focus();
    return !first;
}

function send(force) {
    const fd = new FormData();
    fd.append('estimateId', selected.id);
    fd.append('amount', cleanAmount($('amount').value));
    fd.append('bank', $('bank').value);
    fd.append('referenceNo', $('refNo').value);
    fd.append('proof', $('proof').files[0]);
    if (force) fd.append('force', 'true');
    return UI.api('/api/payments/submit', { method: 'POST', body: fd });
}

$('payForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearMessage($('message'));
    if (qboDown || !validate()) return;

    const customer = selected.customerName;
    const amount = Number(cleanAmount($('amount').value));
    const ref = $('refNo').value.replace(/\s+/g, '').toUpperCase();

    UI.setBusy($('submitBtn'), true, 'Submitting…');
    try {
        try {
            await send(false);
        } catch (err) {
            if (err.code === 'DUPLICATE_PENDING' && confirm(`${err.message}\n\nSubmit anyway?`)) await send(true);
            else throw err;
        }
        $('payForm').reset();
        resetPreview();
        clearEstimate();
        UI.showMessage(
            $('message'),
            `Submitted: ${customer}, ${UI.peso(amount)}, reference ${ref}. An admin will review it. You can submit another payment below.`,
            'ok',
            { focus: true }
        );
        loadEstimates();
        loadMine();
    } catch (err) {
        if (err.status === 401) return location.replace('/login.html?next=/');
        if (err.code === 'MUST_CHANGE_PASSWORD') return location.replace('/password.html');
        if (err.code === 'DUPLICATE_REFERENCE') {
            UI.setFieldError($('refNo'), `${err.message} Check that this is a new receipt.`);
            $('refNo').focus();
        } else {
            UI.showMessage($('message'), err.message, 'error', { focus: true });
        }
    } finally {
        UI.setBusy($('submitBtn'), false);
        if (qboDown) $('submitBtn').disabled = true;
    }
});

/* ───────── My submissions ───────── */

function renderNotice(count) {
    const box = $('reviewNotice');
    if (!count) return (box.hidden = true);

    const btn = UI.el('button', 'btn btn-link', 'Dismiss');
    btn.type = 'button';
    btn.addEventListener('click', async () => {
        await UI.api('/api/payments/mine/seen', { method: 'POST' }).catch(() => { });
        loadMine();
    });
    box.className = 'msg msg-info';
    box.setAttribute('role', 'status');
    box.replaceChildren(
        `${count} of your submissions ${count === 1 ? 'has' : 'have'} been reviewed since you last checked (see "New" below). `,
        btn
    );
    box.hidden = false;
}

async function loadMine() {
    const body = $('mineBody');
    try {
        const { payments, unseenCount } = await UI.api('/api/payments/mine');
        renderNotice(unseenCount);
        body.replaceChildren();

        if (!payments.length) {
            const tr = document.createElement('tr');
            const td = UI.el('td', 'sub', 'You have not submitted any payments yet.');
            td.colSpan = 5;
            tr.appendChild(td);
            body.appendChild(tr);
            return;
        }

        payments.forEach((p) => {
            const tr = document.createElement('tr');

            const customer = UI.el('td');
            customer.append(
                UI.el('div', '', p.customerName),
                UI.el('div', 'sub', `Estimate #${p.qboEstimateNumber || p.qboEstimateId} · ${UI.bankLabel(p.bankDepositedTo)}`)
            );
            if (p.status === 'rejected' && p.rejectionReason) {
                customer.appendChild(UI.el('div', 'sub', `Reason: ${p.rejectionReason}`));
            }

            const status = UI.el('td');
            status.appendChild(UI.el('span', `badge badge-${p.status}`, STATUS_TEXT[p.status] || p.status));
            if (p.unseen) status.appendChild(UI.el('span', 'badge badge-new', 'New'));

            const receipt = UI.el('td');
            const link = UI.el('a', '', 'View');
            link.href = `/api/payments/${p.id}/receipt`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            receipt.appendChild(link);

            tr.append(
                UI.el('td', '', UI.when(p.createdAt)),
                customer,
                UI.el('td', 'num', UI.peso(p.amountSubmitted)),
                status,
                receipt
            );
            body.appendChild(tr);
        });
    } catch (err) {
        if (err.status === 401) return location.replace('/login.html?next=/');
        body.replaceChildren();
        const tr = document.createElement('tr');
        const td = UI.el('td', 'sub', `Could not load your submissions: ${err.message}`);
        td.colSpan = 5;
        tr.appendChild(td);
        body.appendChild(tr);
    }
}