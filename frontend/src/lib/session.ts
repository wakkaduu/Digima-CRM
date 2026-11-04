// Remembers, for one page load, that a signed-in session ended on its own (it expired, or the account was signed out
// elsewhere), so the sign-in page can say why the person is there instead of just showing the form.

const KEY = 'digima.sessionEnded';

export function markSessionEnded() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* storage unavailable: the sign-in page simply shows no notice */
  }
}

/** Reads the mark and clears it, so the notice shows once. */
export function takeSessionEnded() {
  try {
    const ended = sessionStorage.getItem(KEY) === '1';
    sessionStorage.removeItem(KEY);
    return ended;
  } catch {
    return false;
  }
}
