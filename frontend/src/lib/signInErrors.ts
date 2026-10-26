/** Why the backend sent the browser back from QuickBooks (see GET /api/auth/qbo/callback), as ?error=<code>. */
export const SIGN_IN_ERRORS: Record<string, string> = {
  access_denied: 'Sign-in was cancelled. You can try again whenever you are ready.',
  not_authorized: 'This QuickBooks login has not been invited yet. Ask a SuperAdmin for an invite link, open it, then sign in. Or log in with your email and password.',
  invite_invalid: 'That invite link is not valid, has expired, or was already used. Ask a SuperAdmin for a new one.',
  already_linked: 'That QuickBooks login already belongs to another account, so it cannot be used here. Use the login you were invited with, or ask a SuperAdmin for help.',
  login_mismatch: 'That is not the QuickBooks login linked to your account. Sign in to QuickBooks with the same login you used before.',
  deactivated: 'This account has been deactivated. Please contact a SuperAdmin.',
  wrong_company: 'That QuickBooks login belongs to a different company. Sign in with your company account.',
};
export const FALLBACK_SIGN_IN_ERROR = 'Sign-in did not complete. Please try again.';
export const signInError = (code: string | null) => (code ? (SIGN_IN_ERRORS[code] ?? FALLBACK_SIGN_IN_ERROR) : null);
