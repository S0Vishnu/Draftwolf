import { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { Trash2, Search, ArrowLeft, ArrowUp, ArrowDown, Filter, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/Cleanup.css';
import { supabase } from '../supabase';
import { Session } from '@supabase/supabase-js';
import { toast } from 'react-toastify';
import ConfirmDialog from '../components/ConfirmDialog';

interface FileReport {
    path: string;
    versionCount: number;
    explicitCount?: number;
    snapshotCount?: number;
    latestDate: string;
    totalHistorySize: number;
}

interface SnapshotReport {
    scope: string;
    versionCount: number;
    latestDate: string;
    fileCount: number;
    totalSize: number;
    totalCompressedSize: number;
}

interface VersionDetail {
    id: string;
    versionNumber: string;
    label: string;
    timestamp: string;
    totalSize: number;
    files?: Record<string, string>;
}

type SortKey = 'path' | 'versionCount' | 'latestDate' | 'totalHistorySize' | 'label' | 'scope' | 'fileCount' | 'totalSize';
type SortDirection = 'asc' | 'desc';

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const Cleanup = () => {
    const navigate = useNavigate();
    const [session, setSession] = useState<Session | null>(null);
    const user = session?.user;

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);
    const [storageReport, setStorageReport] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('isSidebarOpen') !== 'false');

    const [activeTab, setActiveTab] = useState<'versioned' | 'snapshots'>('versioned');

    // Project Selection State
    const [rootDir, setRootDir] = useState<string | null>(localStorage.getItem('rootDir'));
    const [pinnedFolders, setPinnedFolders] = useState<any[]>([]);
    const [recentWorkspaces, setRecentWorkspaces] = useState<any[]>([]);
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    const [projectSearchTerm, setProjectSearchTerm] = useState('');
    const projectDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const pinned = JSON.parse(localStorage.getItem('pinnedFolders') || '[]');
            const recent = JSON.parse(localStorage.getItem('recentWorkspaces') || '[]');
            setPinnedFolders(pinned);
            setRecentWorkspaces(recent);
        } catch (e) {
            console.error('Error loading projects:', e);
        }
    }, []);

    // Filter & Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [extensionFilter, setExtensionFilter] = useState('');
    const [extensionMode, setExtensionMode] = useState<'include' | 'exclude'>('include');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
        key: 'totalHistorySize',
        direction: 'desc'
    });

    // Detail View State
    const [inspectingFile, setInspectingFile] = useState<FileReport | null>(null);
    const [fileVersions, setFileVersions] = useState<VersionDetail[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<VersionDetail | null>(null);
    const [versionsToDelete, setVersionsToDelete] = useState<Set<string>>(new Set());

    const [backupPath, setBackupPath] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!rootDir) {
            setStorageReport(null);
            return;
        }
        try {
            const normRoot = rootDir.toLowerCase().replaceAll('\\', '/');
            const p = pinnedFolders.find((f: any) => f.path?.toLowerCase().replaceAll('\\', '/') === normRoot);
            const r = recentWorkspaces.find((w: any) => w.path?.toLowerCase().replaceAll('\\', '/') === normRoot);
            const bp = p?.backupPath || r?.backupPath;
            setBackupPath(bp);
        } catch (e) {
            console.error(e);
        }
    }, [rootDir, pinnedFolders, recentWorkspaces]);

    const fetchReport = () => {
        if (rootDir) {
            setIsLoading(true);
            (window as any).api.draft.getStorageReport(rootDir, backupPath).then((data: any) => {
                if (data) setStorageReport(data);
                setIsLoading(false);
            });
        }
    };

    useEffect(() => {
        fetchReport();
    }, [rootDir, backupPath]);

    // Click outside dropdown handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
                setIsProjectDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleProjectChange = (path: string) => {
        setRootDir(path);
        localStorage.setItem('rootDir', path);
        setInspectingFile(null);
        setIsProjectDropdownOpen(false);
    };

    // Handle File Click -> Inspect Versions
    const handleFileClick = async (file: FileReport) => {
        setInspectingFile(file);
        setVersionsToDelete(new Set());
        setSelectedVersion(null);
        if (rootDir) {
            const history = await (window as any).api.draft.getHistory(rootDir, file.path, backupPath);
            setFileVersions(history);
            if (history.length > 0) {
                setSelectedVersion(history[0]);
            }
        }
    };

    const toggleVersionDeletion = (versionId: string) => {
        setVersionsToDelete(prev => {
            const next = new Set(prev);
            if (next.has(versionId)) next.delete(versionId);
            else next.add(versionId);
            return next;
        });
    };

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const onDeleteClick = () => {
        if (versionsToDelete.size === 0 || !rootDir) return;
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        setIsConfirmOpen(false);
        if (versionsToDelete.size === 0 || !rootDir) return;

        let successCount = 0;
        for (const vid of versionsToDelete) {
            const success = await (window as any).api.draft.delete(rootDir, vid, backupPath);
            if (success) successCount++;
        }

        if (successCount > 0) {
            toast.success(`Deleted ${successCount} version(s)`);
            // Refresh
            if (inspectingFile) {
                const history = await (window as any).api.draft.getHistory(rootDir, inspectingFile.path, backupPath);
                setFileVersions(history);
                setVersionsToDelete(new Set());
                // Update global report background
                fetchReport();
            }
        } else {
            toast.error("Failed to delete versions.");
        }
    };

    const handleBack = () => {
        if (inspectingFile) {
            setInspectingFile(null);
            setFileVersions([]);
        } else {
            navigate('/home');
        }
    };




    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const toggleSelectAllVersions = () => {
        if (versionsToDelete.size === fileVersions.length) {
            setVersionsToDelete(new Set());
        } else {
            setVersionsToDelete(new Set(fileVersions.map(v => v.id)));
        }
    };



    const filteredReport = useMemo(() => {
        if (!storageReport) return { versioned: [], snapshots: [] };

        // Versioned Files: Files with explicit versions
        const versioned = storageReport.files ? storageReport.files.filter((f: FileReport) => (f.explicitCount !== undefined ? f.explicitCount > 0 : true)) : [];

        // Snapshots: Folder Snapshots from backend
        const snapshots = storageReport.snapshots || [];

        return { versioned, snapshots };
    }, [storageReport]);

    const activeList = activeTab === 'versioned' ? filteredReport.versioned : filteredReport.snapshots;

    const filteredAndSortedFiles = useMemo(() => {
        let result = activeList;

        // 1. Search
        if (searchTerm) {
            result = result.filter((f: FileReport) =>
                f.path.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // 2. Extension Filter
        if (extensionFilter) {
            const exts = extensionFilter.split(',').map(e => e.trim().toLowerCase().replace(/^\./, ''));
            if (exts.length > 0 && exts[0] !== '') {
                result = result.filter((f: FileReport) => {
                    const ext = f.path.split('.').pop()?.toLowerCase() || '';
                    const match = exts.includes(ext);
                    return extensionMode === 'include' ? match : !match;
                });
            }
        }

        // 3. Sort
        // 3. Sort
        return [...result].sort((a: any, b: any) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Map inconsistent keys if needed or ensure data structure matches
            // For snapshots, we use 'label', 'scope', 'fileCount', 'totalSize', 'timestamp'

            if (activeTab === 'snapshots') {
                if (sortConfig.key === 'path') aValue = a.scope;
                if (sortConfig.key === 'path') bValue = b.scope;

                if (sortConfig.key === 'latestDate') aValue = a.latestDate;
                if (sortConfig.key === 'latestDate') bValue = b.latestDate;

                if (sortConfig.key === 'totalHistorySize') aValue = a.totalSize;
                if (sortConfig.key === 'totalHistorySize') bValue = b.totalSize;

                if (sortConfig.key === 'versionCount') aValue = a.versionCount;
                if (sortConfig.key === 'versionCount') bValue = b.versionCount;
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }
            return sortConfig.direction === 'asc' ?
                String(aValue || '').localeCompare(String(bValue || '')) :
                String(bValue || '').localeCompare(String(aValue || ''));
        });

    }, [activeList, searchTerm, extensionFilter, extensionMode, sortConfig]);

    const renderStorageDetail = () => {
        if (!rootDir) {
            const allProjects = [
                ...pinnedFolders.map(p => ({ ...p, type: 'Pinned' })),
                ...recentWorkspaces.filter(r => !pinnedFolders.some(p => p.path === r.path)).map(r => ({ ...r, type: 'Recent' }))
            ];

            const filteredProjects = allProjects.filter(p => 
                p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) || 
                p.path.toLowerCase().includes(projectSearchTerm.toLowerCase())
            );

            return (
                <div className="empty-state">
                    <div className="empty-state-icon" style={{ marginBottom: '1.5rem', opacity: 0.1 }}>
                        <Search size={80} />
                    </div>
                    <h2 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>No Project Selected</h2>
                    <p style={{ color: '#a1a1aa' }}>Select a project to analyze storage and clean up old versions.</p>

                    <div className="project-selector-wrapper" style={{ marginTop: '2rem', width: '100%', maxWidth: '400px', position: 'relative' }}>
                        <div ref={projectDropdownRef} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div
                                onClick={() => { setIsProjectDropdownOpen(!isProjectDropdownOpen); setProjectSearchTerm(''); }}
                                style={{ 
                                    padding: '12px 16px', 
                                    borderRadius: '12px', 
                                    background: 'rgba(255,255,255,0.05)', 
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    color: '#ffffff'
                                }}
                            >
                                <span>{isProjectDropdownOpen ? 'Select or Search...' : 'Click to select project...'}</span>
                                <ChevronDown size={18} style={{ transform: isProjectDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </div>

                            {isProjectDropdownOpen && (
                                <div style={{ 
                                    background: '#18181b', 
                                    border: '1px solid #3f3f46', 
                                    borderRadius: '12px', 
                                    padding: '8px', 
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                    maxHeight: '400px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    zIndex: 1000
                                }}>
                                    <input 
                                        type="text"
                                        placeholder="Search projects..."
                                        autoFocus
                                        value={projectSearchTerm}
                                        onChange={(e) => setProjectSearchTerm(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            backgroundColor: '#27272a',
                                            border: '1px solid #3f3f46',
                                            borderRadius: '6px',
                                            color: '#ffffff',
                                            fontSize: '13px',
                                            outline: 'none'
                                        }}
                                    />
                                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {filteredProjects.length > 0 ? (
                                            filteredProjects.map((proj, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => handleProjectChange(proj.path)}
                                                    style={{ 
                                                        display: 'flex', 
                                                        flexDirection: 'column', 
                                                        gap: '4px', 
                                                        padding: '12px 16px',
                                                        cursor: 'pointer',
                                                        borderRadius: '8px',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>{proj.name}</span>
                                                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>{proj.type}</span>
                                                    </div>
                                                    <span style={{ fontSize: '12px', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.path}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#71717a' }}>No projects found</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
        if (isLoading || !storageReport) {
            return <div className="loading-spinner">Loading analysis...</div>;
        }

        if (inspectingFile) {
            return renderFileInspection();
        }

        return (
            <div className="cleanup-detail-view fade-in">
                <div className="detail-header">
                    <div className="stat-card">
                        <h3>Total Version History</h3>
                        <div className="big-value">{formatBytes(storageReport.totalSize)}</div>
                    </div>
                    <div className="stat-card">
                        <h3>Versioned Files</h3>
                        <div className="big-value">{filteredReport.versioned.length}</div>
                    </div>
                </div>

                <div className="cleanup-tabs">
                    <button
                        className={`cleanup-tab ${activeTab === 'versioned' ? 'active' : ''}`}
                        onClick={() => setActiveTab('versioned')}
                    >
                        Versioned Files ({filteredReport.versioned.length})
                    </button>
                    <button
                        className={`cleanup-tab ${activeTab === 'snapshots' ? 'active' : ''}`}
                        onClick={() => setActiveTab('snapshots')}
                        title="Folder Snapshots"
                    >
                        Folder Snapshots ({filteredReport.snapshots.length})
                    </button>
                </div>


                <div className="filter-toolbar">
                    <div className="filter-group">
                        <Filter size={16} />
                        <div className="dropdown-container" ref={dropdownRef}>
                            <div
                                className={`custom-dropdown ${isDropdownOpen ? 'open' : ''}`}
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <span>{extensionMode === 'include' ? 'Include Extensions' : 'Exclude Extensions'}</span>
                                <ChevronDown size={14} className={`dropdown-arrow ${isDropdownOpen ? 'rotate' : ''}`} />
                            </div>
                            {isDropdownOpen && (
                                <div className="dropdown-menu">
                                    <div
                                        className={`dropdown-item ${extensionMode === 'include' ? 'active' : ''}`}
                                        onClick={() => { setExtensionMode('include'); setIsDropdownOpen(false); }}
                                    >
                                        Include Extensions
                                    </div>
                                    <div
                                        className={`dropdown-item ${extensionMode === 'exclude' ? 'active' : ''}`}
                                        onClick={() => { setExtensionMode('exclude'); setIsDropdownOpen(false); }}
                                    >
                                        Exclude Extensions
                                    </div>
                                </div>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="e.g. psd, png (comma separated)"
                            className="filter-input"
                            value={extensionFilter}
                            onChange={e => setExtensionFilter(e.target.value)}
                        />
                    </div>
                </div>

                <div className="file-list-container">
                    <div className="file-list-header">
                        {activeTab === 'versioned' ? (
                            <>
                                <div className="header-cell sortable" onClick={() => handleSort('path')}>
                                    File Path {sortConfig.key === 'path' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                                <div className="header-cell sortable" onClick={() => handleSort('versionCount')}>
                                    Versions {sortConfig.key === 'versionCount' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                                <div className="header-cell sortable" onClick={() => handleSort('latestDate')}>
                                    Last Modified {sortConfig.key === 'latestDate' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                                <div className="header-cell sortable" onClick={() => handleSort('totalHistorySize')}>
                                    History Size {sortConfig.key === 'totalHistorySize' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="header-cell sortable" onClick={() => handleSort('path')} style={{ flex: 3 }}>
                                    Folder Name {sortConfig.key === 'path' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                                <div className="header-cell sortable" onClick={() => handleSort('versionCount')}>
                                    Versions {sortConfig.key === 'versionCount' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                                <div className="header-cell sortable" onClick={() => handleSort('latestDate')}>
                                    Date {sortConfig.key === 'latestDate' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                                <div className="header-cell sortable" onClick={() => handleSort('totalHistorySize')}>
                                    Size {sortConfig.key === 'totalHistorySize' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="file-list">
                        {activeTab === 'versioned' ? (
                            filteredAndSortedFiles.map((file: FileReport, index: number) => (
                                <div key={index} className="file-row clickable" onClick={() => handleFileClick(file)}>
                                    <span className="file-path" title={file.path}>{file.path}</span>
                                    <span className="file-versions">
                                        <span className="badge">{file.versionCount}</span>
                                    </span>
                                    <span className="file-date">{new Date(file.latestDate).toLocaleDateString()}</span>
                                    <span className="file-size">{formatBytes(file.totalHistorySize)}</span>
                                </div>
                            ))
                        ) : (
                            filteredAndSortedFiles.map((snap: any, index: number) => (
                                <div key={snap.scope} className="file-row clickable" onClick={() => handleFileClick({ ...snap, path: snap.scope, totalHistorySize: snap.totalSize })} style={{ gridTemplateColumns: '3fr 1fr 1.5fr 1fr' }}>
                                    <span className="file-path" title={snap.scope} style={{ fontWeight: 700 }}>{snap.scope}</span>
                                    <span className="file-versions">
                                        <span className="badge">{snap.versionCount}</span>
                                    </span>
                                    <span className="file-date">{new Date(snap.latestDate).toLocaleDateString()}</span>
                                    <span className="file-size">{formatBytes(snap.totalSize)}</span>
                                </div>
                            ))
                        )}
                        {filteredAndSortedFiles.length === 0 && (
                            <div className="empty-state">
                                <Search size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                <p>No files found matching "{searchTerm}"</p>
                            </div>
                        )}
                    </div>
                </div>
            </div >
        );
    };

    const renderFileInspection = () => {
        if (!inspectingFile) return null;

        const isSnapshot = activeTab === 'snapshots';

        return (
            <div className="inspection-view fade-in">
                <div className="inspection-header">
                    <h2>{inspectingFile.path}</h2>
                    <div className="inspection-actions">
                        {versionsToDelete.size > 0 && (
                            <button className="btn-confirm-delete" onClick={onDeleteClick}>
                                <Trash2 size={16} /> Delete {versionsToDelete.size} Selected
                            </button>
                        )}
                    </div>
                </div>

                <div className="inspection-content" style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 200px)' }}>
                    <div className="version-list-wrapper" style={{ flex: isSnapshot ? 1 : 'unset', width: isSnapshot ? 'auto' : '100%', overflowY: 'auto' }}>
                        <h3>{isSnapshot ? 'Snapshot History' : 'Version History'}</h3>
                        <table className="version-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            checked={fileVersions.length > 0 && versionsToDelete.size === fileVersions.length}
                                            onChange={toggleSelectAllVersions}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </th>
                                    <th>Version</th>
                                    <th>Label</th>
                                    <th>Date</th>
                                    <th>Size</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fileVersions.map(v => (
                                    <tr
                                        key={v.id}
                                        className={`${versionsToDelete.has(v.id) ? 'selected-row' : ''} ${selectedVersion?.id === v.id ? 'active-version-row' : ''}`}
                                        onClick={() => setSelectedVersion(v)}
                                        style={{ cursor: 'pointer', background: selectedVersion?.id === v.id ? 'var(--ev-c-bg-soft)' : undefined }}
                                    >
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={versionsToDelete.has(v.id)}
                                                onChange={() => toggleVersionDeletion(v.id)}
                                            />
                                        </td>
                                        <td>
                                            <span className="version-tag">{v.versionNumber}</span>
                                        </td>
                                        <td>{v.label || '-'}</td>
                                        <td>{new Date(v.timestamp).toLocaleString()}</td>
                                        <td>{formatBytes(v.totalSize || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {isSnapshot && (
                        <div className="snapshot-contents-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--ev-c-bg-soft)', padding: '1rem', borderRadius: '8px' }}>
                            <h3>Snapshot Contents {selectedVersion && <span style={{ fontSize: '0.8em', opacity: 0.7 }}>({selectedVersion.versionNumber})</span>}</h3>
                            {!selectedVersion ? (
                                <div className="empty-state" style={{ height: '200px' }}>
                                    <p>Select a version to view files</p>
                                </div>
                            ) : (
                                <div className="snapshot-file-list">
                                    {selectedVersion.files && Object.keys(selectedVersion.files).length > 0 ? (
                                        Object.keys(selectedVersion.files).sort().map((filePath, i) => (
                                            <div key={i} className="snapshot-file-item" style={{ padding: '0.5rem', borderBottom: '1px solid var(--ev-c-border)', display: 'flex', alignItems: 'center' }}>
                                                <span style={{ marginRight: '0.5rem', opacity: 0.7 }}>📄</span>
                                                <span style={{ wordBreak: 'break-all' }}>{filePath}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="empty-state">
                                            <p>No files in this version.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="cleanup-page" style={{ height: '100vh', width: '100vw', background: 'var(--ev-c-black)' }}>
            <div className="app-inner" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%', height: '100%' }}>
                <Sidebar
                    isOpen={isSidebarOpen}
                    toggleSidebar={() => {
                        const newState = !isSidebarOpen;
                        setIsSidebarOpen(newState);
                        localStorage.setItem('isSidebarOpen', String(newState));
                    }}
                    user={user}
                    onGoHome={() => navigate('/home')}
                />
                <main className="cleanup-container" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                    <header className="cleanup-header">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                            <div className="cleanup-header-text">
                                {(inspectingFile) && (
                                    <button className="back-link" onClick={handleBack}>
                                        <ArrowLeft size={18} /> Back to File List
                                    </button>
                                )}
                                <h1 className="cleanup-title">
                                    {inspectingFile ? 'File History' : 'Storage Optimization'}
                                    {!inspectingFile && rootDir && (
                                        <div className="header-project-selector" ref={projectDropdownRef} style={{ marginLeft: '1rem', position: 'relative' }}>
                                            <div
                                                onClick={() => { setIsProjectDropdownOpen(!isProjectDropdownOpen); setProjectSearchTerm(''); }}
                                                style={{
                                                    fontSize: '0.85rem',
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    background: 'rgba(99, 102, 241, 0.15)',
                                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                                    color: '#a5b4fc',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <span style={{ fontWeight: 600 }}>{pinnedFolders.find(p => p.path === rootDir)?.name || recentWorkspaces.find(r => r.path === rootDir)?.name || rootDir.split(/[/\\]/).pop()}</span>
                                                <ChevronDown size={14} style={{ transform: isProjectDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                            </div>
                                            {isProjectDropdownOpen && (
                                                <div style={{ 
                                                    position: 'absolute',
                                                    top: 'calc(100% + 8px)',
                                                    right: 0,
                                                    width: '320px',
                                                    background: '#18181b',
                                                    border: '1px solid #3f3f46',
                                                    borderRadius: '12px',
                                                    padding: '8px',
                                                    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px',
                                                    zIndex: 10000
                                                }}>
                                                    <input 
                                                        type="text"
                                                        placeholder="Search projects..."
                                                        autoFocus
                                                        value={projectSearchTerm}
                                                        onChange={(e) => setProjectSearchTerm(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            backgroundColor: '#27272a',
                                                            border: '1px solid #3f3f46',
                                                            borderRadius: '6px',
                                                            color: '#ffffff',
                                                            fontSize: '13px',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                    <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        {(() => {
                                                            const allProjects = [
                                                                ...pinnedFolders.map(p => ({ ...p, type: 'Pinned' })),
                                                                ...recentWorkspaces.filter(r => !pinnedFolders.some(p => p.path === r.path)).map(r => ({ ...r, type: 'Recent' }))
                                                            ];

                                                            const filtered = allProjects.filter(p => 
                                                                p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) || 
                                                                p.path.toLowerCase().includes(projectSearchTerm.toLowerCase())
                                                            );

                                                            if (filtered.length === 0) {
                                                                return <div style={{ padding: '20px', textAlign: 'center', color: '#71717a' }}>No projects found</div>;
                                                            }

                                                            return filtered.map((proj, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => handleProjectChange(proj.path)}
                                                                    style={{ 
                                                                        display: 'flex', 
                                                                        flexDirection: 'column', 
                                                                        gap: '4px', 
                                                                        padding: '10px 14px',
                                                                        cursor: 'pointer',
                                                                        borderRadius: '8px',
                                                                        background: proj.path === rootDir ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                                                        borderLeft: proj.path === rootDir ? '3px solid #818cf8' : 'none'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = proj.path === rootDir ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = proj.path === rootDir ? 'rgba(99, 102, 241, 0.15)' : 'transparent'}
                                                                >
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '13px' }}>{proj.name}</span>
                                                                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.2)', padding: '1px 5px', borderRadius: '3px' }}>{proj.type}</span>
                                                                    </div>
                                                                    <span style={{ fontSize: '11px', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.path}</span>
                                                                </div>
                                                            ));
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </h1>
                                {!inspectingFile && (
                                    <p className="cleanup-subtitle">
                                        Analyze and clean up old versions, unused assets, and temporary files to free up space.
                                    </p>
                                )}
                            </div>

                            {!inspectingFile && (
                                <div className="search-bar-wrapper" style={{ marginBottom: 0, width: '300px' }}>
                                    <Search size={18} className="search-icon" aria-hidden="true" />
                                    <input
                                        type="text"
                                        placeholder="Filter files..."
                                        className="cleanup-search"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </header>

                    <div className="module-content">
                        {renderStorageDetail()}
                        <ConfirmDialog
                            isOpen={isConfirmOpen}
                            title="Confirm Deletion"
                            message={`Are you sure you want to delete ${versionsToDelete.size} version(s)? This action cannot be undone.`}
                            onConfirm={handleConfirmDelete}
                            onCancel={() => setIsConfirmOpen(false)}
                            isDangerous={true}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Cleanup;
