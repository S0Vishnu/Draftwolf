import { ipcMain, shell, safeStorage } from 'electron';
import keytar from 'keytar';
import { EventEmitter } from 'events';

const SERVICE_NAME = 'DraftFlow-Auth';
const ACCOUNT_NAME = 'firebase_id_token'; // Single user for now, or use dynamic
const DATE_KEY = 'token_date';

// Validates token format (basic JWT check)
function isValidToken(token) {
    return typeof token === 'string' && token.split('.').length === 3;
}

class AuthManager extends EventEmitter {
    constructor() {
        super();
        this.isAuthenticated = false;
    }

    // Initialize: Check if we have a valid token from today
    async init() {
        try {
            const dateStored = await keytar.getPassword(SERVICE_NAME, DATE_KEY);
            const today = new Date().toDateString();

            if (dateStored === today) {
                const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
                if (token && isValidToken(token)) {
                    this.isAuthenticated = true;
                    // Notify renderer - but handle might not be ready if called too early. 
                    // We will rely on renderer asking or `getToken` call.
                    return token;
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
        const FIREBASE_LOGIN_URL = 'https://draftflow-905d4.firebaseapp.com/auth-redirect.html?mode=google'; // Points to the robust redirect handler

        await shell.openExternal(FIREBASE_LOGIN_URL);
    }

    // Handle Deep Link URL
    async handleDeepLink(url) {
        try {
            // url format: myapp://auth?token=...
            const urlObj = new URL(url);
            if (urlObj.protocol !== 'myapp:') return;

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
            // Save date to enforce 1-day validity logic requested
            await keytar.setPassword(SERVICE_NAME, DATE_KEY, new Date().toDateString());
        } catch (e) {
            console.error('Keytar Save Error:', e);
        }
    }

    async getToken() {
        try {
            const dateStored = await keytar.getPassword(SERVICE_NAME, DATE_KEY);
            const today = new Date().toDateString();

            if (dateStored !== today) {
                // Token expired (logic: valid for a entire day)
                await this.logout();
                return null;
            }

            return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
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
