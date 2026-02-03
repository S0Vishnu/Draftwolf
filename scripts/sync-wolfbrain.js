/**
 * Wolfbrain Auto-Sync Script
 * Automatically syncs Wolfbrain updates from the GitHub repository
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WOLFBRAIN_REPO = 'https://github.com/S0Vishnu/WolfBrain.git';
const TEMP_DIR = path.join(__dirname, '..', 'temp-wolfbrain-sync');
const PROJECT_ROOT = path.join(__dirname, '..');

// Files to sync
const SYNC_MAP = [
    {
        source: 'src/pages/WolfbrainPage.tsx',
        dest: 'src/pages/WolfbrainPage.tsx'
    },
    {
        source: 'src/styles/Wolfbrain.css',
        dest: 'src/styles/Wolfbrain.css'
    }
];

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
    try {
        return execSync(command, {
            stdio: 'pipe',
            encoding: 'utf-8',
            ...options
        });
    } catch (error) {
        throw new Error(`Command failed: ${command}\n${error.message}`);
    }
}

function cleanupTempDir() {
    if (fs.existsSync(TEMP_DIR)) {
        log('🧹 Cleaning up temporary directory...', 'yellow');
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
}

function cloneWolfbrain() {
    log('📥 Cloning WolfBrain repository...', 'blue');
    exec(`git clone --depth 1 ${WOLFBRAIN_REPO} "${TEMP_DIR}"`);
    log('✅ Repository cloned successfully', 'green');
}

function getLocalVersion() {
    const versionFile = path.join(PROJECT_ROOT, '.wolfbrain-version');
    if (fs.existsSync(versionFile)) {
        return fs.readFileSync(versionFile, 'utf-8').trim();
    }
    return null;
}

function getRemoteVersion() {
    const gitDir = path.join(TEMP_DIR, '.git');
    const commit = exec('git rev-parse HEAD', { cwd: TEMP_DIR }).trim();
    return commit;
}

function saveVersion(version) {
    const versionFile = path.join(PROJECT_ROOT, '.wolfbrain-version');
    fs.writeFileSync(versionFile, version, 'utf-8');
    log(`💾 Saved version: ${version.substring(0, 7)}`, 'green');
}

function backupFile(filePath) {
    if (fs.existsSync(filePath)) {
        const backupPath = `${filePath}.backup`;
        fs.copyFileSync(filePath, backupPath);
        log(`📦 Backed up: ${path.basename(filePath)}`, 'yellow');
    }
}

function syncFiles() {
    log('🔄 Syncing files...', 'blue');

    let syncedCount = 0;

    for (const { source, dest } of SYNC_MAP) {
        const sourcePath = path.join(TEMP_DIR, source);
        const destPath = path.join(PROJECT_ROOT, dest);

        if (!fs.existsSync(sourcePath)) {
            log(`⚠️  Source file not found: ${source}`, 'yellow');
            continue;
        }

        // Backup existing file
        backupFile(destPath);

        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(sourcePath, destPath);
        log(`✅ Synced: ${dest}`, 'green');
        syncedCount++;
    }

    return syncedCount;
}

function checkForUpdates() {
    log('\n🔍 Checking for Wolfbrain updates...', 'blue');

    const localVersion = getLocalVersion();

    try {
        // Clone repository
        cloneWolfbrain();

        const remoteVersion = getRemoteVersion();

        if (localVersion === remoteVersion) {
            log('✅ Wolfbrain is up to date!', 'green');
            log(`   Current version: ${remoteVersion.substring(0, 7)}`, 'blue');
            cleanupTempDir();
            return false;
        }

        log('🆕 New version available!', 'yellow');
        log(`   Local:  ${localVersion ? localVersion.substring(0, 7) : 'none'}`, 'yellow');
        log(`   Remote: ${remoteVersion.substring(0, 7)}`, 'green');

        return { localVersion, remoteVersion };
    } catch (error) {
        log(`❌ Error checking for updates: ${error.message}`, 'red');
        cleanupTempDir();
        throw error;
    }
}

function performSync() {
    try {
        const updateInfo = checkForUpdates();

        if (!updateInfo) {
            return; // Already up to date
        }

        log('\n📦 Starting sync process...', 'blue');

        const syncedCount = syncFiles();

        if (syncedCount > 0) {
            saveVersion(updateInfo.remoteVersion);
            log(`\n✅ Successfully synced ${syncedCount} file(s)!`, 'green');
            log('💡 Backup files created with .backup extension', 'yellow');
            log('🔄 Please restart the application to see changes', 'blue');
        } else {
            log('\n⚠️  No files were synced', 'yellow');
        }

    } catch (error) {
        log(`\n❌ Sync failed: ${error.message}`, 'red');
        process.exit(1);
    } finally {
        cleanupTempDir();
    }
}

// Run sync
if (require.main === module) {
    log('╔════════════════════════════════════════╗', 'blue');
    log('║   Wolfbrain Auto-Sync Utility         ║', 'blue');
    log('╚════════════════════════════════════════╝', 'blue');

    performSync();
}

module.exports = { checkForUpdates, performSync, cleanupTempDir };
