const $ = (id) => document.getElementById(id);
const FIELDS = ['current', 'next', 'confirm'];
let me;

UI.start().then((user) => {
    me = user;
    if (user.mustChangePassword) $('forcedNotice').hidden = false;
    $('current').focus();
});

$('showPw').addEventListener('change', (e) => {
    FIELDS.forEach((id) => ($(id).type = e.target.checked ? 'text' : 'password'));
});
FIELDS.forEach((id) => $(id).addEventListener('input', () => UI.setFieldError($(id), null)));

$('pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearMessage($('message'));

    const current = $('current').value;
    const next = $('next').value;
    let first = null;
    const fail = (id, msg) => { UI.setFieldError($(id), msg); first = first || $(id); };

    if (!current) fail('current', 'Enter your current password.');
    if (next.length < 8) fail('next', 'The new password must be at least 8 characters.');
    else if (next === current) fail('next', 'Choose a password that is different from the current one.');
    if ($('confirm').value !== next) fail('confirm', 'The two new passwords do not match.');
    if (first) return first.focus();

    UI.setBusy($('submitBtn'), true, 'Saving…');
    try {
        await UI.api('/api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword: current, newPassword: next }),
        });
        $('pwForm').hidden = true;
        $('forcedNotice').hidden = true;
        UI.showMessage($('message'), 'Your password has been changed. Taking you to the portal…', 'ok', { focus: true });
        setTimeout(() => location.replace(UI.home(me)), 1200);
    } catch (err) {
        if (err.status === 401) return location.replace('/login.html');
        if (err.status === 422) {
            UI.setFieldError($('current'), err.message);
            $('current').focus();
        } else {
            UI.showMessage($('message'), err.message, 'error', { focus: true });
        }
        UI.setBusy($('submitBtn'), false);
    }
});