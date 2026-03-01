import { ipcMain, shell } from 'electron';
import keytar from 'keytar';
import { EventEmitter } from 'node:events';

const SERVICE_NAME = 'DraftWolf-Auth';
const ACCOUNT_NAME = 'supabase_access_token';
const DATE_KEY = 'token_date';

// Validates token format (basic check)
function isValidToken(token) {
    // Supabase tokens are JWTs (3 parts)
    return typeof token === 'string' && token.length > 20;
}

class AuthManager extends EventEmitter {
    constructor() {
        super();
        this.isAuthenticated = false;
        this.fallbackToken = null;
    }

    // Initialize: Check if we have a valid token
    async init() {
        try {
            const dateStored = await keytar.getPassword(SERVICE_NAME, DATE_KEY);

            if (dateStored) {
                const lastLogin = Number.parseInt(dateStored);
                // Supabase/JWT Tokens usually expire in 1 hour (3600000 ms).
                const TOKEN_VALIDITY_MS = 3600000;

                const isTimestamp = !Number.isNaN(lastLogin);
                const isValid = isTimestamp && (Date.now() - lastLogin < TOKEN_VALIDITY_MS);

                if (isValid) {
                    const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
                    if (token && isValidToken(token)) {
                        this.isAuthenticated = true;
                        return token;
                    }
                }
            }
            return null;
        } catch (e) {
            console.error('Auth Init Error:', e);
            return null;
        }
    }

    // Start Login Flow
    async login() {
        const SUPABASE_PROJECT_URL = 'https://rsytfsaumksljinrxqer.supabase.co';
        // Hosted auth page that extracts tokens and redirects to myapp:// deep link
        const AUTH_REDIRECT_PAGE = 'https://draftwolf-authentication.netlify.app/auth-redirect.html';
        const REDIRECT_URL = encodeURIComponent(AUTH_REDIRECT_PAGE);
        const SUPABASE_LOGIN_URL = `${SUPABASE_PROJECT_URL}/auth/v1/authorize?provider=google&redirect_to=${REDIRECT_URL}`;

        await shell.openExternal(SUPABASE_LOGIN_URL);
    }

    // Handle Deep Link URL
    async handleDeepLink(url) {
        console.log('[Auth] Deep link received:', url);
        try {
            const urlObj = new URL(url);

            // Log URL parts for debugging
            console.log('[Auth] URL parts - Host:', urlObj.hostname, 'Path:', urlObj.pathname, 'Hash length:', urlObj.hash?.length);

            // Extract from search params (?)
            let accessToken = urlObj.searchParams.get('token') || urlObj.searchParams.get('access_token');
            let refreshToken = urlObj.searchParams.get('refresh_token');

            // Extraction from hash fragment (#)
            if (!accessToken && urlObj.hash) {
                console.log('[Auth] Checking hash fragment for tokens...');
                // Remove leading # and potential trailing artifacts like &sb=
                const hashClean = urlObj.hash.substring(1).split('&sb=')[0];
                const hashParams = new URLSearchParams(hashClean);
                accessToken = hashParams.get('access_token');
                refreshToken = hashParams.get('refresh_token');
            }

            if (!accessToken) {
                console.warn('[Auth] No access token found in URL');
                // Check if it's an error
                const error = urlObj.searchParams.get('error_description') ||
                    new URLSearchParams(urlObj.hash.substring(1)).get('error_description');
                if (error) {
                    console.error('[Auth] Error from provider:', error);
                    this.emit('auth-error', decodeURIComponent(error).replace(/\+/g, ' '));
                }
                return;
            }

            if (!isValidToken(accessToken)) {
                console.warn('[Auth] Token failed validation check');
                return;
            }

            console.log('[Auth] Token extracted successfully. Emitting success...');

            // Securely store token
            await this.saveToken(accessToken);

            this.isAuthenticated = true;
            this.emit('auth-success', {
                accessToken,
                refreshToken: refreshToken || ''
            });

        } catch (e) {
            console.error('[Auth] Critical handling error:', e);
            this.emit('auth-error', 'An unexpected error occurred during login.');
        }
    }

    async saveToken(token) {
        try {
            // Save token
            await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
            // Save timestamp to enforce validity logic
            await keytar.setPassword(SERVICE_NAME, DATE_KEY, Date.now().toString());
        } catch (e) {
            console.error('Keytar Save Error, using fallback:', e);
            this.fallbackToken = token;
        }
    }

    async getToken() {
        try {
            const dateStored = await keytar.getPassword(SERVICE_NAME, DATE_KEY);

            let isValid = false;
            if (dateStored) {
                const lastLogin = Number.parseInt(dateStored);
                const TOKEN_VALIDITY_MS = 3600000;
                if (!Number.isNaN(lastLogin) && (Date.now() - lastLogin < TOKEN_VALIDITY_MS)) {
                    isValid = true;
                }
            }

            if (!isValid) {
                return this.fallbackToken;
            }

            const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
            return (token && isValidToken(token)) ? token : this.fallbackToken;
        } catch (e) {
            console.error('Get Token Error:', e);
            return this.fallbackToken;
        }
    }

    /**
     * For display only (e.g. Blender addon "logged in?"). Returns token if one exists
     * without enforcing 1h expiry, so UI stays in sync with the app window.
     */
    async getTokenForDisplay() {
        try {
            const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
            return token && isValidToken(token) ? token : null;
        } catch (e) {
            console.error('Get Token For Display Error:', e);
            return null;
        }
    }

    async logout() {
        try {
            await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
            await keytar.deletePassword(SERVICE_NAME, DATE_KEY);
            this.isAuthenticated = false;
            this.emit('logout');
        } catch (e) {
            console.error('Logout Error:', e);
        }
    }
}

export const authManager = new AuthManager();

// Register IPC handlers
export function setupAuthIPC() {
    ipcMain.handle('auth:login', async () => {
        await authManager.login();
    });

    ipcMain.handle('auth:getToken', async () => {
        return await authManager.getToken();
    });

    ipcMain.handle('auth:logout', async () => {
        await authManager.logout();
        return true;
    });
}
