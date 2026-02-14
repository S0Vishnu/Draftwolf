/**
 * Ignore Patterns Utility
 * Provides .gitignore-style pattern matching and project presets.
 */

export interface IgnorePreset {
    id: string;
    name: string;
    icon: string;
    description: string;
    patterns: string[];
}

/**
 * Convert a .gitignore-style pattern into a RegExp.
 * Supports: *, **, ?, directory-only trailing /, negation !, comments #
 */
export function patternToRegex(pattern: string): RegExp | null {
    let p = pattern.trim();

    // Skip empty lines and comments
    if (!p || p.startsWith('#')) return null;

    // Remove negation prefix (handled separately)
    if (p.startsWith('!')) return null;

    // Remove trailing slash (it means "directory only" but we handle that in matching)
    const dirOnly = p.endsWith('/');
    if (dirOnly) p = p.slice(0, -1);

    // If pattern doesn't contain '/', it can match at any depth
    const hasSlash = p.includes('/');

    // Remove leading slash
    if (p.startsWith('/')) p = p.substring(1);

    // Escape regex special chars except * and ?
    let regex = p.replaceAll(/[.+^${}()|[\]\\]/g, '\\$&');

    // Handle ** (match any depth)
    regex = regex.replaceAll('**', '{{GLOBSTAR}}');

    // Handle * (match anything except /)
    regex = regex.replaceAll('*', '[^/]*');

    // Handle ? (match single char except /)
    regex = regex.replaceAll('?', '[^/]');

    // Restore globstar
    regex = regex.replaceAll('{{GLOBSTAR}}', '.*');

    if (hasSlash) {
        regex = '^' + regex + '(/.*)?$';
    } else {
        regex = '(^|.*/)' + regex + '(/.*)?$';
    }

    try {
        return new RegExp(regex, 'i');
    } catch {
        return null;
    }
}

/**
 * Parse ignore patterns text into an array of patterns,
 * filtering out comments and empty lines.
 */
export function parseIgnorePatterns(text: string): string[] {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
}

/**
 * Check if a relative path should be ignored based on ignore patterns.
 * @param relativePath - Path relative to project root (forward slashes)
 * @param patterns - Array of .gitignore-style patterns
 * @returns true if the path should be ignored
 */
export function shouldIgnore(relativePath: string, patterns: string[]): boolean {
    // Normalize the path to forward slashes
    const normalized = relativePath.replaceAll('\\', '/');

    let ignored = false;

    for (const pattern of patterns) {
        const trimmed = pattern.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        if (trimmed.startsWith('!')) {
            // Negation pattern
            const negRegex = patternToRegex(trimmed.substring(1));
            if (negRegex?.test(normalized)) {
                ignored = false;
            }
        } else {
            const regex = patternToRegex(trimmed);
            if (regex?.test(normalized)) {
                ignored = true;
            }
        }
    }

    return ignored;
}

/**
 * Check if a file entry should be shown based on ignore patterns.
 * Works with the name of the entry (for top-level matching) and relative path.
 */
export function shouldShowEntry(
    entryName: string,
    entryRelativePath: string,
    ignorePatterns: string[]
): boolean {
    if (!ignorePatterns.length) return true;

    // Check against both the name and the relative path
    const normalizedPath = entryRelativePath.replaceAll('\\', '/');

    return !shouldIgnore(normalizedPath, ignorePatterns) &&
        !shouldIgnore(entryName, ignorePatterns);
}


// ─── Presets ────────────────────────────────────────────────────────────

export const IGNORE_PRESETS: IgnorePreset[] = [
    {
        id: 'unreal',
        name: 'Unreal Engine',
        icon: '🎮',
        description: 'Ignore Unreal Engine build artifacts, intermediate files, and saved data',
        patterns: [
            '# Unreal Engine',
            'Binaries/',
            'DerivedDataCache/',
            'Intermediate/',
            'Saved/',
            'Build/',
            '*.sln',
            '*.suo',
            '*.opensdf',
            '*.sdf',
            '*.VC.db',
            '*.VC.opendb',
            '*.vcxproj',
            '*.vcxproj.filters',
            '*.vcxproj.user',
            '.vs/',
            '*.log',
            '*.pdb',
        ],
    },
    {
        id: 'unity',
        name: 'Unity',
        icon: '🕹️',
        description: 'Ignore Unity build output, library cache, and temp files',
        patterns: [
            '# Unity',
            '[Ll]ibrary/',
            '[Tt]emp/',
            '[Oo]bj/',
            '[Bb]uild/',
            '[Bb]uilds/',
            '[Ll]ogs/',
            '[Mm]emoryCaptures/',
            'UserSettings/',
            '*.csproj',
            '*.unityproj',
            '*.sln',
            '*.suo',
            '*.user',
            '*.pidb',
            '*.booproj',
            'Crashlytics/',
            'sysinfo.txt',
            '*.apk',
            '*.aab',
            '*.unitypackage',
        ],
    },
    {
        id: 'godot',
        name: 'Godot',
        icon: '🤖',
        description: 'Ignore Godot engine cache and export files',
        patterns: [
            '# Godot',
            '.godot/',
            '.import/',
            'export_presets.cfg',
            '*.translation',
            '*.import',
        ],
    },
    {
        id: 'nodejs',
        name: 'Node.js',
        icon: '📦',
        description: 'Ignore node_modules, build output, and environment files',
        patterns: [
            '# Node.js',
            'node_modules/',
            'dist/',
            'build/',
            '.cache/',
            '.parcel-cache/',
            '.next/',
            '.nuxt/',
            '.output/',
            'out/',
            '*.log',
            '.env',
            '.env.local',
            '.env.*.local',
            'coverage/',
            '.nyc_output/',
        ],
    },
    {
        id: 'python',
        name: 'Python',
        icon: '🐍',
        description: 'Ignore Python virtual envs, bytecode, and dist artifacts',
        patterns: [
            '# Python',
            '__pycache__/',
            '*.py[cod]',
            '*$py.class',
            'venv/',
            '.venv/',
            'env/',
            '.env/',
            '*.egg-info/',
            'dist/',
            'build/',
            '*.egg',
            '.tox/',
            '.pytest_cache/',
            '.mypy_cache/',
        ],
    },
    {
        id: 'blender',
        name: 'Blender',
        icon: '🎨',
        description: 'Ignore Blender temporary and backup files',
        patterns: [
            '# Blender',
            '*.blend1',
            '*.blend2',
            '*.blend3',
            '*.blend4',
            '*.blend5',
            'tmp/',
        ],
    },
    {
        id: 'general',
        name: 'General',
        icon: '📁',
        description: 'Common OS and editor files to ignore',
        patterns: [
            '# General',
            '.DS_Store',
            'Thumbs.db',
            'desktop.ini',
            '*.tmp',
            '*.bak',
            '*.swp',
            '*.swo',
            '*~',
            '.idea/',
            '.vscode/',
            '*.log',
        ],
    },
];

/**
 * Returns the default patterns text for a given preset id.
 */
export function getPresetPatterns(presetId: string): string[] {
    const preset = IGNORE_PRESETS.find(p => p.id === presetId);
    return preset ? preset.patterns : [];
}

/**
 * Merge patterns from multiple presets, deduplicating.
 */
export function mergePatterns(existingPatterns: string[], newPatterns: string[]): string[] {
    const seen = new Set(existingPatterns.map(p => p.trim()));
    const merged = [...existingPatterns];

    for (const p of newPatterns) {
        const trimmed = p.trim();
        if (!seen.has(trimmed)) {
            merged.push(trimmed);
            seen.add(trimmed);
        }
    }

    return merged;
}
