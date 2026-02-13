import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    X, Heart, Coffee, ExternalLinkIcon,
    Search, ListTodo, Brush, Puzzle, BookOpen, RotateCcw,
    Layers, Eye, Bell, HardDrive, Paperclip, FolderOpen,
    Keyboard, Info, Zap, RotateCw, Settings
} from 'lucide-react';
import logo from '../assets/logo_full.svg';
import '../styles/HelpModal.css';
import {
    ShortcutDef,
    loadShortcuts,
    saveShortcuts,
    resetShortcuts,
    CATEGORY_LABELS,
    formatKeyCombo,
    eventToCombo,
} from '../utils/shortcuts';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type HelpTab = 'features' | 'shortcuts' | 'quickstart' | 'about';

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const [appVersion, setAppVersion] = useState("1.1.8");
    const [activeTab, setActiveTab] = useState<HelpTab>('features');

    // Shortcuts state
    const [shortcuts, setShortcuts] = useState<ShortcutDef[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pendingCombo, setPendingCombo] = useState<string>('');
    const [searchFilter, setSearchFilter] = useState('');

    useEffect(() => {
        if (isOpen) {
            setShortcuts(loadShortcuts());
        }
    }, [isOpen]);

    useEffect(() => {
        if ((globalThis as any).api?.getAppVersion) {
            (globalThis as any).api.getAppVersion().then((v: string) => setAppVersion(v));
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (editingId) return; // don't close while editing
            if (e.key === 'Escape') onClose();
        };
        globalThis.addEventListener('keydown', handleKeyDown);
        return () => globalThis.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, editingId]);

    // Shortcut editing key capture
    const handleEditKeyDown = useCallback((e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Ignore standalone modifier keys
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        if (e.key === 'Escape') {
            setEditingId(null);
            setPendingCombo('');
            return;
        }
        const combo = eventToCombo(e);
        setPendingCombo(combo);
    }, []);

    useEffect(() => {
        if (editingId) {
            globalThis.addEventListener('keydown', handleEditKeyDown, true);
            return () => globalThis.removeEventListener('keydown', handleEditKeyDown, true);
        }
    }, [editingId, handleEditKeyDown]);

    const confirmEdit = () => {
        if (!editingId || !pendingCombo) return;
        const updated = shortcuts.map(s =>
            s.id === editingId ? { ...s, keys: pendingCombo } : s
        );
        setShortcuts(updated);
        saveShortcuts(updated);
        setEditingId(null);
        setPendingCombo('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setPendingCombo('');
    };

    const handleReset = () => {
        const fresh = resetShortcuts();
        setShortcuts(fresh);
    };

    const resetSingle = (id: string) => {
        const updated = shortcuts.map(s =>
            s.id === id ? { ...s, keys: s.defaultKeys } : s
        );
        setShortcuts(updated);
        saveShortcuts(updated);
    };

    const handleOpenLink = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
        e.preventDefault();
        if ((globalThis as any).api?.openExternal) {
            (globalThis as any).api.openExternal(url);
        } else {
            globalThis.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    if (!isOpen) return null;

    const filteredShortcuts = searchFilter
        ? shortcuts.filter(s =>
            s.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
            s.keys.toLowerCase().includes(searchFilter.toLowerCase()) ||
            CATEGORY_LABELS[s.category]?.toLowerCase().includes(searchFilter.toLowerCase())
        )
        : shortcuts;

    // Group shortcuts by category
    const grouped: Record<string, ShortcutDef[]> = {};
    for (const sc of filteredShortcuts) {
        (grouped[sc.category] ??= []).push(sc);
    }

    const tabs: { key: HelpTab; icon: React.ReactNode; label: string }[] = [
        { key: 'features', icon: <Zap size={14} />, label: 'Features' },
        { key: 'shortcuts', icon: <Keyboard size={14} />, label: 'Shortcuts' },
        { key: 'quickstart', icon: <BookOpen size={14} />, label: 'Quick Start' },
        { key: 'about', icon: <Info size={14} />, label: 'About' },
    ];

    return (
        <div className="help-modal-overlay" onClick={onClose}>
            <div className="help-modal-dialog" onClick={e => e.stopPropagation()} ref={dialogRef}>
                <div className="help-modal-header">
                    <div className="help-tab-bar">
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                className={`help-tab-btn ${activeTab === t.key ? 'active' : ''}`}
                                onClick={() => setActiveTab(t.key)}
                            >
                                {t.icon}
                                <span>{t.label}</span>
                            </button>
                        ))}
                    </div>
                    <button className="help-modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="help-modal-content">
                    {/* ═══════ Features Tab ═══════ */}
                    {activeTab === 'features' && (
                        <div className="help-tab-content">
                            <div className="help-section-title">All Features</div>
                            <div className="feature-list">
                                <FeatureCard icon={<Layers size={18} />} title="Version Control" desc="Create, restore, download, rename, and delete versions of any file. Full branching history with graph view." />
                                <FeatureCard icon={<HardDrive size={18} />} title="Folder Snapshots" desc="Snapshot entire folders at a point in time. Restore complete directory states when needed." />
                                <FeatureCard icon={<Eye size={18} />} title="Visual Diff" desc="Compare image versions with slider, side-by-side, and overlay modes. 3D model diffing with synced cameras." />
                                <FeatureCard icon={<Search size={18} />} title="Inspector Panel" desc="View file properties, manage tasks, handle version history, and attachments in a resizable side panel." />
                                <FeatureCard icon={<ListTodo size={18} />} title="Tasks & Metadata" desc="Attach to-dos with priorities, tags, and version references directly to files. Never lose context." />
                                <FeatureCard icon={<Paperclip size={18} />} title="Attachments" desc="Drag-and-drop reference images and documents directly onto files for quick access." />
                                <FeatureCard icon={<Bell size={18} />} title="Background Monitoring" desc="File change notifications at configurable intervals. Never forget to version your work." />
                                <FeatureCard icon={<Brush size={18} />} title="Storage Cleanup" desc="View storage usage, merge or delete old versions, and manage snapshots to keep your workspace tidy." />
                                <FeatureCard icon={<Puzzle size={18} />} title="Extensions" desc="Connect Blender and other tools via plugins. Extend Draftwolf into your creative pipeline." />
                                <FeatureCard icon={<FolderOpen size={18} />} title="File Browser" desc="Grid and list views with sorting, search, box selection, pinned folders, and quick navigation." />
                                <FeatureCard icon={<Keyboard size={18} />} title="Keyboard Shortcuts" desc="Full keyboard control for every action. Customizable bindings in the Shortcuts tab." />
                                <FeatureCard icon={<Settings size={18} />} title="Project Settings" desc="Per-project backup paths, ignore patterns, and monitoring configuration." />
                            </div>
                        </div>
                    )}

                    {/* ═══════ Shortcuts Tab ═══════ */}
                    {activeTab === 'shortcuts' && (
                        <div className="help-tab-content">
                            <div className="shortcuts-header">
                                <div className="shortcuts-search">
                                    <Search size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search shortcuts..."
                                        value={searchFilter}
                                        onChange={e => setSearchFilter(e.target.value)}
                                        className="shortcuts-search-input"
                                    />
                                </div>
                                <button className="shortcuts-reset-all" onClick={handleReset} title="Reset all to defaults">
                                    <RotateCw size={13} />
                                    <span>Reset All</span>
                                </button>
                            </div>

                            <div className="shortcuts-list">
                                {Object.entries(grouped).map(([cat, items]) => (
                                    <div key={cat} className="shortcut-category">
                                        <div className="shortcut-category-label">{CATEGORY_LABELS[cat] ?? cat}</div>
                                        {items.map(sc => (
                                            <div key={sc.id} className={`shortcut-row ${editingId === sc.id ? 'editing' : ''} ${sc.keys !== sc.defaultKeys ? 'modified' : ''}`}>
                                                <span className="shortcut-label">{sc.label}</span>
                                                <div className="shortcut-keys-area">
                                                    {editingId === sc.id ? (
                                                        <div className="shortcut-capture">
                                                            <span className="shortcut-capture-display">
                                                                {pendingCombo
                                                                    ? formatKeyCombo(pendingCombo).map((k, i) => (
                                                                        <kbd key={i}>{k}</kbd>
                                                                    ))
                                                                    : <span className="shortcut-capture-hint">Press a key combo…</span>
                                                                }
                                                            </span>
                                                            <button className="shortcut-action-btn confirm" onClick={confirmEdit} disabled={!pendingCombo} title="Accept">✓</button>
                                                            <button className="shortcut-action-btn cancel" onClick={cancelEdit} title="Cancel">✕</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                className="shortcut-key-display"
                                                                onClick={() => { setEditingId(sc.id); setPendingCombo(''); }}
                                                                title="Click to edit"
                                                            >
                                                                {formatKeyCombo(sc.keys).map((k, i) => (
                                                                    <kbd key={i}>{k}</kbd>
                                                                ))}
                                                            </button>
                                                            {sc.keys !== sc.defaultKeys && (
                                                                <button className="shortcut-reset-btn" onClick={() => resetSingle(sc.id)} title="Reset to default">
                                                                    <RotateCcw size={11} />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                {filteredShortcuts.length === 0 && (
                                    <div className="shortcuts-empty">No shortcuts match your search.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══════ Quick Start Tab ═══════ */}
                    {activeTab === 'quickstart' && (
                        <div className="help-tab-content">
                            <div className="help-section-title">Getting Started</div>

                            <div className="quickstart-section">
                                <h4>Creating Versions</h4>
                                <div className="guide-steps">
                                    <div className="step"><span className="step-num">1</span><p>Open a folder and select a file in the file browser.</p></div>
                                    <div className="step"><span className="step-num">2</span><p>Open the <strong>Inspector Panel</strong> by clicking a file or pressing <kbd>Ctrl</kbd>+<kbd>I</kbd>.</p></div>
                                    <div className="step"><span className="step-num">3</span><p>Switch to the <strong>Versions</strong> tab <span className="icon-inline"><Layers size={12} /></span>.</p></div>
                                    <div className="step"><span className="step-num">4</span><p>Click <strong>+ New Version</strong>, give it a label, and hit <strong>Commit</strong>.</p></div>
                                    <div className="step"><span className="step-num">5</span><p>Use <strong>Restore</strong> <span className="icon-inline"><RotateCcw size={12} /></span> to revert to any version anytime.</p></div>
                                </div>
                            </div>

                            <div className="quickstart-section">
                                <h4>Comparing Versions</h4>
                                <div className="guide-steps">
                                    <div className="step"><span className="step-num">1</span><p>In the Versions tab, click the <strong>Compare</strong> <span className="icon-inline"><Eye size={12} /></span> icon on any version.</p></div>
                                    <div className="step"><span className="step-num">2</span><p>The visual diff viewer opens with <strong>Slider</strong>, <strong>Side-by-Side</strong>, and <strong>Overlay</strong> modes.</p></div>
                                    <div className="step"><span className="step-num">3</span><p>For 3D models (.glb, .gltf, .obj), you get a synchronized split-screen 3D viewer.</p></div>
                                </div>
                            </div>

                            <div className="quickstart-section">
                                <h4>File Management</h4>
                                <div className="guide-steps">
                                    <div className="step"><span className="step-num">•</span><p>Use <kbd>Ctrl</kbd>+<kbd>N</kbd> for new files, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd> for new folders.</p></div>
                                    <div className="step"><span className="step-num">•</span><p>Press <kbd>F2</kbd> to rename, <kbd>Delete</kbd> to remove files.</p></div>
                                    <div className="step"><span className="step-num">•</span><p>Use <kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>X</kbd>/<kbd>V</kbd> for copy/cut/paste operations.</p></div>
                                    <div className="step"><span className="step-num">•</span><p>Click + drag for box selection, hold <kbd>Ctrl</kbd> for multi-select.</p></div>
                                </div>
                            </div>

                            <div className="quickstart-section">
                                <h4>Background Monitoring</h4>
                                <div className="guide-steps">
                                    <div className="step"><span className="step-num">1</span><p>Go to <strong>Settings</strong> → <strong>File Monitoring</strong>.</p></div>
                                    <div className="step"><span className="step-num">2</span><p>Enable background monitoring and set your notification interval.</p></div>
                                    <div className="step"><span className="step-num">3</span><p>Draftwolf will notify you about file changes even when minimized.</p></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══════ About Tab ═══════ */}
                    {activeTab === 'about' && (
                        <div className="help-tab-content about-tab">
                            <div className="help-section intro">
                                <div className="app-logo">
                                    <img src={logo} alt="Draftwolf Logo" className="logo-image" />
                                </div>
                                <p className="version">Version {appVersion}</p>
                                <p className="about-tagline">
                                    Local version control for your creative files — no git required.
                                    Organize drafts, versions, tasks, and metadata in one place.
                                </p>
                            </div>

                            <div className="help-section credits">
                                <p className="help-modal-footer">
                                    <a className="footer-link" href="https://github.com/S0Vishnu/Draftwolf/issues" onClick={(e) => handleOpenLink(e, "https://github.com/S0Vishnu/Draftwolf/issues")}>
                                        Issues & Feedback <ExternalLinkIcon size={12} />
                                    </a>
                                </p>
                                <span className="with-love">Made with <Heart size={14} className="heart-icon" /> for builders</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="help-modal-footer-container">
                    <div className="help-modal-footer">
                        <a href="https://www.buymeacoffee.com/s0vishnu" onClick={(e) => handleOpenLink(e, "https://www.buymeacoffee.com/s0vishnu")} className="footer-link">
                            <Coffee size={16} /> Buy me a coffee
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

/** Feature card sub-component */
const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
    <div className="feature-card">
        <div className="feature-icon">{icon}</div>
        <div className="feature-info">
            <h5>{title}</h5>
            <p>{desc}</p>
        </div>
    </div>
);

export default HelpModal;
