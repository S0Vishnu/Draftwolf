import { ipcMain, shell } from 'electron';
import keytar from 'keytar';
import { EventEmitter } from 'events';

const SERVICE_NAME = 'DraftWolf-Auth';
const ACCOUNT_NAME = 'firebase_id_token'; // Single user for now, or use dynamic
const DATE_KEY = 'token_date';

// Validates token format (basic JWT check)
// Validates token format (basic JWT check)
function isValidToken(token) {
    return typeof token === 'string' && token.split('.').length === 3;
}

class AuthManager extends EventEmitter {
    constructor() {
        super();
        this.isAuthenticated = false;
    }

    // Initialize: Check if we have a valid token within 30 days
    async init() {
        try {
            const dateStored = await keytar.getPassword(SERVICE_NAME, DATE_KEY);

            if (dateStored) {
                // Check if it's a timestamp (new format) or date string (old format)
                const lastLogin = parseInt(dateStored);
                // Firebase ID Tokens expire in 1 hour (3600000 ms). 
                // We use a slightly shorter buffer (e.g. 50 mins) to be safe or just 1 hour allowing auto-refresh if valid.
                // However, we can't auto-refresh purely from ID token storage.
                const TOKEN_VALIDITY_MS = 3600000;

                const isTimestamp = !isNaN(lastLogin);
                const isValid = isTimestamp && (Date.now() - lastLogin < TOKEN_VALIDITY_MS);

                // If old format (Date String) or expired timestamp, we consider it invalid/expired
                // Note: Old format (string) parsing to int results in NaN, so `isValid` becomes false, forcing re-login which upgrades format.

                if (isValid) {
                    const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
                    if (token && isValidToken(token)) {
                        this.isAuthenticated = true;
                        // Notify renderer - but handle might not be ready if called too early. 
                        // We will rely on renderer asking or `getToken` call.
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
        // This URL should be the hosted Firebase Login page that redirects to myapp://
        // For now, we use a placeholder or assume the user has configured one.
        // user instruction: "Assume Firebase web auth & redirect page already exist"
        // Use local dev server for auth when developing to test changes immediately
        const FIREBASE_LOGIN_URL = 'https://draftflow-905d4.firebaseapp.com/auth-redirect.html?mode=google';

        await shell.openExternal(FIREBASE_LOGIN_URL);
    }

    // Handle Deep Link URL
    async handleDeepLink(url) {
        try {
            // url format: myapp://auth?token=...
            const urlObj = new URL(url);
            if (urlObj.protocol !== 'myapp:') return;

            if (urlObj.hostname === 'open' || urlObj.pathname.includes('open')) {
                // Just opening the app, no auth needed
                return;
            }

            const token = urlObj.searchParams.get('token');

            if (!token) {
                console.error('No token found in deep link');
                return;
            }

            if (!isValidToken(token)) {
                console.error('Invalid token format');
                return;
            }

            // Securely store token
            await this.saveToken(token);

            this.isAuthenticated = true;
            this.emit('auth-success', token);

        } catch (e) {
            console.error('Deep Link Handling Error:', e);
        }
    }

    async saveToken(token) {
        try {
            // Save token
            await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
            // Save timestamp to enforce validity logic
            await keytar.setPassword(SERVICE_NAME, DATE_KEY, Date.now().toString());
        } catch (e) {
            console.error('Keytar Save Error:', e);
        }
    }

    async getToken() {
        try {
            const dateStored = await keytar.getPassword(SERVICE_NAME, DATE_KEY);

            let isValid = false;

            if (dateStored) {
                const lastLogin = parseInt(dateStored);
                const TOKEN_VALIDITY_MS = 3600000;
                if (!isNaN(lastLogin) && (Date.now() - lastLogin < TOKEN_VALIDITY_MS)) {
                    isValid = true;
                }
            }

            if (!isValid) {
                // Token expired - return null but do NOT clear keytar, so getTokenForDisplay()
                // can still report "logged in" for the Blender addon until user explicitly logs out.
                return null;
            }

            return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
        } catch (e) {
            return null;
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
