const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function destination(user) {
    if (user.mustChangePassword) return '/password.html';
    const next = params.get('next');
    return next && next.startsWith('/') && !next.startsWith('//') ? next : UI.home(user);
}

// Already logged in? Skip the form.
UI.api('/api/auth/me').then(({ user }) => user && location.replace(destination(user))).catch(() => { });

$('showPw').addEventListener('change', (e) => {
    $('password').type = e.target.checked ? 'text' : 'password';
});
['email', 'password'].forEach((id) => $(id).addEventListener('input', () => UI.setFieldError($(id), null)));

$('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearMessage($('message'));

    const email = $('email').value.trim();
    const password = $('password').value;
    let first = null;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        UI.setFieldError($('email'), 'Enter your email address, for example name@company.com.');
        first = $('email');
    }
    if (!password) {
        UI.setFieldError($('password'), 'Enter your password.');
        first = first || $('password');
    }
    if (first) return first.focus();

    UI.setBusy($('submitBtn'), true, 'Logging in…');
    try {
        const { user } = await UI.api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        location.replace(destination(user));
    } catch (err) {
        UI.showMessage($('message'), err.message, 'error');
        $('password').value = '';
        $('password').focus();
        UI.setBusy($('submitBtn'), false);
    }
});