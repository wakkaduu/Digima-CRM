const UI = (() => {
    const $ = (id) => document.getElementById(id);

    const NAV = [
        { href: '/', label: 'Submit payment', roles: ['sales', 'admin'] },
        { href: '/admin.html', label: 'Pending approvals', roles: ['admin'] },
        { href: '/setup.html', label: 'QuickBooks', roles: ['admin'] },
    ];

    async function api(path, options = {}) {
        const isForm = options.body instanceof FormData;
        let res;
        try {
            res = await fetch(path, {
                credentials: 'same-origin',
                ...options,
                headers: options.body && !isForm ? { 'Content-Type': 'application/json' } : {},
            });
        } catch (_) {
            throw new Error('Cannot reach the server. Check your connection and try again.');
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error((data.error && data.error.message) || res.statusText);
            err.status = res.status;
            err.code = data.error && data.error.details && data.error.details.code;
            throw err;
        }
        return data;
    }

    const peso = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n) || 0);
    const when = (d) => new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
    const bankLabel = (b) => (b === 'HappyMeal' ? 'Happy Meal' : b);
    const home = (user) => (user.role === 'admin' ? '/admin.html' : '/');

    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    /* Messages: persistent until the next action, and always carry words, not just colour. */
    function showMessage(node, text, type = 'error', opts = {}) {
        node.className = `msg msg-${type}`;
        node.setAttribute('role', type === 'error' ? 'alert' : 'status');
        node.textContent = type === 'error' ? `Error: ${text}` : text;
        node.hidden = false;
        if (opts.focus) {
            node.focus();
            node.scrollIntoView({ block: 'nearest' });
        }
    }
    function clearMessage(node) {
        node.hidden = true;
        node.textContent = '';
    }

    /* Inline field errors, linked to the input for screen readers. */
    function setFieldError(input, message) {
        const id = `${input.id}-error`;
        let note = $(id);
        if (input.dataset.base === undefined) input.dataset.base = input.getAttribute('aria-describedby') || '';

        if (!message) {
            if (note) note.remove();
            input.removeAttribute('aria-invalid');
            if (input.dataset.base) input.setAttribute('aria-describedby', input.dataset.base);
            else input.removeAttribute('aria-describedby');
            return;
        }
        if (!note) {
            note = el('p', 'field-error');
            note.id = id;
            (input.closest('.field') || input.parentNode).appendChild(note);
        }
        note.textContent = message;
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', `${input.dataset.base} ${id}`.trim());
    }

    function setBusy(btn, busy, busyText) {
        if (busy) {
            btn.dataset.label = btn.textContent;
            btn.textContent = busyText;
            btn.disabled = true;
        } else {
            btn.textContent = btn.dataset.label || btn.textContent;
            btn.disabled = false;
        }
    }

    const isCurrent = (href) => (location.pathname === '/index.html' ? '/' : location.pathname) === href;

    function renderTopbar(user) {
        const bar = $('topbar');
        if (!bar) return;
        const inner = el('div', 'topbar-inner');
        inner.appendChild(el('span', 'brand', 'Payment Portal'));

        const nav = el('nav', 'nav');
        nav.setAttribute('aria-label', 'Main');
        if (!user.mustChangePassword) {
            NAV.filter((n) => n.roles.includes(user.role)).forEach((n) => {
                const a = el('a', '', n.label);
                a.href = n.href;
                if (isCurrent(n.href)) a.setAttribute('aria-current', 'page');
                nav.appendChild(a);
            });
        }

        const who = el('div', 'user');
        who.appendChild(el('span', '', `${user.name} (${user.role})`));
        if (!user.mustChangePassword) {
            const pw = el('a', '', 'Change password');
            pw.href = '/password.html';
            who.appendChild(pw);
        }
        const out = el('button', 'btn btn-link', 'Log out');
        out.type = 'button';
        out.addEventListener('click', async () => {
            await api('/api/auth/logout', { method: 'POST' }).catch(() => { });
            location.href = '/login.html';
        });
        who.appendChild(out);

        inner.append(nav, who);
        bar.replaceChildren(inner);
    }

    /* Call first on every protected page. Redirects when needed and renders the top bar. */
    async function start({ admin = false } = {}) {
        const stop = () => new Promise(() => { }); // page script halts while the browser redirects
        let user;
        try {
            ({ user } = await api('/api/auth/me'));
        } catch (err) {
            const m = document.querySelector('main');
            if (m) m.prepend(Object.assign(el('div', 'msg msg-error'), { textContent: `Error: ${err.message}` }));
            return stop();
        }
        if (!user) {
            location.replace(`/login.html?next=${encodeURIComponent(location.pathname)}`);
            return stop();
        }
        if (user.mustChangePassword && location.pathname !== '/password.html') {
            location.replace('/password.html');
            return stop();
        }
        if (admin && user.role !== 'admin') {
            location.replace('/');
            return stop();
        }
        renderTopbar(user);
        return user;
    }

    return { $, api, peso, when, bankLabel, home, el, showMessage, clearMessage, setFieldError, setBusy, start };
})();