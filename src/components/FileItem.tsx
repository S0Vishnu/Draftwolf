
import React, { useRef, useEffect } from 'react';
import { Folder, File, Edit2, Trash2 } from 'lucide-react';

export interface FileEntry {
    name: string;
    isDirectory: boolean;
    path: string;
    size?: number;
    mtime?: Date;
    type?: string;
    latestVersion?: string;
}

interface FileItemProps {
    file: FileEntry;
    viewMode: 'list' | 'grid';
    selected: boolean;
    renaming: boolean;
    renameValue: string;
    onSelect: (e: React.MouseEvent) => void;
    onNavigate: () => void;
    onRenameChange: (val: string) => void;
    onRenameSubmit: () => void;
    onRenameCancel: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

const FileItem: React.FC<FileItemProps> = ({
    file,
    viewMode,
    selected,
    renaming,
    renameValue,
    onSelect,
    onNavigate,
    onRenameChange,
    onRenameSubmit,
    onRenameCancel,
    onContextMenu
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (renaming && inputRef.current) {
            inputRef.current.focus();
            const name = inputRef.current.value;
            if (file.isDirectory) {
                inputRef.current.select();
            } else {
                // Select only the name part, excluding extension
                const lastDotIndex = name.lastIndexOf('.');
                if (lastDotIndex > 0) {
                    inputRef.current.setSelectionRange(0, lastDotIndex);
                } else {
                    inputRef.current.select();
                }
            }
        }
    }, [renaming, file.isDirectory]);

    // Formatters
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
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // --- List View Render ---
    if (viewMode === 'list') {
        return (
            <div
                className={`list-row ${selected ? 'selected' : ''}`}
                data-path={file.path}
                onClick={onSelect}
                onDoubleClick={onNavigate}
                onContextMenu={onContextMenu}
            >
                <div className="col col-icon">
                    {file.isDirectory ?
                        <Folder size={18} className="folder-icon" /> :
                        <File size={18} className="file-icon" />
                    }
                </div>

                <div className="col col-name">
                    {renaming ? (
                        <div className="rename-box" onClick={e => e.stopPropagation()}>
                            <input
                                ref={inputRef}
                                value={renameValue}
                                onChange={(e) => onRenameChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onRenameSubmit();
                                    if (e.key === 'Escape') onRenameCancel();
                                }}
                                onBlur={onRenameSubmit}
                            />
                        </div>
                    ) : (
                        <span className="name-text" title={file.name}>{file.name}</span>
                    )}
                </div>

                <div className="col col-date">{formatDate(file.mtime)}</div>
                <div className="col col-size">{!file.isDirectory ? formatSize(file.size) : '--'}</div>
                <div className="col col-type">{file.type || 'Unknown'}</div>
                <div className="col col-version">
                    {file.latestVersion ? <span className="version-badge">v{file.latestVersion}</span> : ''}
                </div>
            </div>
        );
    }

    // --- Grid View Render ---
    return (
        <div
            className={`grid-card ${selected ? 'selected' : ''}`}
            data-path={file.path}
            onClick={onSelect}
            onDoubleClick={onNavigate}
            onContextMenu={onContextMenu}
        >
            <div className="card-icon">
                {file.latestVersion && (
                    <div className="version-indicator-tile">
                        v{file.latestVersion}
                    </div>
                )}
                {file.isDirectory ?
                    <Folder size={48} className="folder-icon-large" /> :
                    <File size={48} className="file-icon-large" />
                }
            </div>

            <div className="card-name">
                {renaming ? (
                    <div className="rename-box-grid" onClick={e => e.stopPropagation()}>
                        <input
                            ref={inputRef}
                            value={renameValue}
                            onChange={(e) => onRenameChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onRenameSubmit();
                                if (e.key === 'Escape') onRenameCancel();
                            }}
                            onBlur={onRenameSubmit}
                        />
                    </div>
                ) : (
                    <span title={file.name}>{file.name}</span>
                )}
            </div>
        </div>
    );
};

export default FileItem;
