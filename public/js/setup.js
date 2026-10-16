const $ = (id) => document.getElementById(id);
const show = (data) => ($('out').textContent = JSON.stringify(data, null, 2));

async function api(path, options = {}) {
    const res = await fetch(path, {
        credentials: 'same-origin',
        headers: options.body ? { 'Content-Type': 'application/json' } : {},
        ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || res.statusText);
    return data;
}

async function refreshWhoAmI() {
    const { user } = await api('/api/auth/me');
    $('whoami').textContent = user ? `Logged in as ${user.name} (${user.role})` : 'Not logged in';
    return user;
}

async function refreshQboStatus() {
    try {
        const s = await api('/api/auth/qbo/status?verify=true');
        $('qboStatus').textContent = s.connected
            ? `✅ Connected${s.companyName ? ` to "${s.companyName}"` : ''} (realm ${s.realmId})`
            : '❌ Not connected';
    } catch (err) {
        $('qboStatus').textContent = `Log in as admin to see status (${err.message})`;
    }
}

$('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', name: $('name').value, code: $('code').value }),
        });
        await refreshWhoAmI();
        await refreshQboStatus();
    } catch (err) {
        alert(err.message);
    }
});

$('loadBtn').addEventListener('click', async () => {
    show('Loading…');
    try {
        show(await api('/api/qbo/estimates?refresh=true'));
    } catch (err) {
        show({ error: err.message });
    }
});

const params = new URLSearchParams(location.search);
if (params.get('qbo') === 'error') alert(`QuickBooks connection failed: ${params.get('reason')}`);

refreshWhoAmI().then(refreshQboStatus);