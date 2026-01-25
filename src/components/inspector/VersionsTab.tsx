import React, { } from 'react';
import { GitBranch, Trash2, RotateCcw, Download } from 'lucide-react';
import { FileEntry } from '../FileItem';

interface VersionsTabProps {
    history: any[];
    isCreating: boolean;
    setIsCreating: (val: boolean) => void;
    versionLabel: string;
    setVersionLabel: (val: string) => void;
    onCreateVersion: () => void;
    loading: boolean;
    activeVersionId: string | null;
    file: FileEntry;
    onDownload: (ver: any, verNum: number) => void;
    onDelete: (id: string) => void;
    onRestore: (id: string) => void;
}

const VersionsTab: React.FC<VersionsTabProps> = ({
    history,
    isCreating,
    setIsCreating,
    versionLabel,
    setVersionLabel,
    onCreateVersion,
    loading,
    activeVersionId,
    file,
    onDownload,
    onDelete,
    onRestore
}) => {

    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return '--';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const scrollToVersion = (verNum: number) => {
        const el = document.getElementById(`version-item-${verNum}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight effect
            el.classList.add('highlight-flash');
            setTimeout(() => el.classList.remove('highlight-flash'), 1800);
        }
    };

    return (
        <div className="versions-list">
            {isCreating && (
                <div className="creation-form">
                    <textarea
                        className="creation-input"
                        placeholder="Version Label (e.g. Added textures)"
                        value={versionLabel}
                        onChange={e => setVersionLabel(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                e.stopPropagation();
                                onCreateVersion();
                            }
                        }}
                        onInput={(e) => {
                            const target = e.currentTarget;
                            target.style.height = 'auto';
                            target.style.height = target.scrollHeight + 'px';
                        }}
                        rows={1}
                        autoFocus
                    />
                    <div className="creation-actions">
                        <button onClick={() => setIsCreating(false)} className="btn-cancel">Cancel</button>
                        <button onClick={onCreateVersion} disabled={loading} className="btn-commit">{loading ? 'Saving...' : 'Commit'}</button>
                    </div>
                </div>
            )}
            {history.map((ver, idx) => {
                if (!ver) return null;
                const verNum = history.length - idx;

                // Try to find actual parent version number
                const parentId = ver.parent || (ver.parents && ver.parents[0]) || ver.parentId;
                let displayParentNum: number | null = null;

                if (parentId) {
                    const pIdx = history.findIndex((v: any) => v.id === parentId);
                    if (pIdx !== -1) {
                        displayParentNum = history.length - pIdx;
                    }
                }

                // Fallback to previous in list if no parent info or parent not in filtered list
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const finalParentNum = displayParentNum !== null ? displayParentNum : (idx < history.length - 1 ? verNum - 1 : null);

                return (
                    <div
                        key={idx}
                        id={`version-item-${verNum}`}
                        className={`version-item ${ver.id === activeVersionId ? 'active' : ''}`}
                    >
                        <div className="version-left">
                            <div className="version-badge" title={`ID: ${ver.id}`}>
                                {idx === 0 && <GitBranch size={12} style={{ marginRight: 6 }} />}
                                v{verNum}
                            </div>
                        </div>
                        <div className="version-content">
                            <div className="version-title">{ver.label || 'Untitled Version'}</div>
                            <div className="version-meta">
                                <span>{ver.timestamp ? new Date(ver.timestamp).toLocaleString(undefined, {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                }) : 'Unknown date'}</span>
                                <span className="version-meta-row">
                                    {Object.keys(ver.files || {}).length} files • {formatSize(ver.totalSize || 0)}
                                    {finalParentNum !== null && (
                                        <span
                                            className="version-from-indicator clickable"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                scrollToVersion(finalParentNum);
                                            }}
                                            title={`Scroll to version ${finalParentNum}`}
                                        >
                                            from v{finalParentNum}
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>
                        <div className="version-actions-right">
                            <button
                                className="version-action-btn"
                                onClick={() => onDownload(ver, verNum)}
                                title={file.isDirectory ? "Cannot download directory" : "Download this file version"}
                                disabled={file.isDirectory}
                                style={file.isDirectory ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                                <Download size={14} />
                            </button>
                            <button className="version-action-btn" onClick={() => onDelete(ver.id)} title="Delete"><Trash2 size={14} /></button>
                            <button className="version-action-btn" onClick={() => onRestore(ver.id)} title="Restore (Overwrites current)"><RotateCcw size={14} /></button>
                        </div>
                    </div>
                );
            })}
            {history.length === 0 && !isCreating && (
                <div className="empty-state">No versions found. Create one above!</div>
            )}
        </div>
    );
};

export default VersionsTab;
