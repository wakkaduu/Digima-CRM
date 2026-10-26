// intuit-oauth ships no type declarations; only the surface this app uses is described.
declare module 'intuit-oauth' {
    interface AuthResponse {
        getJson(): any;
    }

    interface OAuthClientConfig {
        clientId: string;
        clientSecret: string;
        environment: string;
        redirectUri: string;
    }

    class OAuthClient {
        static scopes: { Accounting: string; OpenId: string; Profile: string; Email: string; [k: string]: string };
        constructor(config: OAuthClientConfig);
        authorizeUri(opts: { scope: string[]; state?: string }): string;
        createToken(url: string): Promise<AuthResponse>;
        refreshUsingToken(refreshToken: string): Promise<AuthResponse>;
        /** Checks issuer, audience, expiry and signature of the id_token from the last createToken() call. */
        validateIdToken(): Promise<boolean>;
    }

    export = OAuthClient;
}
