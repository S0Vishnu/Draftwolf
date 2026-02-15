
import React from 'react';
import FileItem, { FileEntry } from './FileItem';
import { Lock } from '../services/LockService';
import { shouldShowEntry } from '../utils/ignorePatterns';


interface FileListProps {
    files: FileEntry[];
    viewMode: 'list' | 'grid';
    selectedPaths: Set<string>;
    renamingFile: string | null;
    renameValue: string;
    sortConfig: { key: keyof FileEntry, direction: 'asc' | 'desc' } | null;

    // View Options
    showExtensions?: boolean;

    // Creation State

    // ... rest
    isCreating: 'folder' | 'file' | null;
    creationName: string;

    // Handlers
    onSort: (key: keyof FileEntry) => void;
    onSelect: (e: React.MouseEvent, file: FileEntry) => void;
    onNavigate: (path: string) => void;
    onRenameChange: (val: string) => void;
    onRenameSubmit: () => void;
    onRenameCancel: () => void;
    onContextMenu: (e: React.MouseEvent, file?: FileEntry) => void;
    onVersionClick?: (e: React.MouseEvent, file: FileEntry) => void;

    // Creation Handlers
    onCreationChange: (val: string) => void;
    onCreationSubmit: () => void;
    onCreationCancel: () => void;

    // Lock support
    locks?: Map<string, Lock>;
    projectRoot?: string | null;
    currentUserId?: string;

    // Ignore pattern support
    ignorePatterns?: string[];
}


const FileList: React.FC<FileListProps> = ({
    files, viewMode, selectedPaths, renamingFile, renameValue, sortConfig,
    isCreating, creationName, showExtensions = true,
    onSort, onSelect, onNavigate, onRenameChange, onRenameSubmit, onRenameCancel, onContextMenu, onVersionClick,
    onCreationChange, onCreationSubmit, onCreationCancel,
    locks, projectRoot, currentUserId,
    ignorePatterns
}) => {


    const creationItem: FileEntry | null = isCreating ? {
        name: creationName,
        isDirectory: isCreating === 'folder',
        path: 'temp-creation-path',
        mtime: new Date(),
        type: isCreating === 'folder' ? 'Folder' : 'Text File'
    } : null;

    return (
        <>
            {/* List Header (Sticky) */}
            {viewMode === 'list' && (
                <div className="list-header">
                    <div className="col col-icon"></div>
                    <div className="col col-name sortable" onClick={() => onSort('name')}>
                        Name {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col col-version">Version</div>
                    <div className="col col-date sortable" onClick={() => onSort('mtime')}>
                        Date Modified {sortConfig?.key === 'mtime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col col-size sortable" onClick={() => onSort('size')}>
                        Size {sortConfig?.key === 'size' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col col-type">Type</div>
                </div>
            )}

            {/* Content Area */}
            <div
                className={viewMode === 'list' ? 'file-list' : 'file-grid'}
                onContextMenu={(e) => onContextMenu(e)}
            >

                {isCreating && creationItem && (
                    <FileItem
                        key="creation-item"
                        file={creationItem}
                        viewMode={viewMode}
                        selected={true}
                        renaming={true}
                        renameValue={creationName}
                        showExtensions={showExtensions}
                        onSelect={() => { }}
                        onNavigate={() => { }}
                        onRenameChange={onCreationChange}
                        onRenameSubmit={onCreationSubmit}
                        onRenameCancel={onCreationCancel}
                        onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    />
                )}

                {files.map((file) => {
                    // Calculate lock status
                    let isLocked = false;
                    let lockedBy = undefined;

                    if (locks && projectRoot) {
                        let rel = file.path;
                        if (file.path.startsWith(projectRoot)) {
                            rel = file.path.substring(projectRoot.length);
                            if (rel.startsWith('/') || rel.startsWith('\\')) rel = rel.substring(1);
                        }
                        const lock = locks.get(rel);
                        if (lock) {
                            isLocked = true;
                            if (currentUserId && lock.userId === currentUserId) {
                                // Locked by me
                                lockedBy = 'You';
                            } else {
                                lockedBy = lock.userEmail;
                            }
                        }
                    }

                    // Compute ignored status
                    let isIgnored = false;
                    if (ignorePatterns && ignorePatterns.length > 0 && projectRoot && file.path.startsWith(projectRoot)) {
                        let relPath = file.path.substring(projectRoot.length);
                        if (relPath.startsWith('\\') || relPath.startsWith('/')) relPath = relPath.substring(1);
                        isIgnored = !shouldShowEntry(file.name, relPath, ignorePatterns);
                    }

                    return (
                        <FileItem
                            key={file.path}
                            file={file}
                            viewMode={viewMode}
                            selected={selectedPaths.has(file.path)}
                            renaming={renamingFile === file.path}
                            renameValue={renameValue}
                            showExtensions={showExtensions}
                            onSelect={(e) => onSelect(e, file)}
                            onNavigate={() => onNavigate(file.path)}
                            onRenameChange={onRenameChange}
                            onRenameSubmit={onRenameSubmit}
                            onRenameCancel={onRenameCancel}
                            onContextMenu={(e) => onContextMenu(e, file)}
                            onVersionClick={onVersionClick ? (e) => onVersionClick(e, file) : undefined}
                            isLocked={isLocked}
                            lockedBy={lockedBy}
                            isIgnored={isIgnored}
                        />
                    )
                })}

            </div>

            {files.length === 0 && !isCreating && (
                <div className="empty-state" onContextMenu={(e) => onContextMenu(e)}>
                    <p>This folder is empty.</p>
                </div>
            )}
        </>
    );
};

export default FileList;
