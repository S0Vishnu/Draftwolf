
import React, { useRef, useEffect } from 'react';
import FileIcon from './FileIcon';

export interface FileEntry {
    name: string;
    isDirectory: boolean;
    path: string;
    size?: number;
    mtime?: Date;
    type?: string;
    latestVersion?: string;
    tags?: string[];
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
    onVersionClick?: (e: React.MouseEvent) => void;
    showExtensions?: boolean;
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
    onContextMenu,
    onVersionClick,
    showExtensions = true
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

    const getDisplayName = () => {
        if (file.isDirectory || showExtensions) return file.name;
        const parts = file.name.split('.');
        if (parts.length > 1) {
            // Check if it starts with dot (hidden file), usually we don't strip extension then?
            // But if showHiddenFiles is true, we see them.
            // If file is just ".gitignore", parts=["", "gitignore"].
            if (parts[0] === '' && parts.length === 2) return file.name;

            parts.pop();
            return parts.join('.');
        }
        return file.name;
    };

    const displayName = getDisplayName();

    // --- List View Render ---
    if (viewMode === 'list') {
        return (
            <div
                className={`list-row ${selected ? 'selected' : ''}`}
                data-path={file.path}
                onMouseDown={onSelect}
                onDoubleClick={onNavigate}
                onContextMenu={onContextMenu}
            >
                <div className="col col-icon">
                    <FileIcon name={file.name} path={file.path} isDirectory={file.isDirectory} size={18} />
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
                        <span className="name-text" title={file.name}>{displayName}</span>
                    )}
                </div>

                <div className="col col-version">
                    {file.latestVersion ? <span className="version-badge-list">v{file.latestVersion}</span> : ''}
                </div>

                <div className="col col-date">{formatDate(file.mtime)}</div>
                <div className="col col-size">{!file.isDirectory ? formatSize(file.size) : '--'}</div>
                <div className="col col-type">{file.type || 'Unknown'}</div>
            </div>
        );
    }

    // --- Grid View Render ---
    return (
        <div
            className={`grid-card ${selected ? 'selected' : ''}`}
            data-path={file.path}
            onMouseDown={onSelect}
            onDoubleClick={onNavigate}
            onContextMenu={onContextMenu}
        >
            <div className="card-icon">
                {file.latestVersion && (
                    <div
                        className="version-indicator-tile clickable"
                        onClick={(e) => {
                            e.stopPropagation();
                            onVersionClick?.(e);
                        }}
                        title="View version details"
                    >
                        v{file.latestVersion}
                    </div>
                )}
                <FileIcon name={file.name} path={file.path} isDirectory={file.isDirectory} size={58} />
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
                    <span title={file.name}>{displayName}</span>
                )}
            </div>
        </div>
    );
};

export default FileItem;
