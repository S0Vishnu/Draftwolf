import http from 'node:http';
import { DraftControlSystem } from './services/DraftControlSystem';
import path from 'node:path';
import fs from 'node:fs/promises';
import { authManager } from './auth';

const PORT = 45000;

/** Read and parse JSON request body (resolves to {} for empty body). */
function readRequestBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
            } catch (e) {
                reject(e);
            }
        });
    });
}

/** Type for POST body fields used by route handlers. */
interface PostBody {
    path?: string;
    projectRoot?: string;
    label?: string;
    files?: string[];
    versionId?: string;
    relativePath?: string;
    newLabel?: string;
    newLabel?: string;
    targetFile?: string;
    backupPath?: string;
}

/** Derive a display name from email (local part, capitalized) so we never show raw email. */
function displayNameFromEmail(email: string): string {
    const local = email.split('@')[0] || '';
    if (!local) return 'User';
    return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}

/** Decode JWT payload (middle segment) for display name. Prefers name; never shows raw email. */
function getUsernameFromToken(token: string): string {
    try {
        const payload = token.split('.')[1];
        if (!payload) return 'User';
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown>;
        const name = decoded.name as string | undefined;
        if (name && typeof name === 'string' && name.trim()) return name.trim();
        const email = decoded.email as string | undefined;
        if (email && typeof email === 'string') return displayNameFromEmail(email);
        const sub = decoded.sub as string | undefined;
        if (sub && typeof sub === 'string') return 'User';
        return 'User';
    } catch {
        return 'User';
    }
}

type RouteHandler = (res: http.ServerResponse, body: PostBody) => Promise<void>;

function routeKey(method: string, pathname: string): string {
    return `${method} ${pathname}`;
}

async function handleAuthStatus(res: http.ServerResponse): Promise<void> {
    const token = await authManager.getTokenForDisplay();
    const inMemoryLoggedIn = (authManager as { isAuthenticated?: boolean }).isAuthenticated;
    const loggedIn = !!token || !!inMemoryLoggedIn;
    let username: string | undefined;
    if (loggedIn && token) {
        username = getUsernameFromToken(token);
    } else if (loggedIn) {
        username = 'User';
    }
    sendJson(res, 200, { loggedIn, username: username ?? null });
}

async function handleFindRoot(res: http.ServerResponse, body: PostBody): Promise<void> {
    const root = await DraftControlSystem.findProjectRoot(body.path!);
    sendJson(res, 200, { root });
}

async function handleInit(res: http.ServerResponse, body: PostBody): Promise<void> {
    const dcs = new DraftControlSystem(body.projectRoot!, body.backupPath);
    await dcs.init();
    sendJson(res, 200, { success: true });
}

async function handleCommit(res: http.ServerResponse, body: PostBody): Promise<void> {
    const dcs = new DraftControlSystem(body.projectRoot!, body.backupPath);
    const versionId = await dcs.commit(body.label!, body.files!);
    sendJson(res, 200, { success: true, versionId });
}

async function handleHistory(res: http.ServerResponse, body: PostBody): Promise<void> {
    const filterPath = body.targetFile || body.relativePath;
    console.log(`[API] History Request: Root="${body.projectRoot}", Filter="${filterPath}", Backup="${body.backupPath}"`);
    const dcs = new DraftControlSystem(body.projectRoot!, body.backupPath);
    const history = await dcs.getHistory(filterPath!);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(history));
}

async function handleExtractTemp(res: http.ServerResponse, body: PostBody): Promise<void> {
    const dcs = new DraftControlSystem(body.projectRoot!, body.backupPath);
    const tempDir = path.join(body.projectRoot!, '.draft', 'temp'); // TODO: Does temp dir need to be in backupPath too? Currently keeps in projectRoot which is fine for temp.
    if (!(await fs.stat(tempDir).catch(() => false))) {
        await fs.mkdir(tempDir, { recursive: true });
    }
    const ext = path.extname(body.relativePath!);
    const name = path.basename(body.relativePath!, ext);
    const tempFile = path.join(tempDir, `${name}_v${body.versionId}_${Date.now()}${ext}`);
    await dcs.extractFile(body.versionId!, body.relativePath!, tempFile);
    sendJson(res, 200, { success: true, path: tempFile });
}

async function handleRestore(res: http.ServerResponse, body: PostBody): Promise<void> {
    const dcs = new DraftControlSystem(body.projectRoot!, body.backupPath);
    await dcs.restore(body.versionId!);
    sendJson(res, 200, { success: true });
}

async function handleRenameVersion(res: http.ServerResponse, body: PostBody): Promise<void> {
    const dcs = new DraftControlSystem(body.projectRoot!, body.backupPath);
    await dcs.renameVersion(body.versionId!, body.newLabel!);
    sendJson(res, 200, { success: true });
}

async function handleCreateSnapshot(res: http.ServerResponse, body: PostBody): Promise<void> {
    const dcs = new DraftControlSystem(body.projectRoot!, body.backupPath);
    // limit snapshot to specific folder if provided, or root
    const targetFolder = body.relativePath || '.';
    const versionId = await dcs.createSnapshot(targetFolder, body.label!);
    sendJson(res, 200, { success: true, versionId });
}

async function handleStorageStats(res: http.ServerResponse, body: PostBody): Promise<void> {
    const dcs = new DraftControlSystem(body.projectRoot!, body.backupPath);
    const stats = await dcs.getStorageReport();
    sendJson(res, 200, stats);
}

function sendJson(res: http.ServerResponse, status: number, data: object): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

const ROUTES: Record<string, RouteHandler | (() => Promise<void>)> = {
    [routeKey('GET', '/health')]: async (res) => {
        sendJson(res, 200, { success: true });
    },
    [routeKey('GET', '/auth/status')]: (res) => handleAuthStatus(res),
    [routeKey('POST', '/draft/find-root')]: (res, body) => handleFindRoot(res, body),
    [routeKey('POST', '/draft/init')]: (res, body) => handleInit(res, body),
    [routeKey('POST', '/draft/commit')]: (res, body) => handleCommit(res, body),
    [routeKey('POST', '/draft/history')]: (res, body) => handleHistory(res, body),
    [routeKey('POST', '/draft/extract-temp')]: (res, body) => handleExtractTemp(res, body),
    [routeKey('POST', '/draft/restore')]: (res, body) => handleRestore(res, body),
    [routeKey('POST', '/draft/rename-version')]: (res, body) => handleRenameVersion(res, body),
    [routeKey('POST', '/draft/snapshot/create')]: (res, body) => handleCreateSnapshot(res, body),
    [routeKey('POST', '/draft/storage/stats')]: (res, body) => handleStorageStats(res, body),
};

async function dispatchRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    body: PostBody
): Promise<void> {
    const key = routeKey(req.method || '', url.pathname);
    const handler = ROUTES[key] as RouteHandler | undefined;
    if (handler) {
        await handler(res, body);
        return;
    }
    sendJson(res, 404, { error: 'Not Found' });
}

export function startApiServer() {
    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const body = (await readRequestBody(req)) as PostBody;

        try {
            await dispatchRequest(req, res, url, body);
        } catch (e: unknown) {
            console.error('API Server Error:', e);
            sendJson(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' });
        }
    });

    server.on('error', (e: any) => {
        if (e.code === 'EADDRINUSE') {
            console.log('API Server Address in use, retrying...');
            setTimeout(() => {
                server.close();
                server.listen(PORT, '127.0.0.1');
            }, 1000);
        } else {
            console.error('API Server Error:', e);
        }
    });

    server.listen(PORT, '127.0.0.1', () => {
        console.log(`DraftWolf API Server running on port ${PORT}`);
    });

    return server;
}
