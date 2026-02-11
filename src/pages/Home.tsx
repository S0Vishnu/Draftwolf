import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { FileEntry } from '../components/FileItem';
import { InspectorTab } from '../components/inspector/types';

// Components
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Toolbar from '../components/Toolbar';
import FileList from '../components/FileList';
import InspectorPanel from '../components/InspectorPanel';
import ContextMenu from '../components/ContextMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomPopup from '../components/CustomPopup';
import RecentWorkspaces from '../components/RecentWorkspaces';
import { toast } from 'react-toastify';
import { FolderOpen } from 'lucide-react';
import logo from '../assets/icons/logo.png';

// Styles
import '../styles/AuthShared.css';
import Footer from '../components/Footer';

const joinPath = (dir: string, file: string) => {
    const separator = dir.includes('/') ? '/' : '\\';
    return dir.endsWith(separator) ? `${dir}${file}` : `${dir}${separator}${file}`;
};

const Home = () => {
    const navigate = useNavigate();
    const [user] = useAuthState(auth);

    // Layout
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [isPreviewOpen, setPreviewOpen] = useState(false);
    const [inspectorTab, setInspectorTab] = useState<InspectorTab | undefined>(undefined);
    const contentRef = useRef<HTMLDivElement>(null);

    // Data
    const [currentPath, setCurrentPath] = useState<string | null>(() => localStorage.getItem('lastPath') || null);
    const [rootDir, setRootDir] = useState<string | null>(() => localStorage.getItem('rootDir') || null);
    const [files, setFiles] = useState<FileEntry[]>([]);

    // Recent Workspaces
    const [recentWorkspaces, setRecentWorkspaces] = useState<{ path: string, lastOpened: number, name: string }[]>(() => {
        try {
            const saved = localStorage.getItem('recentWorkspaces');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading recent workspaces:', e);
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('recentWorkspaces', JSON.stringify(recentWorkspaces));
    }, [recentWorkspaces]);

    // Pinned Folders
    const [pinnedFolders, setPinnedFolders] = useState<{ 
        path: string, 
        name: string, 
        color?: string,
        showHiddenFiles?: boolean,
        showExtensions?: boolean 
    }[]>(() => {
        try {
            const saved = localStorage.getItem('pinnedFolders');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading pinned folders:', e);
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('pinnedFolders', JSON.stringify(pinnedFolders));
    }, [pinnedFolders]);

    useEffect(() => {
        if (typeof globalThis.api?.setPinnedFoldersForTray === 'function') {
            globalThis.api.setPinnedFoldersForTray(pinnedFolders);
        }
    }, [pinnedFolders]);

    useEffect(() => {
        const path = sessionStorage.getItem('trayOpenPath');
        if (path) {
            sessionStorage.removeItem('trayOpenPath');
            setRootDir(path);
            setCurrentPath(path);
        }
    }, []);

    useEffect(() => {
        const api = globalThis.api;
        if (!api?.onTrayOpenFolder) return;
        const unsub = api.onTrayOpenFolder((path: string) => {
            setRootDir(path);
            setCurrentPath(path);
        });
        return unsub;
    }, []);

    const addToPinned = (path: string) => {
        setPinnedFolders(prev => {
            if (prev.some(f => f.path === path)) return prev;
            return [...prev, { path, name: path.split(/[/\\]/).pop() || path, color: '#3b82f6' }];
        });
    };

    const removeFromPinned = (path: string) => {
        setPinnedFolders(prev => prev.filter(f => f.path !== path));
    };

    const isPinned = (path: string) => pinnedFolders.some(f => f.path === path);

    const addToRecents = (path: string) => {
        setRecentWorkspaces(prev => {
            const normPath = path.toLowerCase().replaceAll('\\', '/');
            const existing = prev.find(w => w.path.toLowerCase().replaceAll('\\', '/') === normPath);
            const filtered = prev.filter(w => w.path.toLowerCase().replaceAll('\\', '/') !== normPath);
            
            const newItem = {
                ...existing,
                path: existing?.path || path, // Prefer existing path casing if available
                lastOpened: Date.now(),
                name: existing?.name || path.split(/[/\\]/).pop() || path
            };
            return [newItem, ...filtered].slice(0, 10);
        });
    };

    const removeFromRecents = (path: string) => {
        setRecentWorkspaces(prev => prev.filter(w => w.path !== path));
    };

    useEffect(() => {
        if (currentPath) {
            const project = pinnedFolders.find(p => currentPath === p.path || currentPath.startsWith(p.path + (p.path.endsWith('/') ? '' : '/')));
            if (project) {
                if (project.showHiddenFiles !== undefined) setShowHiddenFiles(project.showHiddenFiles);
                if (project.showExtensions !== undefined) setShowExtensions(project.showExtensions);
            }
        }
    }, [currentPath, pinnedFolders]);

    useEffect(() => {
        if (currentPath) {
            localStorage.setItem('lastPath', currentPath);
            loadDirectory(currentPath);
            addToRecents(currentPath);
        } else {
            localStorage.removeItem('lastPath');
            setFiles([]);
        }
    }, [currentPath]);

    useEffect(() => {
        if (rootDir) localStorage.setItem('rootDir', rootDir);
        else localStorage.removeItem('rootDir');
    }, [rootDir]);

    // Support Notification
    useEffect(() => {
        const hasShownSupport = sessionStorage.getItem('shown_support_toast');
        if (!hasShownSupport) {
            // Delay slightly so it doesn't pop up instantly with page load
            const timer = setTimeout(() => {
                toast.info(
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>Loving DraftWolf? 🐺</span>
                        <span style={{ fontSize: '13px', opacity: 0.9 }}>Support our creator to continue doing a good job!</span>
                        <a
                            href="https://www.buymeacoffee.com/s0vishnu"
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                alignSelf: 'flex-start',
                                backgroundColor: '#FFDD00',
                                color: 'black',
                                padding: '6px 12px',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                textDecoration: 'none',
                                marginTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            ☕ Buy a Coffee
                        </a>
                    </div>,
                    {
                        position: "bottom-right",
                        autoClose: 15000,
                        hideProgressBar: false,
                        closeOnClick: false,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "dark",
                        icon: false
                    }
                );
                sessionStorage.setItem('shown_support_toast', 'true');
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, []);

    // UIState
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
        (localStorage.getItem('viewMode') as 'list' | 'grid') || 'grid'
    );

    useEffect(() => {
        localStorage.setItem('viewMode', viewMode);
    }, [viewMode]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof FileEntry, direction: 'asc' | 'desc' } | null>(null);

    // Selection
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);

    // Box Selection State
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    const selectionStart = useRef<{ x: number, y: number } | null>(null);
    const initialSelection = useRef<Set<string>>(new Set());

    // History
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Actions
    const [renamingFile, setRenamingFile] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Creation
    const [isCreating, setIsCreating] = useState<'folder' | 'file' | null>(null);
    const [creationName, setCreationName] = useState('');

    // Context Menu
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        target?: FileEntry;
    } | null>(null);

    // Clipboard
    const [appClipboard, setAppClipboard] = useState<{
        paths: string[];
        op: 'copy' | 'cut';
    } | null>(null);

    // Dialogs
    const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean, targets: FileEntry[] }>({ isOpen: false, targets: [] });

    // Backup Setup
    const [backupSetupProject, setBackupSetupProject] = useState<string | null>(null);
    const [backupSetupPath, setBackupSetupPath] = useState<string>('');

    // View Options
    const [showHiddenFiles, setShowHiddenFiles] = useState(() => localStorage.getItem('showHiddenFiles') === 'true');
    const [showExtensions, setShowExtensions] = useState(() => localStorage.getItem('showExtensions') !== 'false'); // Default true

    useEffect(() => { localStorage.setItem('showHiddenFiles', String(showHiddenFiles)); }, [showHiddenFiles]);
    useEffect(() => { localStorage.setItem('showExtensions', String(showExtensions)); }, [showExtensions]);



    // Computed
    const filteredFiles = files.filter(f => {
        // Hidden Files Filter
        if (!showHiddenFiles && f.name.startsWith('.') && f.name !== '..') return false;

        const query = searchQuery.toLowerCase();
        const matchesName = f.name.toLowerCase().includes(query);
        const matchesTags = f.tags ? f.tags.some(t => t.toLowerCase().includes(query)) : false;
        return matchesName || matchesTags;
    });

    const [activeFile, setActiveFile] = useState<FileEntry | null>(null);

    useEffect(() => {
        if (selectedPaths.size === 1) {
            const path = Array.from(selectedPaths)[0];
            const file = files.find(f => f.path === path) || null;
            setActiveFile(file);
        } else {
            setActiveFile(null);
        }
    }, [selectedPaths, files]);

    // Watcher
    useEffect(() => {
        if (!currentPath) return;

        // Start watching the current directory
        globalThis.api.watchDir(currentPath).catch(err => console.error("Watcher error:", err));

        let timeout: NodeJS.Timeout;
        const unsubscribe = globalThis.api.onFileChange((data) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                refreshDirectory();
            }, 300); // 300ms debounce
        });

        return () => {
            clearTimeout(timeout);
            unsubscribe();
        };
    }, [currentPath]);

    const handleCloseApp = async () => {
        try {
            if (globalThis.api?.quitApp) {
                globalThis.api.quitApp();
            }
        } catch (error) {
            console.error("Error closing app:", error);
            toast.error("Failed to close app");
        }
    };

    const closeWorkspace = () => {
        setCurrentPath(null);
        setRootDir(null);
        setHistory([]);
        localStorage.removeItem('lastPath');
        localStorage.removeItem('rootDir');
    };

    // Data Loading
    const getBackupPath = (projectPath: string | null) => {
        if (!projectPath) return undefined;
        const pinned = pinnedFolders.find(f => f.path === projectPath);
        if (pinned && (pinned as any).backupPath) return (pinned as any).backupPath;
        const recent = recentWorkspaces.find(w => w.path === projectPath);
        if (recent && (recent as any).backupPath) return (recent as any).backupPath;
        return undefined;
    };

    const fetchStats = async (entry: FileEntry): Promise<FileEntry> => {
        try {
            const stats = await globalThis.api.getStats(entry.path);

            let latestVersion: string | undefined;
            let tags: string[] = [];

            if (rootDir && entry.path.startsWith(rootDir)) {
                // Calculate relative path
                let rel = entry.path.substring(rootDir.length);
                if (rel.startsWith('\\') || rel.startsWith('/')) rel = rel.substring(1);

                // Get version info for both files and directories
                // Note: For directories, getFileVersion (backed by getLatestVersionForFile)
                // relies on getHistory being able to detect folder snapshots.
                const bp = getBackupPath(rootDir);
                const v = await globalThis.api.draft.getFileVersion(rootDir, rel, bp);
                if (v) latestVersion = v;

                const meta = await globalThis.api.draft.getMetadata(rootDir, rel, bp);
                if (meta?.tags) {
                    tags = meta.tags;
                }
            }

            if (stats) {
                return {
                    ...entry,
                    size: stats.size,
                    mtime: new Date(stats.mtime),
                    type: stats.isDirectory ? 'Folder' : (entry.name.split('.').pop()?.toUpperCase() || 'File') + ' File',
                    latestVersion,
                    tags
                };
            }
        } catch (e) {
            console.error('Error fetching file stats:', e);
        }
        return entry;
    };


    const loadDirectory = async (path: string) => {
        if (!path) return;

        // Security: Check for restricted paths
        const parts = path.split(/[/\\]/);
        if (parts.includes('.draft')) {
            toast.error("Access restricted");
            return;
        }

        setIsLoading(true);
        try {
            const entries = await globalThis.api.readDir(path);
            // Filter out .draft
            const visibleEntries = entries.filter((e: FileEntry) => e.name !== '.draft');
            let processed = await Promise.all(visibleEntries.map(fetchStats));

            if (sortConfig) {
                processed = sortFiles(processed, sortConfig);
            } else {
                processed.sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                    return a.isDirectory ? -1 : 1;
                });
            }

            setFiles(processed);
            if (path === currentPath) {
                // Refreshing: Preserve selection if files still exist
                // Use normalized paths for comparison (lowercase + forward slashes) to handle Windows case-insensitivity and separator inconsistencies
                const normalizePath = (p: string) => p.toLowerCase().replaceAll(/[\\/]/g, '/');
                const existPathsMap = new Map<string, string>();
                processed.forEach(p => existPathsMap.set(normalizePath(p.path), p.path));

                setSelectedPaths(prev => {
                    const next = new Set<string>();
                    prev.forEach(p => {
                        const normP = normalizePath(p);
                        if (existPathsMap.has(normP)) {
                            // Use the path from the new file list to ensure exact match
                            const originalPath = existPathsMap.get(normP);
                            if (originalPath) next.add(originalPath);
                        }
                    });
                    return next;
                });

                setLastSelectedPath(prev => {
                    if (!prev) return null;
                    const normPrev = normalizePath(prev);
                    return existPathsMap.has(normPrev) ? existPathsMap.get(normPrev) || null : null;
                });
            } else {
                setCurrentPath(path);
                setSelectedPaths(new Set());
                setLastSelectedPath(null);
            }
            setIsCreating(null);
        } catch (error: any) {
            console.error("Failed to load directory", error);

            // Check for ENOENT (Folder deleted)
            if (error.code === 'ENOENT' || error.message?.includes('ENOENT') || error.message?.includes('no such file')) {
                toast.error("Folder not found. Navigating to parent.");
                const parent = path.split(/[/\\]/).slice(0, -1).join('/') || '/'; // Simple parent calc
                // Check if we hit root or empty
                if (!parent || parent === path) {
                    setCurrentPath(null);
                    // Actually we can try to go home? 
                    // But we don't know user home easily without IPC.
                    // Let's just set null and show empty state or Sidebar will handle it.
                } else {
                    navigateTo(parent);
                }
            } else {
                toast.error('Failed to load directory');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const sortFiles = (fileList: FileEntry[], config: { key: keyof FileEntry, direction: 'asc' | 'desc' }) => {
        return [...fileList].sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            let valA = a[config.key] || '';
            let valB = b[config.key] || '';
            if (valA < valB) return config.direction === 'asc' ? -1 : 1;
            if (valA > valB) return config.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const handleDoubleClick = (path: string) => {
        const file = files.find(f => f.path === path);
        if (!file) return;

        if (file.isDirectory) {
            navigateTo(path);
        } else {
            globalThis.api?.openPath(path);
        }
    };

    const handleSort = (key: keyof FileEntry) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig?.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setFiles(prev => sortFiles(prev, { key, direction }));
    };

    const refreshDirectory = () => { if (currentPath) loadDirectory(currentPath); };

    // Navigation
    const openWorkspace = async (path: string) => {
        if (path.split(/[/\\]/).includes('.draft')) {
            toast.error("Access restricted");
            return;
        }

        // Check if project already has a backupPath configured
        const pinned = pinnedFolders.find(f => f.path === path);
        const recent = recentWorkspaces.find(w => w.path === path);
        const hasBackup = (pinned as any)?.backupPath || (recent as any)?.backupPath;

        if (hasBackup) {
            // Priority 1: Already configured — just open
            setRootDir(path);
            setHistory([path]);
            setHistoryIndex(0);
            loadDirectory(path);
            return;
        }

        // Priority 2: Check if .draft folder already exists on disk (existing project)
        // Only do this if NO backup path is configured.
        const separator = path.includes('/') ? '/' : '\\';
        const draftPath = path.endsWith(separator) ? `${path}.draft` : `${path}${separator}.draft`;
        try {
            const stats = await globalThis.api.getStats(draftPath);
            if (stats?.isDirectory) {
                // Existing project — auto-set backup to project's own path
                toast.info("Opening existing project...");
                // Explicitly save project root as backup path to avoid ambiguity in future
                saveBackupPath(path, path);
                setRootDir(path);
                setHistory([path]);
                setHistoryIndex(0);
                loadDirectory(path);
                return;
            }
        } catch {
            // .draft doesn't exist — this is a new project
        }

        // New project — show backup setup popup
        toast.info("New project detected - Setup required");
        setBackupSetupProject(path);
        setBackupSetupPath(path); // Default to the project's own path
    };

    const saveBackupPath = (projPath: string, bPath: string) => {
        setPinnedFolders(prev =>
            prev.map(f =>
                f.path === projPath ? { ...f, backupPath: bPath } as any : f
            )
        );
        setRecentWorkspaces(prev =>
            prev.map(w =>
                w.path === projPath ? { ...w, backupPath: bPath } as any : w
            )
        );
    };

    const confirmBackupSetup = async () => {
        if (!backupSetupProject || !backupSetupPath) return;

        const bPath = backupSetupPath;
        const projPath = backupSetupProject;
        
        // Create .draft folder
        // Initialize the draft system structure at the confirmed backup path
        try {
             // API will handle creating .draft/objects/versions/metadata etc.
            const success = await globalThis.api.draft.init(projPath, bPath);
            if (!success) {
                toast.error("Failed to initialize backup system");
                return;
            }
            toast.success("Initialized backup system (.draft)");
        } catch (e) {
            console.error("Init Error:", e);
            toast.error("Error initializing backup system");
            return;
        }

        // Save backup path to pinned & recents
        saveBackupPath(projPath, bPath);

        // Close popup and open workspace
        setBackupSetupProject(null);
        setBackupSetupPath('');

        // Proceed to open
        setRootDir(projPath);
        setHistory([projPath]);
        setHistoryIndex(0);
        loadDirectory(projPath);
    };

    const cancelBackupSetup = () => {
        setBackupSetupProject(null);
        setBackupSetupPath('');
    };

    const handleOpenFolder = async () => {
        const path = await globalThis.api.openFolder();
        if (path) {
            openWorkspace(path);
        }
    };

    const navigateTo = (path: string) => {
        if (path === currentPath) return;
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(path);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        loadDirectory(path);
    };

    const navigateBack = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            loadDirectory(history[newIndex]);
        }
    };

    const navigateForward = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            loadDirectory(history[newIndex]);
        }
    };

    // Selection Logic
    const toggleSelection = (path: string) => {
        setSelectedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
        setLastSelectedPath(path);
    };

    const selectRange = (targetPath: string) => {
        if (!lastSelectedPath) return;
        const lastIndex = filteredFiles.findIndex(f => f.path === lastSelectedPath);
        const currentIndex = filteredFiles.findIndex(f => f.path === targetPath);
        if (lastIndex === -1 || currentIndex === -1) return;

        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const newSelection = new Set<string>();
        for (let i = start; i <= end; i++) {
            newSelection.add(filteredFiles[i].path);
        }
        setSelectedPaths(newSelection);
    };

    const selectSingle = (path: string) => {
        if (selectedPaths.size === 1 && selectedPaths.has(path)) {
            if (lastSelectedPath !== path) setLastSelectedPath(path);
            return;
        }
        setSelectedPaths(new Set([path]));
        setLastSelectedPath(path);
    };

    const handleSelectFile = (e: React.MouseEvent, file: FileEntry) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        if (e.ctrlKey) {
            toggleSelection(file.path);
        } else if (e.shiftKey && lastSelectedPath) {
            selectRange(file.path);
        } else {
            selectSingle(file.path);
        }
    };

    // Box Selection
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!currentPath) return; // Disable box selection on start page
        if (e.button !== 0) return; // Only left click
        if (!contentRef.current) return;

        // Check if we clicked on a file item
        // This prevents starting a box selection or clearing selection when clicking a file
        if ((e.target as HTMLElement).closest('.grid-card, .list-row')) {
            return;
        }

        // Clear selection if not Ctrl
        if (e.ctrlKey) {
            initialSelection.current = new Set(selectedPaths);
        } else {
            setSelectedPaths(new Set());
            initialSelection.current = new Set();
        }

        const rect = contentRef.current.getBoundingClientRect();
        const scrollLeft = contentRef.current.scrollLeft;
        const scrollTop = contentRef.current.scrollTop;

        const x = e.clientX - rect.left + scrollLeft;
        const y = e.clientY - rect.top + scrollTop;

        setIsSelecting(true);
        selectionStart.current = { x, y };
        setSelectionBox({ x, y, width: 0, height: 0 });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isSelecting || !selectionStart.current || !contentRef.current) return;

            const rect = contentRef.current.getBoundingClientRect();
            const scrollLeft = contentRef.current.scrollLeft;
            const scrollTop = contentRef.current.scrollTop;

            const currentX = e.clientX - rect.left + scrollLeft;
            const currentY = e.clientY - rect.top + scrollTop;

            const startX = selectionStart.current.x;
            const startY = selectionStart.current.y;

            // Update Visual Box (Absolute coordinates relative to content area)
            setSelectionBox({
                x: Math.min(startX, currentX),
                y: Math.min(startY, currentY),
                width: Math.abs(currentX - startX),
                height: Math.abs(currentY - startY)
            });

            // Calculate Intersection (Viewport coordinates)
            // Box in Viewport
            const boxLeft = Math.min(startX, currentX) - scrollLeft + rect.left;
            const boxTop = Math.min(startY, currentY) - scrollTop + rect.top;
            const boxRight = boxLeft + Math.abs(currentX - startX);
            const boxBottom = boxTop + Math.abs(currentY - startY);

            const selRect = {
                left: boxLeft,
                top: boxTop,
                right: boxRight,
                bottom: boxBottom
            };

            const newSelection = new Set(initialSelection.current);
            const items = contentRef.current.querySelectorAll('[data-path]');

            items.forEach((item) => {
                const itemRect = item.getBoundingClientRect();
                const path = (item as HTMLElement).dataset.path;

                const intersects = !(
                    selRect.left > itemRect.right ||
                    selRect.right < itemRect.left ||
                    selRect.top > itemRect.bottom ||
                    selRect.bottom < itemRect.top
                );

                if (intersects && path) {
                    newSelection.add(path);
                }
            });

            setSelectedPaths(newSelection);
        };

        const handleMouseUp = () => {
            if (isSelecting) {
                setIsSelecting(false);
                setSelectionBox(null);
                selectionStart.current = null;
            }
        };

        if (isSelecting) {
            globalThis.addEventListener('mousemove', handleMouseMove);
            globalThis.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            globalThis.removeEventListener('mousemove', handleMouseMove);
            globalThis.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isSelecting]);

    // Context Menu
    const handleContextMenu = (e: React.MouseEvent, file?: FileEntry) => {
        e.preventDefault();
        e.stopPropagation();
        if (file) {
            if (!selectedPaths.has(file.path)) {
                setSelectedPaths(new Set([file.path]));
                setLastSelectedPath(file.path);
            }
            setContextMenu({ x: e.clientX, y: e.clientY, target: file });
        } else {
            setContextMenu({ x: e.clientX, y: e.clientY });
        }
    };

    const closeContextMenu = () => setContextMenu(null);

    const getSelectedFiles = () => files.filter(f => selectedPaths.has(f.path));

    const confirmDelete = (targets: FileEntry[]) => {
        setDeleteDialog({ isOpen: true, targets });
    };

    const handleDeleteConfirmAction = () => {
        const { targets } = deleteDialog;
        handleDeleteConfirm(targets);
        setDeleteDialog({ isOpen: false, targets: [] });
    };

    const handleDeleteCancel = () => {
        setDeleteDialog({ isOpen: false, targets: [] });
    };

    const handleDeleteConfirm = async (targets: FileEntry[]) => {
        try {
            let successCount = 0;
            for (const t of targets) {
                const success = await globalThis.api.deleteEntry(t.path);
                if (success) successCount++;
            }
            if (successCount > 0) {
                toast.success(`Deleted ${successCount} item(s)`);
            }
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error('Failed to delete items');
        }
    };

    const startRenaming = (e: React.MouseEvent | undefined, file: FileEntry) => {
        e?.stopPropagation();
        setRenamingFile(file.path);
        setRenameValue(file.name);
        setIsCreating(null);
    };

    const cancelRenaming = () => {
        setRenamingFile(null);
        setRenameValue('');
    };

    const handleRenameSubmit = async () => {
        if (!renamingFile || !currentPath || !renameValue) return;
        const newPath = joinPath(currentPath, renameValue);
        const result = await globalThis.api.renameEntry(renamingFile, newPath);
        if (result.success) {
            const oldPath = renamingFile;
            setRenamingFile(null);
            // Update selection to follow the renamed file
            setSelectedPaths(prev => {
                const next = new Set(prev);
                if (next.has(oldPath)) {
                    next.delete(oldPath);
                    next.add(newPath);
                }
                return next;
            });
            setLastSelectedPath(newPath);

            refreshDirectory();
            toast.success('Renamed successfully');
        }
        else {
            toast.error(result.error || "Failed to rename.");
            cancelRenaming(); // Revert to original state on failure
        }
    };

    const getUniqueName = (baseName: string, _isFolder: boolean) => {
        let name = baseName;
        let counter = 1;
        while (files.some(f => f.name === name)) {
            name = `${baseName} (${counter})`;
            counter++;
        }
        return name;
    };

    const initCreateFolder = () => {
        if (!currentPath) return;
        setIsCreating('folder');
        setCreationName(getUniqueName('New Folder', true));
        setRenamingFile(null);
        setSelectedPaths(new Set());
    };

    const initCreateFile = () => {
        if (!currentPath) return;
        setIsCreating('file');
        setCreationName(getUniqueName('New Text Document.txt', false));
        setRenamingFile(null);
        setSelectedPaths(new Set());
    };

    const cancelCreation = () => {
        setIsCreating(null);
        setCreationName('');
    };

    const submitCreation = async () => {
        if (!currentPath || !isCreating || !creationName.trim()) {
            cancelCreation();
            return;
        }
        const targetPath = joinPath(currentPath, creationName.trim());
        const result = isCreating === 'folder'
            ? await globalThis.api.createFolder(targetPath)
            : await globalThis.api.createFile(targetPath);

        if (result.success) {
            setIsCreating(null);
            refreshDirectory();
            toast.success(`Created ${isCreating}`);
        } else {
            toast.error(result.error || "Failed to create item");
        }
    };


    const menuActions = {
        open: () => {
            const targets = getSelectedFiles();
            if (targets.length === 1) {
                if (targets[0].isDirectory) navigateTo(targets[0].path);
                else globalThis.api.openPath(targets[0].path);
            }
        },
        preview: () => {
            const targets = getSelectedFiles();
            if (targets.length === 1) setPreviewOpen(true);
        },
        rename: () => {
            const targets = getSelectedFiles();
            if (targets.length === 1) startRenaming(undefined, targets[0]);
        },
        delete: () => {
            const targets = getSelectedFiles();
            if (targets.length > 0) confirmDelete(targets);
        },
        copy: () => {
            const paths = Array.from(selectedPaths);
            if (paths.length) setAppClipboard({ paths, op: 'copy' });
        },
        cut: () => {
            const paths = Array.from(selectedPaths);
            if (paths.length) setAppClipboard({ paths, op: 'cut' });
        },
        paste: async () => {
            if (!appClipboard || !currentPath) return;
            for (const src of appClipboard.paths) {
                const srcName = src.split(/[/\\]/).pop() || 'unknown';
                let dest = joinPath(currentPath, srcName);

                // Collision handling
                if (appClipboard.op === 'copy') {
                    // If file exists, find unique name
                    // Pattern: name (N).ext
                    let finalName = srcName;
                    let counter = 1;

                    const nameParts = srcName.split('.');
                    const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
                    const base = nameParts.join('.');

                    while (files.some(f => f.name === finalName)) {
                        finalName = `${base} (${counter})${ext}`;
                        counter++;
                    }
                    dest = joinPath(currentPath, finalName);
                    await globalThis.api.copyEntry(src, dest);
                }
                else {
                    // Cut/Move
                    await globalThis.api.renameEntry(src, dest);
                }
            }
            if (appClipboard.op === 'cut') setAppClipboard(null);
            refreshDirectory();
            toast.success(`Pasted ${appClipboard.paths.length} item(s)`);
        },
        newFolder: () => initCreateFolder(),
        newFile: () => initCreateFile(),
        refresh: () => refreshDirectory(),
        showInExplorer: () => {
            const targets = getSelectedFiles();
            if (targets.length === 1) globalThis.api.showInFolder(targets[0].path);
        },
        pin: () => {
            const targets = getSelectedFiles();
            if (targets.length === 1 && targets[0].isDirectory) {
                const path = targets[0].path;
                if (isPinned(path)) {
                    removeFromPinned(path);
                    toast.success("Unpinned from sidebar");
                } else {
                    addToPinned(path);
                    toast.success("Pinned to sidebar");
                }
            }
        }
    };

    const handleInspectorClose = () => {
        setPreviewOpen(false);
        setInspectorTab(undefined);
    };

    // Handle version badge click - select file and open inspector
    const handleVersionClick = (e: React.MouseEvent, file: FileEntry) => {
        e.stopPropagation();
        // Select the file
        setSelectedPaths(new Set([file.path]));
        setLastSelectedPath(file.path);
        // Open the inspector panel
        setInspectorTab('versions');
        setPreviewOpen(true);
    };

    const getContextMenuOptions = () => {
        if (!contextMenu) return [];
        if (contextMenu.target) {
            const isMulti = selectedPaths.size > 1;
            const isPinnedFolder = contextMenu.target ? isPinned(contextMenu.target.path) : false;

            return [
                { label: 'Open', action: menuActions.open, disabled: isMulti },
                { label: 'Open Details', action: menuActions.preview, disabled: isMulti },
                { label: 'Show in Explorer', action: menuActions.showInExplorer, disabled: isMulti },
                { label: isPinnedFolder ? 'Unpin from Sidebar' : 'Pin to Sidebar', action: menuActions.pin, disabled: isMulti || !contextMenu.target.isDirectory },
                { label: 'Rename', action: menuActions.rename, shortcut: 'F2', disabled: isMulti },
                { label: 'Cut', action: menuActions.cut, shortcut: 'Ctrl+X' },
                { label: 'Copy', action: menuActions.copy, shortcut: 'Ctrl+C' },
                { label: 'Delete', action: menuActions.delete, shortcut: 'Del', danger: true },
            ];
        }
        return [
            { label: 'New Folder', action: menuActions.newFolder, shortcut: 'Ctrl+Shift+N' },
            { label: 'New Text File', action: menuActions.newFile, shortcut: 'Ctrl+N' },
            { label: 'Refresh', action: menuActions.refresh },
            { label: 'Paste', action: menuActions.paste, shortcut: 'Ctrl+V', disabled: !appClipboard },
        ];
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleBasicKeyAction = (e: KeyboardEvent) => {
            if (e.key === 'Backspace') {
                e.preventDefault();
                navigateBack();
                return true;
            }
            if (e.key === 'Enter' && selectedPaths.size === 1) {
                const file = filteredFiles.find(f => f.path === lastSelectedPath);
                if (file?.isDirectory) navigateTo(file.path);
                else if (file) globalThis.api?.openPath(file.path);
                return true;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedPaths(new Set());
                return true;
            }
            return false;
        };

        const handleFileActionShortcuts = (e: KeyboardEvent) => {
            if (e.key === 'F2') { e.preventDefault(); menuActions.rename(); }
            else if (e.key === 'Delete') { e.preventDefault(); menuActions.delete(); }
        };

        const handleCtrlShortcuts = (e: KeyboardEvent, key: string) => {
            if (key === 'c' && selectedPaths.size > 0) { e.preventDefault(); menuActions.copy(); }
            else if (key === 'x' && selectedPaths.size > 0) { e.preventDefault(); menuActions.cut(); }
            else if (key === 'v') { e.preventDefault(); menuActions.paste(); }
            else if (key === 'a') { e.preventDefault(); setSelectedPaths(new Set(filteredFiles.map(f => f.path))); }
            else if (e.shiftKey && key === 'n') { e.preventDefault(); initCreateFolder(); }
            else if (key === 'n') { e.preventDefault(); initCreateFile(); }
        };

        const calculateGridNextIndex = (currentIndex: number, key: string) => {
            if (key === 'ArrowLeft') return Math.max(0, currentIndex - 1);
            if (key === 'ArrowRight') return Math.min(filteredFiles.length - 1, currentIndex + 1);

            let cols = 1;
            if (contentRef.current) {
                const width = contentRef.current.clientWidth - 32;
                cols = Math.floor(width / 116);
                if (cols < 1) cols = 1;
            }

            if (key === 'ArrowUp') return Math.max(0, currentIndex - cols);
            if (key === 'ArrowDown') return Math.min(filteredFiles.length - 1, currentIndex + cols);
            return currentIndex;
        };

        const handleArrowNavigation = (e: KeyboardEvent) => {
            e.preventDefault();
            if (filteredFiles.length === 0) return;

            let nextIndex = 0;
            const currentIndex = lastSelectedPath
                ? filteredFiles.findIndex(f => f.path === lastSelectedPath)
                : -1;

            if (currentIndex !== -1) {
                if (viewMode === 'list') {
                    if (e.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
                    else if (e.key === 'ArrowDown') nextIndex = Math.min(filteredFiles.length - 1, currentIndex + 1);
                    else nextIndex = currentIndex;
                } else {
                    nextIndex = calculateGridNextIndex(currentIndex, e.key);
                }
            }

            if (nextIndex >= 0 && nextIndex < filteredFiles.length) {
                const nextFile = filteredFiles[nextIndex];
                setSelectedPaths(new Set([nextFile.path]));
                setLastSelectedPath(nextFile.path);

                const el = document.querySelector(`[data-path="${nextFile.path.replaceAll('\\', '\\\\')}"]`);
                if (el) el.scrollIntoView({ block: 'nearest' });
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (renamingFile || isCreating) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRenaming();
                    cancelCreation();
                }
                return;
            }

            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;

            if (handleBasicKeyAction(e)) return;
            if (isCtrl) { handleCtrlShortcuts(e, key); return; }
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { handleArrowNavigation(e); return; }
            if (selectedPaths.size > 0 || lastSelectedPath) handleFileActionShortcuts(e);
        };

        globalThis.addEventListener('keydown', handleKeyDown);
        return () => globalThis.removeEventListener('keydown', handleKeyDown);
    }, [selectedPaths, lastSelectedPath, renamingFile, isCreating, filteredFiles, appClipboard, currentPath, viewMode]);

    return (
        <div className="app-shell" style={{ flexDirection: 'column' }}>
            <div className="app-inner" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
                <Sidebar
                    isOpen={isSidebarOpen}
                    user={user}
                    onOpenFolder={handleOpenFolder}
                    onGoHome={closeWorkspace}
                    hasActiveWorkspace={!!currentPath}
                    pinnedFolders={pinnedFolders}
                    onSelectProject={openWorkspace}
                    activePath={currentPath}
                />

                <main className="main-content">
                    <Header
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
                        isPreviewOpen={isPreviewOpen}
                        togglePreview={() => setPreviewOpen(!isPreviewOpen)}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        refreshDirectory={refreshDirectory}
                        isLoading={isLoading}
                        onSettings={rootDir ? () => navigate(`/project-settings?path=${encodeURIComponent(rootDir)}`) : undefined}
                        onTogglePin={rootDir ? () => {
                            if (pinnedFolders.some(f => f.path === rootDir)) {
                                removeFromPinned(rootDir!);
                                toast.success("Unpinned project");
                            } else {
                                addToPinned(rootDir!);
                                toast.success("Pinned project");
                            }
                        } : undefined}
                        isPinned={rootDir ? pinnedFolders.some(f => f.path === rootDir) : false}
                    />

                    {currentPath ? (
                        <>
                            <Toolbar
                                currentPath={currentPath}
                                historyIndex={historyIndex}
                                historyLength={history.length}
                                viewMode={viewMode}
                                rootDir={rootDir}
                                showHiddenFiles={showHiddenFiles}
                                showExtensions={showExtensions}
                                sortConfig={sortConfig}
                                onToggleHiddenFiles={() => setShowHiddenFiles(!showHiddenFiles)}
                                onToggleExtensions={() => setShowExtensions(!showExtensions)}
                                onSort={handleSort}
                                onRefresh={refreshDirectory}
                                onNavigateBack={navigateBack}
                                onNavigateForward={navigateForward}
                                onOpenWorkspace={() => loadDirectory(rootDir || '')}
                                onCreateFolder={initCreateFolder}
                                onCreateFile={initCreateFile}
                                setViewMode={setViewMode}
                                onNavigate={navigateTo}
                            />

                            <div
                                className="content-area"
                                ref={contentRef}
                                onMouseDown={handleMouseDown}
                                onContextMenu={(e) => handleContextMenu(e)}
                                role="grid"
                                aria-label="File explorer content area"
                                tabIndex={0}
                            >
                                {/* File List / Grid */}
                                <FileList
                                    files={filteredFiles}
                                    viewMode={viewMode}
                                    selectedPaths={selectedPaths}
                                    renamingFile={renamingFile}
                                    renameValue={renameValue}
                                    sortConfig={sortConfig}
                                    isCreating={isCreating}
                                    creationName={creationName}
                                    showExtensions={showExtensions}
                                    onSort={handleSort}
                                    onSelect={handleSelectFile}
                                    onNavigate={handleDoubleClick}
                                    onRenameChange={setRenameValue}
                                    onRenameSubmit={handleRenameSubmit}
                                    onRenameCancel={cancelRenaming}
                                    onContextMenu={handleContextMenu}
                                    onVersionClick={handleVersionClick}
                                    onCreationChange={setCreationName}
                                    onCreationSubmit={submitCreation}
                                    onCreationCancel={cancelCreation}
                                />

                                {isSelecting && selectionBox && (
                                    <div
                                        className="selection-box"
                                        style={{
                                            left: selectionBox.x,
                                            top: selectionBox.y,
                                            width: selectionBox.width,
                                            height: selectionBox.height
                                        }}
                                    />
                                )}
                            </div>
                        </>
                    ) : (
                        <RecentWorkspaces
                            recents={recentWorkspaces}
                            onOpen={openWorkspace}
                            onRemove={removeFromRecents}
                            onOpenFolder={handleOpenFolder}
                            pinnedPaths={pinnedFolders.map(f => f.path)}
                            onTogglePin={(path) => {
                                if (isPinned(path)) removeFromPinned(path);
                                else addToPinned(path);
                            }}
                        />
                    )}
                </main>

                {isPreviewOpen && (
                    <InspectorPanel
                        file={activeFile}
                        projectRoot={rootDir || currentPath || ''}
                        onClose={() => setInspectorTab(undefined)}
                        onRefresh={refreshDirectory}
                        initialTab={inspectorTab}
                        backupPath={getBackupPath(rootDir)}
                    />
                )}
            </div>
            <Footer onShutDown={handleCloseApp} />

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    options={getContextMenuOptions()}
                    onClose={closeContextMenu}
                />
            )}

            {/* Dialogs */}
            <ConfirmDialog
                isOpen={deleteDialog.isOpen}
                title="Delete Items"
                message={`Are you sure you want to delete ${deleteDialog.targets.length} item(s)? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                isDangerous={true}
                onConfirm={handleDeleteConfirmAction}
                onCancel={handleDeleteCancel}
            />

            {/* Backup Setup Popup */}
            <CustomPopup
                isOpen={!!backupSetupProject}
                title="Set Backup Location"
                message="Choose where project backups will be stored. This cannot be changed later."
                icon={<FolderOpen size={24} color="#6e7bf2" />}
                confirmText="Confirm & Open"
                cancelText="Cancel"
                onConfirm={confirmBackupSetup}
                onCancel={cancelBackupSetup}
            >
                <div className="backup-path-display">
                    <img src={logo} alt="" />
                    <span>{backupSetupPath || 'No folder selected'}</span>
                </div>
                <button
                    style={{
                        padding: '8px 14px',
                        fontSize: '13px',
                        borderRadius: '8px',
                        border: '1px solid #3f3f46',
                        background: 'transparent',
                        color: '#e4e4e7',
                        cursor: 'pointer',
                        alignSelf: 'flex-start',
                        transition: 'all 0.2s',
                    }}
                    onClick={async () => {
                        const path = await globalThis.api.openFolder();
                        if (path) setBackupSetupPath(path);
                    }}
                >
                    Browse...
                </button>
            </CustomPopup>
        </div>
    );
};


export default Home;
