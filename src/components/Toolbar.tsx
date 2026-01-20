
import React from 'react';
import {
    ChevronLeft, ChevronRight, Home as HomeIcon, ChevronRight as ChevronRightIcon,
    FolderPlus, FilePlus, List, LayoutGrid, Settings, Check, Eye, EyeOff, RotateCw
} from 'lucide-react';
import { FileEntry } from './FileItem';

interface ToolbarProps {
    currentPath: string | null;
    historyIndex: number;
    historyLength: number;
    viewMode: 'list' | 'grid';
    rootDir: string | null;

    // Options
    showHiddenFiles: boolean;
    showExtensions: boolean;
    sortConfig: { key: keyof FileEntry, direction: 'asc' | 'desc' } | null;

    onToggleHiddenFiles: () => void;
    onToggleExtensions: () => void;
    onSort: (key: keyof FileEntry) => void;
    onRefresh: () => void;

    onNavigateBack: () => void;
    onNavigateForward: () => void;
    onOpenWorkspace: () => void;
    onCreateFolder: () => void;
    onCreateFile: () => void;
    setViewMode: (mode: 'list' | 'grid') => void;
    onNavigate: (path: string) => void;
}

// Update `Toolbar` destructuring first to include new props
const Toolbar: React.FC<ToolbarProps> = ({
    currentPath,
    historyIndex,
    historyLength,
    viewMode,
    rootDir,
    showHiddenFiles,
    showExtensions,
    sortConfig,
    onToggleHiddenFiles,
    onToggleExtensions,
    onSort,
    onRefresh,
    onNavigateBack,
    onNavigateForward,
    onOpenWorkspace,
    onCreateFolder,
    onCreateFile,
    setViewMode,
    onNavigate
}) => {
    // Helper to rebuild path up to index
    const getPathAtIndex = (parts: string[], index: number) => {
        const slice = parts.slice(0, index + 1);
        let joined = slice.join('/');

        if (slice.length === 1 && slice[0] === '') return '/';
        if (parts[0] === '' && slice.length > 1) {
            return slice.join('/');
        }
        if (index === 0 && parts[0].includes(':')) return parts[0] + '/';

        return joined;
    };

    const [isOptionsOpen, setOptionsOpen] = React.useState(false);
    const optionsRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
                setOptionsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getSortIcon = (key: keyof FileEntry) => {
        if (sortConfig?.key !== key) return null;
        return <span className='sort-arrow'>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="toolbar">
            <div className="path-breadcrumbs">
                <div className="nav-arrows">
                    <button className="nav-btn" onClick={onNavigateBack} disabled={historyIndex <= 0}>
                        <ChevronLeft size={16} />
                    </button>
                    <button className="nav-btn" onClick={onNavigateForward} disabled={historyIndex >= historyLength - 1}>
                        <ChevronRight size={16} />
                    </button>
                    <button className="nav-btn" onClick={onRefresh} title="Refresh">
                        <RotateCw size={14} />
                    </button>
                </div>
                <div className="divider-v"></div>
                <div className="breadcrumbs-list">
                    {/* Home/Root Icon */}
                    <HomeIcon
                        size={14}
                        className={`crumb-home ${!currentPath ? '' : 'clickable'}`}
                        onClick={onOpenWorkspace}
                    />

                    {(() => {
                        // Normalize paths for comparison (handle Windows backslashes)
                        const normCurrent = currentPath ? currentPath.replace(/\\/g, '/') : '';
                        const normRoot = rootDir ? rootDir.replace(/\\/g, '/') : '';

                        // Check if current path is inside root (case insensitive check for Windows could be added, but robust startswith is okay for now)
                        if (normCurrent && normRoot && normCurrent.startsWith(normRoot)) {
                            // Calculate relative path parts
                            const relative = normCurrent.slice(normRoot.length);
                            const parts = relative.split('/').filter(p => p);

                            // Always show Root Folder Name first
                            // Use the actual rootDir string for display name to preserve original casing
                            const rootName = normRoot.split('/').pop() || normRoot;

                            return (
                                <>
                                    <ChevronRightIcon size={12} className="crumb-sep" />
                                    <span
                                        className={`crumb-part ${parts.length > 0 ? 'clickable' : ''}`}
                                        onClick={() => parts.length > 0 && onNavigate(rootDir || normRoot)}
                                        title={rootDir || normRoot}
                                    >
                                        {rootName}
                                    </span>

                                    {parts.map((part, i) => {
                                        const relativePart = parts.slice(0, i + 1).join('/');
                                        // Reconstruct absolute path
                                        // Use normRoot to be safe with separators
                                        const partPath = `${normRoot}/${relativePart}`;
                                        const isLast = i === parts.length - 1;

                                        return (
                                            <React.Fragment key={i}>
                                                <ChevronRightIcon size={12} className="crumb-sep" />
                                                <span
                                                    className={`crumb-part ${!isLast ? 'clickable' : ''}`}
                                                    onClick={() => !isLast && onNavigate(partPath)}
                                                >
                                                    {part}
                                                </span>
                                            </React.Fragment>
                                        );
                                    })}
                                </>
                            );
                        }

                        // Fallback / Absolute Path Mode
                        return currentPath ? currentPath.split(/[/\\]/).map((part, i, arr) => {
                            if (!part && i === 0) return null;
                            const fullPath = getPathAtIndex(arr, i);
                            const isLast = i === arr.length - 1;

                            return (
                                <React.Fragment key={i}>
                                    <ChevronRightIcon size={12} className="crumb-sep" />
                                    <span
                                        className={`crumb-part ${!isLast ? 'clickable' : ''}`}
                                        onClick={() => !isLast && onNavigate(fullPath)}
                                    >
                                        {part || '/'}
                                    </span>
                                </React.Fragment>
                            );
                        }) : <span className="crumb-part ml-2">No Workspace Open</span>;
                    })()}
                </div>
                <style>{`
                    .clickable { cursor: pointer; transition: color 0.2s; }
                    .clickable:hover { color: var(--accent); text-decoration: underline; }
                    .sort-arrow { margin-left: auto; font-size: 10px; opacity: 0.7; }
                    .option-header { font-size: 11px; font-weight: 600; color: var(--text-muted); padding: 8px 8px 4px 8px; text-transform: uppercase; letter-spacing: 0.5px; }
                    .option-divider { height: 1px; background: var(--border); margin: 4px 0; }
                `}</style>
            </div>

            <div className="actions-group">
                {!currentPath ? (
                    <button className="primary-btn" onClick={onOpenWorkspace}>Open Workspace</button>
                ) : (
                    <>
                        <button className="action-btn" onClick={onCreateFolder} title="New Folder">
                            <FolderPlus size={16} /> <span className="btn-text">New Folder</span>
                        </button>
                        <button className="action-btn" onClick={onCreateFile} title="New File">
                            <FilePlus size={16} /> <span className="btn-text">New File</span>
                        </button>

                        <div className="divider-v"></div>

                        <button className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="List View"><List size={18} /></button>
                        <button className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid View"><LayoutGrid size={18} /></button>

                        <div className="options-wrapper" ref={optionsRef}>
                            <button
                                className={`icon-btn ${isOptionsOpen ? 'active' : ''}`}
                                onClick={() => setOptionsOpen(!isOptionsOpen)}
                                title="View Options"
                            >
                                <Settings size={18} />
                            </button>

                            {isOptionsOpen && (
                                <div className="options-popover">
                                    <div className="option-header">Display</div>
                                    <div className="option-item" onClick={() => onToggleHiddenFiles()}>
                                        <span>Show Hidden Files</span>
                                        {showHiddenFiles && <Check size={14} className="check" />}
                                    </div>
                                    <div className="option-item" onClick={() => onToggleExtensions()}>
                                        <span>Show Extensions</span>
                                        {showExtensions && <Check size={14} className="check" />}
                                    </div>

                                    <div className="option-divider"></div>
                                    <div className="option-header">Sort By</div>

                                    <div className="option-item" onClick={() => onSort('name')}>
                                        <span>Name</span>
                                        {getSortIcon('name')}
                                    </div>
                                    <div className="option-item" onClick={() => onSort('mtime')}>
                                        <span>Date Modified</span>
                                        {getSortIcon('mtime')}
                                    </div>
                                    <div className="option-item" onClick={() => onSort('size')}>
                                        <span>Size</span>
                                        {getSortIcon('size')}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Toolbar;
