const OAuthClient = require('intuit-oauth');
const env = require('./env');

// A fresh client per operation avoids token state leaking between requests.
// Tokens are persisted in the DB (see qbo.service.js), not on the client object.
function createOAuthClient() {
    return new OAuthClient({
        clientId: env.QBO_CLIENT_ID,
        clientSecret: env.QBO_CLIENT_SECRET,
        environment: env.QBO_ENVIRONMENT,
        redirectUri: env.QBO_REDIRECT_URI,
    });
}

const API_BASE =
    env.QBO_ENVIRONMENT === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';

module.exports = { OAuthClient, createOAuthClient, API_BASE };