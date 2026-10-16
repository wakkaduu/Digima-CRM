import OAuthClient from 'intuit-oauth';
import env from './env';

// A fresh client per operation avoids token state leaking between requests.
// Tokens are persisted in the DB (see qbo.service.ts), not on the client object.
export function createOAuthClient() {
    return new OAuthClient({
        clientId: env.QBO_CLIENT_ID,
        clientSecret: env.QBO_CLIENT_SECRET,
        environment: env.QBO_ENVIRONMENT,
        redirectUri: env.QBO_REDIRECT_URI,
    });
}

export const API_BASE =
    env.QBO_ENVIRONMENT === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';

export { OAuthClient };
