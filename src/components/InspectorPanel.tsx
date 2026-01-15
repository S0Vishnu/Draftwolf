import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    X, Folder, File, Info, CheckCircle, Layers, Paperclip,
    Download, Trash2, GitBranch, RotateCcw, Plus, CheckSquare, Image as ImageIcon, Upload
} from 'lucide-react';
import { FileEntry } from './FileItem';
import '../styles/InspectorPanel.css';

import ConfirmDialog from './ConfirmDialog';
import TodoList, { TodoItem, Priority } from './TodoList';

interface InspectorPanelProps {
    file: FileEntry | null;
    projectRoot: string;
    onClose: () => void;
    onRename?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
}

type Tab = 'info' | 'tasks' | 'versions' | 'attachments';

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;


interface AttachmentItem {
    id: string;
    type: 'image';
    path: string; // Internal path e.g. "attachments/..."
    name: string;
    createdAt: number;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ file, projectRoot, onClose }) => {
    const [activeTab, setActiveTab] = useState<Tab>('versions');
    const [width, setWidth] = useState(420);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Tasks & Attachments State
    const [todos, setTodos] = useState<TodoItem[]>([]);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);


    // Version State
    const [history, setHistory] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [versionLabel, setVersionLabel] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

    // Reset active version when file changes
    useEffect(() => {
        setActiveVersionId(null);
    }, [file?.path]);

    // Confirm Dialog State
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        isDangerous: false,
        onConfirm: () => { }
    });

    // Helper to get relative path
    const getRelativePath = useCallback(() => {
        if (!file || !projectRoot) return null;
        if (file.path.startsWith(projectRoot)) {
            let rel = file.path.substring(projectRoot.length);
            if (rel.startsWith('\\') || rel.startsWith('/')) rel = rel.substring(1);
            return rel;
        }
        return file.path;
    }, [file, projectRoot]);

    // Load Metadata
    useEffect(() => {
        if (!file || !projectRoot) return;

        const load = async () => {
            const relPath = getRelativePath();
            if (!relPath) return;

            try {
                // @ts-ignore
                const meta = await window.api.draft.getMetadata(projectRoot, relPath);
                if (meta) {
                    setTodos(meta.tasks || []);
                    setAttachments(meta.attachments || []);
                } else {
                    setTodos([]);
                    setAttachments([]);
                }
            } catch (e) {
                console.error("Failed to load metadata", e);
            }
        };
        load();
    }, [file, projectRoot, getRelativePath]);

    // Save Helpers
    const persistMetadata = async (newTodos: TodoItem[], newAttachments: AttachmentItem[]) => {
        const relPath = getRelativePath();
        if (!relPath || !projectRoot) return;

        try {
            // @ts-ignore
            await window.api.draft.saveMetadata(projectRoot, relPath, {
                tasks: newTodos,
                attachments: newAttachments
            });
        } catch (e) {
            console.error("Failed to save metadata", e);
        }
    };

    const saveTodos = (newTodos: TodoItem[]) => {
        setTodos(newTodos);
        persistMetadata(newTodos, attachments);
    };

    const saveAttachments = (newAttach: AttachmentItem[]) => {
        setAttachments(newAttach);
        persistMetadata(todos, newAttach);
    };

    // --- Logic for Tabs ---

    // Resize
    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        if (!isResizing) return;
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = document.body.clientWidth - e.clientX;
            if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setWidth(newWidth);
        };
        const handleMouseUp = () => setIsResizing(false);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return '--';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (date?: Date) => {
        if (!date) return '--';
        return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) +
            ' - ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };

    // Versions
    useEffect(() => {
        if (activeTab === 'versions' && projectRoot && file) {
            const loadVersions = async () => {
                // @ts-ignore
                const fullHistory: any[] = await window.api.draft.getHistory(projectRoot);
                // @ts-ignore
                const currentHead: string | null = await window.api.draft.getCurrentHead(projectRoot);

                const relPath = getRelativePath();

                if (!relPath) {
                    setHistory([]);
                    return;
                }

                const filtered = fullHistory.filter(ver => {
                    const normRelPath = relPath.replace(/\\/g, '/');

                    if (file.isDirectory) {
                        // For folders, checking if ANY file in the version is inside this folder
                        return Object.keys(ver.files).some(k => {
                            const normKey = k.replace(/\\/g, '/');
                            return normKey === normRelPath || normKey.startsWith(normRelPath + '/');
                        });
                    } else {
                        // For files, check exact match
                        if (ver.files[relPath]) return true;
                        const versionFileKeys = Object.keys(ver.files).map(k => k.replace(/\\/g, '/'));
                        return versionFileKeys.includes(normRelPath);
                    }
                });

                // Only set active version if not already set (e.g. on first load)
                if (!activeVersionId) {
                    if (currentHead && filtered.some(v => v.id === currentHead)) {
                        setActiveVersionId(currentHead);
                    } else if (filtered.length > 0) {
                        setActiveVersionId(filtered[0].id);
                    }
                }
                setHistory(filtered);
            };

            loadVersions();
        } else {
            // Clear history if no file is selected or not on versions tab
            setHistory([]);
        }
    }, [activeTab, projectRoot, file, getRelativePath]);

    const recursiveScan = async (dir: string): Promise<string[]> => {
        // @ts-ignore
        const entries = await window.api.readDir(dir);
        let files: string[] = [];
        for (const entry of entries) {
            if (entry.isDirectory) {
                if (entry.name === '.draft' || entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out' || entry.name === 'dist') continue;
                const subFiles = await recursiveScan(entry.path);
                files = [...files, ...subFiles];
            } else {
                files.push(entry.path);
            }
        }
        return files;
    };

    const handleCreateVersion = async () => {
        if (!versionLabel || !projectRoot || !file) return;
        setLoading(true);
        try {
            let filesToVersion: string[] = [];

            // If it's a directory, scan it recursively
            if (file.isDirectory) {
                filesToVersion = await recursiveScan(file.path);
            } else {
                // If it's a file, just version this file
                filesToVersion = [file.path];
            }

            console.log('📦 Creating version for:', filesToVersion);

            // @ts-ignore
            const result = await window.api.draft.commit(projectRoot, versionLabel, filesToVersion);
            if (result && result.success && result.versionId) {
                setActiveVersionId(result.versionId);
            }

            setVersionLabel('');
            setIsCreating(false);

            // Refresh the history
            // @ts-ignore
            const fullHistory = await window.api.draft.getHistory(projectRoot);

            // Filter to only show versions for the current file
            const relPath = getRelativePath();
            if (relPath) {
                const filtered = fullHistory.filter(ver => {
                    const normRelPath = relPath.replace(/\\/g, '/');

                    if (file.isDirectory) {
                        return Object.keys(ver.files).some(k => {
                            const normKey = k.replace(/\\/g, '/');
                            return normKey === normRelPath || normKey.startsWith(normRelPath + '/');
                        });
                    } else {
                        if (ver.files[relPath]) return true;
                        const versionFileKeys = Object.keys(ver.files).map(k => k.replace(/\\/g, '/'));
                        return versionFileKeys.includes(normRelPath);
                    }
                });
                setHistory(filtered);
            } else {
                setHistory([]);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleRestore = async (vId: string) => {
        setConfirmState({
            isOpen: true,
            title: 'Restore Version?',
            message: `Are you sure you want to restore version ${vId}? Unsaved changes in the current workspace will be lost.`,
            confirmText: 'Restore',
            isDangerous: true,
            onConfirm: async () => {
                // @ts-ignore
                await window.api.draft.restore(projectRoot, vId);
                setActiveVersionId(vId);
                // window.location.reload();
                setConfirmState(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleDownload = async (ver: any, customVerNum: number) => {
        if (!file || !projectRoot) return;
        const relativePath = getRelativePath();
        if (!relativePath) return;

        const parts = file.name.split('.');
        let nameWithoutExt = file.name;
        let ext = "";
        if (parts.length > 1) {
            ext = "." + parts.pop();
            nameWithoutExt = parts.join('.');
        }

        const newFileName = `${nameWithoutExt}-v${customVerNum}${ext}`;
        const parentDir = file.path.substring(0, file.path.lastIndexOf(file.name));
        const destPath = parentDir + newFileName;

        const performExtraction = async () => {
            try {
                // @ts-ignore
                await window.api.draft.extract(projectRoot, ver.id, relativePath, destPath);
            } catch (e: any) {
                alert(`Failed to save: ${e.message || e}`);
            }
            setConfirmState(prev => ({ ...prev, isOpen: false }));
        };

        // Check availability
        // @ts-ignore
        const stats = await window.api.getStats(destPath);
        if (stats) {
            setConfirmState({
                isOpen: true,
                title: 'File Exists',
                message: `"${newFileName}" already exists. Do you want to overwrite it?`,
                confirmText: 'Overwrite',
                isDangerous: false,
                onConfirm: performExtraction
            });
        } else {
            performExtraction();
        }
    };

    const handleDeleteVersion = async (vId: string) => {
        setConfirmState({
            isOpen: true,
            title: 'Delete Version?',
            message: `Are you sure you want to delete version ${vId}? This action cannot be undone.`,
            confirmText: 'Delete',
            isDangerous: true,
            onConfirm: async () => {
                // @ts-ignore
                await window.api.draft.delete(projectRoot, vId);
                // @ts-ignore
                const fullHistory = await window.api.draft.getHistory(projectRoot);

                // Filter to only show versions for the current file
                const relPath = getRelativePath();
                if (relPath) {
                    const filtered = fullHistory.filter(ver => {
                        if (ver.files[relPath]) return true;
                        // Normalized match (handle Windows/Unix path differences)
                        const normPath = relPath.replace(/\\/g, '/');
                        const versionFileKeys = Object.keys(ver.files).map(k => k.replace(/\\/g, '/'));
                        return versionFileKeys.includes(normPath);
                    });
                    setHistory(filtered);
                } else {
                    setHistory([]);
                }
                setConfirmState(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleDeleteAllOtherVersions = async () => {
        if (history.length <= 1) {
            alert('There is only one version or no versions to delete.');
            return;
        }

        const currentVersion = history[0]; // Assuming first is the latest/current
        const versionsToDelete = history.slice(1); // All except the current

        setConfirmState({
            isOpen: true,
            title: 'Delete All Other Versions?',
            message: `Are you sure you want to delete ${versionsToDelete.length} older version(s)? This will keep only the current version (${currentVersion.versionNumber || currentVersion.id}). This action cannot be undone.`,
            confirmText: 'Delete All Others',
            isDangerous: true,
            onConfirm: async () => {
                try {
                    // Delete all versions except the current one
                    for (const ver of versionsToDelete) {
                        // @ts-ignore
                        await window.api.draft.delete(projectRoot, ver.id);
                    }

                    // Refresh the history
                    // @ts-ignore
                    const fullHistory = await window.api.draft.getHistory(projectRoot);

                    // Filter to only show versions for the current file
                    const relPath = getRelativePath();
                    if (relPath) {
                        const filtered = fullHistory.filter(ver => {
                            if (ver.files[relPath]) return true;
                            const normPath = relPath.replace(/\\/g, '/');
                            const hasKey = Object.keys(ver.files).some(k => k.replace(/\\/g, '/') === normPath);
                            return hasKey;
                        });
                        setHistory(filtered);
                    } else {
                        setHistory([]);
                    }

                    alert(`Successfully deleted ${versionsToDelete.length} version(s).`);
                } catch (e) {
                    console.error('Failed to delete versions:', e);
                    alert('Failed to delete some versions. Check console for details.');
                }
                setConfirmState(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // Todo Logic
    const handleAddTodo = (text: string, priority: Priority, tags: string[]) => {
        const item: TodoItem = {
            id: Date.now().toString(),
            text: text.trim(),
            completed: false,
            createdAt: Date.now(),
            priority,
            tags
        };
        saveTodos([...todos, item]);
    };

    const toggleTodo = (id: string) => {
        const newList = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveTodos(newList);
    };

    const deleteTodo = (id: string) => {
        saveTodos(todos.filter(t => t.id !== id));
    };

    // Attachment Logic
    const handleAddAttachment = async () => {
        if (!projectRoot) {
            alert("No project root found.");
            return;
        }

        // @ts-ignore
        const filePath = await window.api.openFile({
            filters: [
                { name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp', 'svg'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (filePath) {
            // @ts-ignore
            const result = await window.api.draft.saveAttachment(projectRoot, filePath);

            if (result.success) {
                const newAttach: AttachmentItem = {
                    id: Date.now().toString(),
                    type: 'image',
                    path: result.path,
                    name: filePath.split(/[/\\]/).pop() || 'image',
                    createdAt: Date.now()
                };
                saveAttachments([...attachments, newAttach]);
            } else {
                alert('Failed to save attachment');
            }
        }
    };

    const resolveAttachmentPath = (attPath: string) => {
        let fullPath = attPath;
        if (attPath.startsWith('attachments/')) {
            fullPath = `${projectRoot}/.draft/${attPath}`;
        }

        // Normalize slashes
        fullPath = fullPath.replace(/\\/g, '/');

        // Ensure absolute paths start with / for file:// protocol
        // e.g. C:/... -> /C:/... -> file:///C:/...
        if (!fullPath.startsWith('/')) {
            fullPath = '/' + fullPath;
        }

        return `file://${fullPath}`;
    };

    const deleteAttachment = (id: string) => {
        saveAttachments(attachments.filter(a => a.id !== id));
    };

    // Drag and Drop Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only stop dragging if we're leaving the container
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0 || !projectRoot) return;

        const newAttachments: AttachmentItem[] = [];

        for (const fileItem of files) {
            // @ts-ignore
            const filePath = fileItem.path;
            if (!filePath) continue;

            try {
                // @ts-ignore
                const result = await window.api.draft.saveAttachment(projectRoot, filePath);

                if (result.success) {
                    newAttachments.push({
                        id: Date.now().toString() + Math.random().toString().slice(2),
                        type: 'image',
                        path: result.path,
                        name: filePath.split(/[/\\]/).pop() || 'image',
                        createdAt: Date.now()
                    });
                }
            } catch (err) {
                console.error("Failed to save attachment:", err);
            }
        }

        if (newAttachments.length > 0) {
            const updatedAttachments = [...attachments, ...newAttachments];
            setAttachments(updatedAttachments);
            persistMetadata(todos, updatedAttachments);
        }
    };

    const renderContent = () => {
        if (!file) {
            return (
                <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Info size={48} className="text-muted" style={{ opacity: 0.3, marginBottom: 12 }} />
                    <span className="text-muted" style={{ opacity: 0.5, fontSize: '14px' }}>No file or folder selected</span>
                </div>
            );
        }

        switch (activeTab) {
            case 'info':
                return (
                    <>
                        <div className="preview-large">
                            {file.isDirectory ?
                                <Folder size={64} className="preview-icon-folder" color="#5e6ad2" /> :
                                <File size={64} className="preview-icon-file" color="#aaa" />
                            }
                        </div>
                        <div className="inspector-props">
                            <div className="prop-row">
                                <label>Name</label>
                                <div className="val">{file.name}</div>
                            </div>
                            <div className="prop-row">
                                <label>Type</label>
                                <div className="val">{file.type}</div>
                            </div>
                            <div className="prop-row">
                                <label>Size</label>
                                <div className="val">{formatSize(file.size)}</div>
                            </div>
                            <div className="prop-row">
                                <label>Modified</label>
                                <div className="val">{formatDate(file.mtime)}</div>
                            </div>
                            <div className="prop-row">
                                <label>Full Path</label>
                                <div className="val path-val">{file.path}</div>
                            </div>
                        </div>
                    </>
                );
            case 'tasks':
                return (
                    <TodoList
                        todos={todos}
                        onAdd={handleAddTodo}
                        onToggle={toggleTodo}
                        onDelete={deleteTodo}
                    />
                );
            case 'versions':
                return (
                    <div className="versions-list">
                        {isCreating && (
                            <div className="creation-form">
                                <input
                                    className="creation-input"
                                    placeholder="Version Label (e.g. Added textures)"
                                    value={versionLabel}
                                    onChange={e => setVersionLabel(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleCreateVersion();
                                        }
                                    }}
                                    autoFocus
                                />
                                <div className="creation-actions">
                                    <button onClick={() => setIsCreating(false)} className="btn-cancel">Cancel</button>
                                    <button onClick={handleCreateVersion} disabled={loading} className="btn-commit">{loading ? 'Saving...' : 'Commit'}</button>
                                </div>
                            </div>
                        )}
                        {history.map((ver, idx) => (
                            <div key={idx} className={`version-item ${ver.id === activeVersionId ? 'active' : ''}`}>
                                <div className="version-left">
                                    <div className="version-badge" title={`ID: ${ver.id}`}>
                                        {idx === 0 && <GitBranch size={12} style={{ marginRight: 6 }} />}
                                        v{history.length - idx}
                                    </div>
                                </div>
                                <div className="version-content">
                                    <div className="version-title">{ver.label}</div>
                                    <div className="version-meta">
                                        <span>{new Date(ver.timestamp).toLocaleString(undefined, {
                                            year: 'numeric', month: 'short', day: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })}</span>
                                        <span>{Object.keys(ver.files).length} files • {formatSize(ver.totalSize || 0)}</span>
                                    </div>
                                </div>
                                <div className="version-actions-right">
                                    <button
                                        className="version-action-btn"
                                        onClick={() => handleDownload(ver, history.length - idx)}
                                        title={file.isDirectory ? "Cannot download directory" : "Download this file version"}
                                        disabled={file.isDirectory}
                                        style={file.isDirectory ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                    >
                                        <Download size={14} />
                                    </button>
                                    <button className="version-action-btn" onClick={() => handleDeleteVersion(ver.id)} title="Delete"><Trash2 size={14} /></button>
                                    <button className="version-action-btn" onClick={() => handleRestore(ver.id)} title="Restore (Overwrites current)"><RotateCcw size={14} /></button>
                                </div>
                            </div>
                        ))}
                        {history.length === 0 && !isCreating && (
                            <div className="empty-state">No versions found. Create one above!</div>
                        )}
                    </div>
                );
            case 'attachments':
                return (
                    <div
                        className="attachments-container"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className={`attachments-dropzone ${isDragging ? 'drag-active' : ''}`}>
                            <div className="attachments-grid">
                                {attachments.map((att, i) => (
                                    <div
                                        key={att.id}
                                        className="attachment-item"
                                        onClick={() => setPreviewImage(resolveAttachmentPath(att.path))}
                                        style={{ animationDelay: `${i * 50}ms` }}
                                    >
                                        {att.type === 'image' && (
                                            <img
                                                src={resolveAttachmentPath(att.path)}
                                                alt={att.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        )}
                                        <div className="attachment-overlay">
                                            <button
                                                className="delete-attachment-btn"
                                                onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }}
                                                title="Remove attachment"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <div className="attachment-name">
                                                {att.name}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {attachments.length === 0 || isDragging ? (
                                <div
                                    className="upload-placeholder"
                                    onClick={handleAddAttachment}
                                    style={{ cursor: 'pointer', minHeight: attachments.length > 0 ? '150px' : '300px' }}
                                >
                                    <div className="upload-icon-circle">
                                        <Upload size={24} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ color: '#e0e0e0', fontWeight: 500, marginBottom: 4 }}>
                                            {isDragging ? 'Drop images here' : 'Click or Drop Images'}
                                        </div>
                                        {!isDragging && (
                                            <div style={{ fontSize: 12, color: '#666' }}>
                                                Supports JPG, PNG, GIF, WEBP
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <button className="upload-btn" onClick={handleAddAttachment} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', marginTop: 'auto' }}>
                                    <Plus size={16} /> Add Another Image
                                </button>
                            )}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <aside className="inspector-panel" style={{ width: width }} ref={sidebarRef}>
            <div className="resize-handle" onMouseDown={startResizing} />

            <div className="inspector-sidebar">
                <button
                    className={`sidebar-icon-btn ${activeTab === 'info' ? 'active' : ''}`}
                    onClick={() => setActiveTab('info')}
                    title="Info"
                >
                    <Info size={18} />
                </button>

                <button
                    className={`sidebar-icon-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tasks')}
                    title="Tasks"
                >
                    <CheckCircle size={18} />
                </button>

                <button
                    className={`sidebar-icon-btn ${activeTab === 'versions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('versions')}
                    title="Versions"
                >
                    <Layers size={18} />
                </button>
                <button
                    className={`sidebar-icon-btn ${activeTab === 'attachments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('attachments')}
                    title="Attachments"
                >
                    <Paperclip size={18} />
                </button>

                <div className="sidebar-spacer"></div>

                <button
                    className="sidebar-icon-btn"
                    onClick={onClose}
                    title="Close Panel"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="inspector-content">
                <div className="inspector-header">
                    <h3>
                        {activeTab === 'versions' ? 'Versions' :
                            activeTab === 'tasks' ? 'Tasks' :
                                activeTab === 'attachments' ? 'Attachments' : 'Details'}
                    </h3>
                    {activeTab === 'versions' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            {history.length > 1 && (
                                <button
                                    className="btn-cancel"
                                    onClick={handleDeleteAllOtherVersions}
                                    style={{ fontSize: 12, padding: '6px 12px' }}
                                    title="Delete all versions except the current one"
                                >
                                    Delete All Others
                                </button>
                            )}
                            {file && <button className="upload-btn" onClick={() => setIsCreating(true)}>+ New Version</button>}
                        </div>
                    )}
                </div>
                {renderContent()}
            </div>

            <ConfirmDialog
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.confirmText}
                isDangerous={confirmState.isDangerous}
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
            />

            {previewImage && (
                <div
                    className="image-preview-modal"
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'fadeIn 0.2s ease'
                    }}
                    onClick={() => setPreviewImage(null)}
                >
                    <button
                        onClick={() => setPreviewImage(null)}
                        style={{
                            position: 'absolute', top: 20, right: 20,
                            background: 'none', border: 'none', color: 'white', cursor: 'pointer'
                        }}
                    >
                        <X size={32} />
                    </button>
                    <img
                        src={previewImage}
                        alt="Preview"
                        style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </aside>
    );
};

export default InspectorPanel;
