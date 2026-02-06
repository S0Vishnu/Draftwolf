import http from 'http';
import { DraftControlSystem } from './services/DraftControlSystem';
import path from 'path';
import fs from 'fs/promises';
import { authManager } from './auth';

const PORT = 45000;

/** Decode JWT payload (middle segment) for display name. */
function getUsernameFromToken(token: string): string {
    try {
        const payload = token.split('.')[1];
        if (!payload) return 'User';
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return decoded.name || decoded.email || decoded.sub || 'User';
    } catch {
        return 'User';
    }
}

export function startApiServer() {
    const server = http.createServer(async (req, res) => {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const url = new URL(req.url || '/', `http://${req.headers.host}`);

        const getBody = async () => {
            return new Promise<any>((resolve, reject) => {
                let body = '';
                req.on('data', chunk => body += chunk.toString());
                req.on('end', () => {
                    try { resolve(body ? JSON.parse(body) : {}); }
                    catch (e) { reject(e); }
                });
            });
        };

        try {
            // Health check (Blender addon uses this to detect if DraftWolf app is running)
            if (url.pathname === '/health' && req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }

            // Auth status (Blender addon uses this for login state)
            if (url.pathname === '/auth/status' && req.method === 'GET') {
                const token = await authManager.getToken();
                const loggedIn = !!token;
                const username = loggedIn ? getUsernameFromToken(token) : undefined;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ loggedIn, username: username || null }));
                return;
            }

            // Find Project Root
            if (url.pathname === '/draft/find-root' && req.method === 'POST') {
                const { path: searchPath } = await getBody();
                const root = await DraftControlSystem.findProjectRoot(searchPath);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ root }));
                return;
            }

            // Init
            if (url.pathname === '/draft/init' && req.method === 'POST') {
                const { projectRoot } = await getBody();
                const dcs = new DraftControlSystem(projectRoot);
                await dcs.init();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }

            // Commit
            if (url.pathname === '/draft/commit' && req.method === 'POST') {
                const { projectRoot, label, files } = await getBody();
                const dcs = new DraftControlSystem(projectRoot);
                const versionId = await dcs.commit(label, files);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, versionId }));
                return;
            }

            // History
            if (url.pathname === '/draft/history' && req.method === 'POST') {
                const body = await getBody();
                const { projectRoot } = body;
                // Support both new and old parameter names to ensure filter is always captured
                const filterPath = body.targetFile || body.relativePath;

                console.log(`[API] History Request: Root="${projectRoot}", Filter="${filterPath}"`);

                const dcs = new DraftControlSystem(projectRoot);
                const history = await dcs.getHistory(filterPath);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(history));
                return;
            }

            // Extract Temp (for opening a version)
            if (url.pathname === '/draft/extract-temp' && req.method === 'POST') {
                const { projectRoot, versionId, relativePath } = await getBody();
                const dcs = new DraftControlSystem(projectRoot);

                // Temp dir inside .draft so it's hidden/managed
                const tempDir = path.join(projectRoot, '.draft', 'temp');
                if (!(await fs.stat(tempDir).catch(() => false))) {
                    await fs.mkdir(tempDir, { recursive: true });
                }

                const ext = path.extname(relativePath);
                const name = path.basename(relativePath, ext);
                // timestamp to avoid collisions
                const tempFile = path.join(tempDir, `${name}_v${versionId}_${Date.now()}${ext}`);

                await dcs.extractFile(versionId, relativePath, tempFile);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: tempFile }));
                return;
            }

            // Restore (overwrite)
            if (url.pathname === '/draft/restore' && req.method === 'POST') {
                const { projectRoot, versionId } = await getBody();
                const dcs = new DraftControlSystem(projectRoot);
                await dcs.restore(versionId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }

            // Rename Version
            if (url.pathname === '/draft/rename-version' && req.method === 'POST') {
                const { projectRoot, versionId, newLabel } = await getBody();
                const dcs = new DraftControlSystem(projectRoot);
                await dcs.renameVersion(versionId, newLabel);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }

            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not Found' }));

        } catch (e: any) {
            console.error("API Server Error:", e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
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
