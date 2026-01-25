import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    X, Info, Layers, Paperclip,
    CheckCircle, Plus
} from 'lucide-react';
import '../styles/InspectorPanel.css';

import ConfirmDialog from './ConfirmDialog';
import TodoList, { TodoItem, Priority } from './TodoList';
import InfoTab from './inspector/InfoTab';
import VersionsTab from './inspector/VersionsTab';
import AttachmentsTab from './inspector/AttachmentsTab';
import { InspectorPanelProps, AttachmentItem } from './inspector/types';

type Tab = 'info' | 'tasks' | 'versions' | 'attachments';

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;

const InspectorPanel: React.FC<InspectorPanelProps> = ({ file, projectRoot, onClose, onRefresh }) => {
    const [activeTab, setActiveTab] = useState<Tab>('versions');
    const [width, setWidth] = useState(420);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Tasks & Attachments State
    const [todos, setTodos] = useState<TodoItem[]>([]);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Tags State
    const [tags, setTags] = useState<string[]>([]);

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
                const meta = await window.api.draft.getMetadata(projectRoot, relPath);
                if (meta) {
                    setTodos(meta.tasks || []);
                    setAttachments(meta.attachments || []);
                    setTags(meta.tags || []);
                } else {
                    setTodos([]);
                    setAttachments([]);
                    setTags([]);
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
            await window.api.draft.saveMetadata(projectRoot, relPath, {
                tasks: newTodos,
                attachments: newAttachments,
                tags: tags // Pass current tags
            });
        } catch (e) {
            console.error("Failed to save metadata", e);
        }
    };

    const saveTags = (newTags: string[]) => {
        setTags(newTags);
        // We need to persist via metadata
        const relPath = getRelativePath();
        if (!relPath || !projectRoot) return;

        // Use current todos and attachments
        window.api.draft.saveMetadata(projectRoot, relPath, {
            tasks: todos,
            attachments: attachments,
            tags: newTags
        }).catch((e: any) => console.error(e));
    };

    const addTag = (val: string) => {
        if (val && !tags.includes(val)) {
            const newTags = [...tags, val];
            saveTags(newTags);
        }
    };

    const removeTag = (t: string) => {
        saveTags(tags.filter(tag => tag !== t));
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


    // Versions
    useEffect(() => {
        if ((activeTab === 'versions' || activeTab === 'tasks') && projectRoot && file) {
            const loadVersions = async () => {
                const relPath = getRelativePath();
                if (!relPath) {
                    setHistory([]);
                    return;
                }

                try {
                    const filtered = await window.api.draft.getHistory(projectRoot, relPath);
                    const currentHead = await window.api.draft.getCurrentHead(projectRoot);

                    if (currentHead && filtered.some(v => v.id === currentHead)) {
                        setActiveVersionId(currentHead);
                    } else if (filtered.length > 0) {
                        setActiveVersionId(filtered[0].id);
                    }
                    setHistory(filtered);
                } catch (err) {
                    console.error("Failed to load history:", err);
                    setHistory([]);
                }
            };

            loadVersions();
        }
        // We generally don't want to clear history immediately if switching to other tabs 
        // to avoid flicker if we switch back, but strictly following previous logic for now
        // just expanding the inclusion criteria. 
        else if (activeTab !== 'versions' && activeTab !== 'tasks') {
            setHistory([]);
        }
    }, [activeTab, projectRoot, file, getRelativePath]);

    const recursiveScan = async (dir: string): Promise<string[]> => {
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
            if (file.isDirectory) {
                filesToVersion = await recursiveScan(file.path);
            } else {
                filesToVersion = [file.path];
            }

            console.log('📦 Creating version for:', filesToVersion);

            const result = await window.api.draft.commit(projectRoot, versionLabel, filesToVersion);
            if (result && result.success && result.versionId) {
                setActiveVersionId(result.versionId);
            }

            setVersionLabel('');
            setIsCreating(false);

            const relPath = getRelativePath();
            if (relPath) {
                const filtered = await window.api.draft.getHistory(projectRoot, relPath);
                setHistory(filtered);
                onRefresh?.();
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
                await window.api.draft.restore(projectRoot, vId);
                setActiveVersionId(vId);
                onRefresh?.();
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

        const newFileName = `${nameWithoutExt} -v${customVerNum}${ext} `;
        const parentDir = file.path.substring(0, file.path.lastIndexOf(file.name));
        const destPath = parentDir + newFileName;

        const performExtraction = async () => {
            try {
                await window.api.draft.extract(projectRoot, ver.id, relativePath, destPath);
            } catch (e: any) {
                alert(`Failed to save: ${e.message || e} `);
            }
            setConfirmState(prev => ({ ...prev, isOpen: false }));
        };

        // Check availability
        const stats = await window.api.getStats(destPath);
        if (stats) {
            setConfirmState({
                isOpen: true,
                title: 'File Exists',
                message: `"${newFileName}" already exists.Do you want to overwrite it ? `,
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
                await window.api.draft.delete(projectRoot, vId);

                const relPath = getRelativePath();
                if (relPath) {
                    const filtered = await window.api.draft.getHistory(projectRoot, relPath);
                    setHistory(filtered);
                    onRefresh?.();
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
            message: `Are you sure you want to delete ${versionsToDelete.length} older version(s) ? This will keep only the current version(${currentVersion.versionNumber || currentVersion.id}).This action cannot be undone.`,
            confirmText: 'Delete All Others',
            isDangerous: true,
            onConfirm: async () => {
                try {
                    // Delete all versions except the current one
                    for (const ver of versionsToDelete) {
                        await window.api.draft.delete(projectRoot, ver.id);
                    }

                    // Refresh the history
                    const relPath = getRelativePath();
                    if (relPath) {
                        const filtered = await window.api.draft.getHistory(projectRoot, relPath);
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

    const handleRenameVersion = async (vId: string, newLabel: string) => {
        if (!projectRoot || !newLabel.trim()) return;

        try {
            await window.api.draft.renameVersion(projectRoot, vId, newLabel.trim());

            // Refresh the history
            const relPath = getRelativePath();
            if (relPath) {
                const filtered = await window.api.draft.getHistory(projectRoot, relPath);
                setHistory(filtered);
            }
        } catch (e) {
            console.error('Failed to rename version:', e);
            alert('Failed to rename version. Check console for details.');
        }
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

        const filePath = await window.api.openFile({
            filters: [
                { name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp', 'svg'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (filePath) {
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
                    <InfoTab
                        file={file}
                        tags={tags}
                        onAddTag={addTag}
                        onRemoveTag={removeTag}
                    />
                );
            case 'tasks':
                return (
                    <TodoList
                        todos={todos}
                        onAdd={handleAddTodo}
                        onToggle={toggleTodo}
                        onDelete={deleteTodo}
                        availableVersions={history} // Pass available versions
                    />
                );
            case 'versions':
                return (
                    <VersionsTab
                        history={history}
                        isCreating={isCreating}
                        setIsCreating={setIsCreating}
                        versionLabel={versionLabel}
                        setVersionLabel={setVersionLabel}
                        onCreateVersion={handleCreateVersion}
                        loading={loading}
                        activeVersionId={activeVersionId}
                        file={file}
                        onDownload={handleDownload}
                        onDelete={handleDeleteVersion}
                        onRestore={handleRestore}
                        onRename={handleRenameVersion}
                    />
                );
            case 'attachments':
                return (
                    <AttachmentsTab
                        attachments={attachments}
                        onAdd={handleAddAttachment}
                        onDelete={deleteAttachment}
                        onPreview={setPreviewImage}
                        onResolvePath={resolveAttachmentPath}
                        isDragging={isDragging}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    />
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
                            {file && (
                                <button
                                    className="upload-btn icon-only"
                                    onClick={() => setIsCreating(true)}
                                    title="Create New Version"
                                >
                                    <Plus size={16} />
                                </button>
                            )}
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
