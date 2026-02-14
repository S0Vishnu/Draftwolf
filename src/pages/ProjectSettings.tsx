import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import CustomPopup from '../components/CustomPopup';
import { Settings as SettingsIcon, ChevronLeft, FolderOpen, EyeOff, X, RotateCcw } from 'lucide-react';
import { IGNORE_PRESETS, mergePatterns } from '../utils/ignorePatterns';
import '../styles/AppLayout.css';
import '../styles/Settings.css';

const ProjectSettings: React.FC = () => {
    const [user] = useAuthState(auth);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('isSidebarOpen') !== 'false');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const projectPath = searchParams.get('path');

    // State for local storage data
    const [pinnedFolders, setPinnedFolders] = useState<{ path: string, name: string, color?: string }[]>([]);
    const [recentWorkspaces, setRecentWorkspaces] = useState<{ path: string, name: string }[]>([]);
    const [backupPath, setBackupPath] = useState<string>('');
    const [deletePopupOpen, setDeletePopupOpen] = useState(false);
    const [ignorePatterns, setIgnorePatterns] = useState<string[]>([]);
    const [ignorePatternsText, setIgnorePatternsText] = useState<string>('');
    const [activePresets, setActivePresets] = useState<string[]>([]);


    useEffect(() => {
        const pinned = JSON.parse(localStorage.getItem('pinnedFolders') || '[]');
        const recents = JSON.parse(localStorage.getItem('recentWorkspaces') || '[]');
        setPinnedFolders(pinned);
        setRecentWorkspaces(recents);

        // Normalize for comparison
        const normProjectPath = projectPath?.toLowerCase().replaceAll('\\', '/');

        // Get backup path from pinned or recent
        const pinnedFolder = pinned.find((f: any) => f.path.toLowerCase().replaceAll('\\', '/') === normProjectPath);
        const recentFolder = recents.find((r: any) => r.path.toLowerCase().replaceAll('\\', '/') === normProjectPath);
        const foundBackupPath = pinnedFolder?.backupPath || recentFolder?.backupPath || '';
        setBackupPath(foundBackupPath);

        // Fetch from metadata.json first, then fallback to localStorage
        const fetchProjectDetails = async () => {
            if (!projectPath) return;

            try {
                // @ts-ignore
                const projectMeta = await globalThis.api.draft.getProjectMetadata(projectPath, foundBackupPath);

                if (projectMeta) {
                    setSettings({
                        projectName: projectMeta.name || projectMeta.projectName || 'Project',
                        color: projectMeta.color || '#3b82f6',
                        isPinned: pinnedFolder ? true : false,
                        showHiddenFiles: projectMeta.showHiddenFiles ?? (localStorage.getItem('showHiddenFiles') === 'true'),
                        showExtensions: projectMeta.showExtensions ?? (localStorage.getItem('showExtensions') !== 'false')
                    });
                    // Load ignore patterns from metadata
                    if (projectMeta.ignorePatterns) {
                        setIgnorePatterns(projectMeta.ignorePatterns);
                        setIgnorePatternsText(projectMeta.ignorePatterns.join('\n'));
                    }
                    if (projectMeta.activePresets) {
                        setActivePresets(projectMeta.activePresets);
                    }
                } else {
                    // Fallback to existing logic
                    const folder = pinnedFolder;
                    if (folder) {
                        setSettings({
                            projectName: folder.name,
                            color: folder.color || '#3b82f6',
                            isPinned: true,
                            showHiddenFiles: folder.showHiddenFiles ?? (localStorage.getItem('showHiddenFiles') === 'true'),
                            showExtensions: folder.showExtensions ?? (localStorage.getItem('showExtensions') !== 'false')
                        });
                    } else {
                        setSettings({
                            projectName: recentFolder?.name || projectPath?.split(/[\\/]/).pop() || 'Project',
                            color: '#3b82f6',
                            isPinned: false,
                            showHiddenFiles: localStorage.getItem('showHiddenFiles') === 'true',
                            showExtensions: localStorage.getItem('showExtensions') !== 'false'
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to fetch project metadata:", err);
            }
        };

        fetchProjectDetails();
    }, [projectPath]);

    const [settings, setSettings] = useState({
        projectName: '',
        color: '#3b82f6',
        isPinned: false,
        showHiddenFiles: false,
        showExtensions: true
    });

    const toggleSidebar = () => {
        const newState = !isSidebarOpen;
        setIsSidebarOpen(newState);
        localStorage.setItem('isSidebarOpen', String(newState));
    };
    const handleGoToProject = () => {
        if (projectPath) {
            localStorage.setItem('lastPath', projectPath);
            localStorage.setItem('rootDir', projectPath);
            navigate('/home');
        }
    };

    const handleGoToProjects = () => {
        localStorage.removeItem('lastPath');
        localStorage.removeItem('rootDir');
        navigate('/home');
    };

    const handleBack = () => navigate('/home');


    const handleOpenDraftFolder = () => {
        if (!projectPath) return;
        const actualRoot = backupPath || projectPath;
        // Handle path joining safely for different platforms although we are mainly windows currently
        const separator = actualRoot.includes('\\') ? '\\' : '/';
        const draftFolder = actualRoot.endsWith(separator)
            ? `${actualRoot}.draft`
            : `${actualRoot}${separator}.draft`;

        // @ts-ignore
        globalThis.api.openPath(draftFolder).catch(err => {
            console.error("Failed to open .draft folder", err);
            toast.error("Could not open .draft folder");
        });
    };

    const handleClearBackupPath = () => {
        setBackupPath('');
    };

    // Use a ref to prevent saving on initial mount
    const isInitialMount = React.useRef(true);

    const performSave = async () => {
        // Update Pinned Folders
        let updatedPinned = [...pinnedFolders];
        const folderData = {
            path: projectPath || '',
            name: settings.projectName,
            color: settings.color,
            showHiddenFiles: settings.showHiddenFiles,
            showExtensions: settings.showExtensions,
            backupPath: backupPath
        };

        if (settings.isPinned) {
            const index = updatedPinned.findIndex(f => f.path === projectPath);
            if (index !== -1) {
                updatedPinned[index] = folderData;
            } else if (projectPath) {
                updatedPinned.push(folderData);
            }
        } else {
            updatedPinned = updatedPinned.filter(f => f.path !== projectPath);
        }
        localStorage.setItem('pinnedFolders', JSON.stringify(updatedPinned));
        setPinnedFolders(updatedPinned); // Update state to reflect changes in sidebar

        // Update Recent Workspaces
        const updatedRecents = recentWorkspaces.map(r =>
            r.path === projectPath ? { ...r, name: settings.projectName, backupPath: backupPath } : r
        );
        localStorage.setItem('recentWorkspaces', JSON.stringify(updatedRecents));
        setRecentWorkspaces(updatedRecents);

        // Save to metadata.json in .draft folder
        if (projectPath) {
            try {
                // @ts-ignore
                await globalThis.api.draft.saveProjectMetadata(projectPath, {
                    name: settings.projectName,
                    color: settings.color,
                    showHiddenFiles: settings.showHiddenFiles,
                    showExtensions: settings.showExtensions,
                    ignorePatterns: ignorePatterns,
                    activePresets: activePresets,
                    lastUpdated: new Date().toISOString()
                }, backupPath);
            } catch (err) {
                console.error("Failed to save project metadata to file:", err);
            }
        }
    };

    // Auto-save effect
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        const timer = setTimeout(() => {
            performSave();
        }, 800); // 800ms debounce

        return () => clearTimeout(timer);
    }, [settings, backupPath, projectPath, ignorePatterns, activePresets]);

    const handleDelete = () => {
        setDeletePopupOpen(true);
    };

    const confirmDelete = () => {
        const updatedPinned = pinnedFolders.filter(f => f.path !== projectPath);
        const updatedRecents = recentWorkspaces.filter(r => r.path !== projectPath);
        localStorage.setItem('pinnedFolders', JSON.stringify(updatedPinned));
        localStorage.setItem('recentWorkspaces', JSON.stringify(updatedRecents));
        setDeletePopupOpen(false);
        navigate('/home');
    };

    return (
        <div className="app-shell">
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                user={user}
                pinnedFolders={pinnedFolders}
                activePath={projectPath}
                onSelectProject={(path) => navigate(`/project-settings?path=${encodeURIComponent(path)}`)}
            />

            <main className="main-content">
                <Header
                    isSidebarOpen={isSidebarOpen}
                    toggleSidebar={toggleSidebar}
                />

                <div className="toolbar">
                    <div className="path-breadcrumbs">
                        <button className="nav-btn" onClick={handleBack} title="Back to Home">
                            <ChevronLeft size={18} />
                        </button>
                        <div className="divider-v" />
                        <div className="breadcrumbs-list">
                            <span
                                className="crumb-home clickable"
                                onClick={handleGoToProjects}
                                style={{ cursor: 'pointer' }}
                            >
                                Projects
                            </span>
                            <span className="crumb-sep">/</span>
                            <span
                                className="crumb-part clickable"
                                onClick={handleGoToProject}
                                style={{ cursor: 'pointer' }}
                            >
                                {settings.projectName}
                            </span>
                            <span className="crumb-sep">/</span>
                            <span className="crumb-part" style={{ color: 'var(--accent)' }}>Settings</span>
                        </div>
                    </div>
                </div>

                <div className="content-area" style={{ padding: '40px' }}>
                    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
                        <header style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '16px',
                                background: `linear-gradient(135deg, ${settings.color}22, ${settings.color}11)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `1px solid ${settings.color}33`,
                                boxShadow: `0 4px 12px ${settings.color}11`
                            }}>
                                <SettingsIcon size={28} color={settings.color} />
                            </div>
                            <div>
                                <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: 'white' }}>
                                    {settings.projectName}
                                </h1>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px', opacity: 0.8 }}>
                                    Configuration & Project Identity
                                </p>
                            </div>
                        </header>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* General Section */}
                            <section className="settings-section">
                                <div className="section-header">
                                    <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, opacity: 0.9 }}>Appearance & Identity</h2>
                                </div>
                                <div className="section-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <label htmlFor="project-name-input" style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>Project Name</label>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>How this project appears in your sidebar and recent list.</p>
                                        </div>
                                        <input
                                            id="project-name-input"
                                            type="text"
                                            className="input-styled"
                                            style={{
                                                width: '100%',
                                                margin: 0,
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid var(--border)',
                                                height: '42px',
                                                padding: '0 16px',
                                                borderRadius: '10px',
                                                fontSize: '14px',
                                                color: 'white'
                                            }}
                                            value={settings.projectName}
                                            onChange={(e) => setSettings({ ...settings, projectName: e.target.value })}
                                        />
                                    </div>

                                    <div className="setting-row">
                                        <span style={{ fontWeight: 600, display: 'block', marginBottom: '12px' }}>Project Color</span>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#6366f1'].map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setSettings({ ...settings, color: c })}
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '8px',
                                                        background: c,
                                                        border: settings.color === c ? '2px solid white' : 'none',
                                                        cursor: 'pointer',
                                                        transition: 'transform 0.2s',
                                                        boxShadow: settings.color === c ? `0 0 10px ${c}` : 'none'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                        <div>
                                            <label htmlFor="pin-toggle" style={{ fontWeight: 600 }}>Pin to Sidebar</label>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keep this project accessible in the PROJECTS section.</p>
                                        </div>
                                        <input
                                            id="pin-toggle"
                                            type="checkbox"
                                            checked={settings.isPinned}
                                            onChange={(e) => setSettings({ ...settings, isPinned: e.target.checked })}
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Preferences Section */}
                            <section className="settings-section">
                                <div className="section-header">
                                    <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, opacity: 0.9 }}>Project Preferences</h2>
                                </div>
                                <div className="section-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <label htmlFor="pref-hidden" style={{ fontWeight: 600 }}>Show Hidden Files</label>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Show files starting with a dot (e.g. .env, .git)</p>
                                        </div>
                                        <input
                                            id="pref-hidden"
                                            type="checkbox"
                                            checked={settings.showHiddenFiles}
                                            onChange={(e) => setSettings({ ...settings, showHiddenFiles: e.target.checked })}
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                        <div>
                                            <label htmlFor="pref-ext" style={{ fontWeight: 600 }}>Show File Extensions</label>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Always display full file extensions</p>
                                        </div>
                                        <input
                                            id="pref-ext"
                                            type="checkbox"
                                            checked={settings.showExtensions}
                                            onChange={(e) => setSettings({ ...settings, showExtensions: e.target.checked })}
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Storage & Paths Section */}
                            <section className="settings-section">
                                <div className="section-header">
                                    <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, opacity: 0.9 }}>Storage & Paths</h2>
                                </div>
                                <div className="section-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="setting-row">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <FolderOpen size={16} color="#6e7bf2" />
                                            <span style={{ fontWeight: 600 }}>Backup Location</span>
                                        </div>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Where project backups are stored. Set during first open.</p>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                            <div style={{
                                                flex: 1,
                                                padding: '10px 14px',
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                borderRadius: '10px',
                                                fontSize: '13px',
                                                color: backupPath ? 'var(--text-secondary, #d4d4d8)' : 'var(--text-muted)',
                                                wordBreak: 'break-all' as const,
                                                opacity: 0.9,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span title={backupPath ? "Custom backup location" : "Default project root"}>
                                                    {(() => {
                                                        const actualRoot = backupPath || projectPath || '';
                                                        if (!actualRoot) return 'Path not found';
                                                        return actualRoot
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Ignore Patterns Section */}
                            <section className="settings-section">
                                <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, opacity: 0.9, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <EyeOff size={16} color="#a78bfa" />
                                        Ignore Patterns
                                    </h2>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7 }}>
                                        .gitignore syntax
                                    </span>
                                </div>
                                <div className="section-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Description */}
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                                        Files and folders matching these patterns will be hidden from the file browser.
                                        Uses <code style={{
                                            background: 'rgba(168, 139, 250, 0.15)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            color: '#c4b5fd'
                                        }}>.gitignore</code> syntax. Great for large projects like Unreal Engine, Unity, etc.
                                    </p>

                                    {/* Presets */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <label style={{ fontWeight: 600, fontSize: '13px' }}>Quick Presets</label>
                                            {activePresets.length > 0 && (
                                                <button
                                                    onClick={() => {
                                                        setActivePresets([]);
                                                        setIgnorePatterns([]);
                                                        setIgnorePatternsText('');
                                                    }}
                                                    className="ignore-clear-btn"
                                                    title="Clear all patterns"
                                                >
                                                    <RotateCcw size={12} />
                                                    Clear All
                                                </button>
                                            )}
                                        </div>

                                        {/* Active preset tags */}
                                        {activePresets.length > 0 && (
                                            <div className="ignore-active-presets">
                                                {activePresets.map(presetId => {
                                                    const preset = IGNORE_PRESETS.find(p => p.id === presetId);
                                                    if (!preset) return null;
                                                    return (
                                                        <span key={presetId} className="ignore-preset-tag">
                                                            <span>{preset.icon}</span>
                                                            <span>{preset.name}</span>
                                                            <button
                                                                className="ignore-tag-remove"
                                                                onClick={() => {
                                                                    const newPresets = activePresets.filter(id => id !== presetId);
                                                                    setActivePresets(newPresets);
                                                                    // Rebuild patterns from remaining presets
                                                                    let rebuilt: string[] = [];
                                                                    for (const id of newPresets) {
                                                                        const p = IGNORE_PRESETS.find(pr => pr.id === id);
                                                                        if (p) rebuilt = mergePatterns(rebuilt, p.patterns);
                                                                    }
                                                                    // Add any custom patterns (lines not from presets)
                                                                    const customLines = ignorePatternsText.split('\n').filter(line => {
                                                                        const trimmed = line.trim();
                                                                        if (!trimmed || trimmed.startsWith('#')) return false;
                                                                        return !IGNORE_PRESETS.some(pr => pr.patterns.includes(trimmed));
                                                                    });
                                                                    rebuilt = mergePatterns(rebuilt, customLines);
                                                                    setIgnorePatterns(rebuilt);
                                                                    setIgnorePatternsText(rebuilt.join('\n'));
                                                                }}
                                                                title={`Remove ${preset.name} preset`}
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Preset picker grid */}
                                        <div className="ignore-preset-grid">
                                            {IGNORE_PRESETS.map(preset => {
                                                const isActive = activePresets.includes(preset.id);
                                                return (
                                                    <button
                                                        key={preset.id}
                                                        className={`ignore-preset-card ${isActive ? 'active' : ''}`}
                                                        onClick={() => {
                                                            if (isActive) {
                                                                // Remove preset
                                                                const newPresets = activePresets.filter(id => id !== preset.id);
                                                                setActivePresets(newPresets);
                                                                // Rebuild patterns
                                                                let rebuilt: string[] = [];
                                                                for (const id of newPresets) {
                                                                    const p = IGNORE_PRESETS.find(pr => pr.id === id);
                                                                    if (p) rebuilt = mergePatterns(rebuilt, p.patterns);
                                                                }
                                                                setIgnorePatterns(rebuilt);
                                                                setIgnorePatternsText(rebuilt.join('\n'));
                                                            } else {
                                                                // Add preset
                                                                const newPresets = [...activePresets, preset.id];
                                                                setActivePresets(newPresets);
                                                                const merged = mergePatterns(ignorePatterns, preset.patterns);
                                                                setIgnorePatterns(merged);
                                                                setIgnorePatternsText(merged.join('\n'));
                                                                toast.success(`Added ${preset.name} preset`);
                                                            }
                                                        }}
                                                        title={preset.description}
                                                    >
                                                        <span className="ignore-preset-icon">{preset.icon}</span>
                                                        <span className="ignore-preset-name">{preset.name}</span>
                                                        {isActive && <span className="ignore-preset-check">✓</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Patterns textarea */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <label htmlFor="ignore-patterns" style={{ fontWeight: 600, fontSize: '13px' }}>Custom Patterns</label>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {ignorePatterns.filter(p => p.trim() && !p.startsWith('#')).length} active rules
                                            </span>
                                        </div>
                                        <div className="ignore-editor-wrap">
                                            <textarea
                                                id="ignore-patterns"
                                                className="ignore-textarea"
                                                value={ignorePatternsText}
                                                onChange={(e) => {
                                                    const text = e.target.value;
                                                    setIgnorePatternsText(text);
                                                    const patterns = text.split('\n').filter(l => l.trim());
                                                    setIgnorePatterns(patterns);
                                                }}
                                                placeholder={`# Add patterns to ignore\n# Example:\nnode_modules/\n*.log\nbuild/\n.cache/`}
                                                rows={8}
                                                spellCheck={false}
                                            />
                                            <div className="ignore-editor-hint">
                                                <span>💡 <strong>*</strong> any file &nbsp;·&nbsp; <strong>**</strong> any depth &nbsp;·&nbsp; <strong>/</strong> directories &nbsp;·&nbsp; <strong>!</strong> negate &nbsp;·&nbsp; <strong>#</strong> comment</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Active pattern count summary */}
                                    {ignorePatterns.length > 0 && (
                                        <div className="ignore-summary">
                                            <EyeOff size={14} />
                                            <span>
                                                {ignorePatterns.filter(p => p.trim() && !p.startsWith('#')).length} patterns active
                                                {activePresets.length > 0 && ` from ${activePresets.length} preset${activePresets.length > 1 ? 's' : ''}`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Danger Zone */}
                            <section style={{ border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', overflow: 'hidden' }}>
                                <div style={{ padding: '16px 20px', background: 'rgba(239, 68, 68, 0.05)', borderBottom: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                    <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#ef4444', margin: 0 }}>Danger Zone</h2>
                                </div>
                                <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Remove Project</h3>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>This will remove the project from your lists. Files on disk will NOT be deleted.</p>
                                    </div>
                                    <button
                                        onClick={handleDelete}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            border: '1px solid #ef4444',
                                            background: 'transparent',
                                            color: '#ef4444',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Remove Reference
                                    </button>
                                </div>
                            </section>

                            <div style={{ height: '40px' }} />
                        </div>
                    </div>
                </div>
            </main>

            <CustomPopup
                isOpen={deletePopupOpen}
                title="Remove Project"
                message="Remove this project from recents and pinned folders? Files on disk will NOT be deleted."
                confirmText="Remove"
                cancelText="Cancel"
                isDangerous={true}
                onConfirm={confirmDelete}
                onCancel={() => setDeletePopupOpen(false)}
            />
        </div>
    );
};

export default ProjectSettings;
