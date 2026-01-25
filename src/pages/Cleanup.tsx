import { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { Trash2, Search, ArrowLeft, ArrowUp, ArrowDown, Filter, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/Cleanup.css';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { toast } from 'react-toastify';

interface FileReport {
    path: string;
    versionCount: number;
    latestDate: string;
    totalHistorySize: number;
}

interface VersionDetail {
    id: string;
    versionNumber: string;
    label: string;
    timestamp: string;
    totalSize: number;
}

type SortKey = 'path' | 'versionCount' | 'latestDate' | 'totalHistorySize';
type SortDirection = 'asc' | 'desc';

const Cleanup = () => {
    const navigate = useNavigate();
    const [user] = useAuthState(auth);
    const [selectedModule, setSelectedModule] = useState<string | null>('storage');
    const [storageReport, setStorageReport] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

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
    const [versionsToDelete, setVersionsToDelete] = useState<Set<string>>(new Set());

    const rootDir = localStorage.getItem('rootDir');

    const fetchReport = () => {
        if (rootDir) {
            setIsLoading(true);
            (window as any).api.draft.getStorageReport(rootDir).then((data: any) => {
                if (data) setStorageReport(data);
                setIsLoading(false);
            });
        }
    };

    useEffect(() => {
        fetchReport();
    }, [rootDir]);

    // Click outside dropdown handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Handle File Click -> Inspect Versions
    const handleFileClick = async (file: FileReport) => {
        setInspectingFile(file);
        setVersionsToDelete(new Set());
        if (rootDir) {
            const history = await (window as any).api.draft.getHistory(rootDir, file.path);
            setFileVersions(history);
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

    const confirmDeletion = async () => {
        if (versionsToDelete.size === 0 || !rootDir) return;

        const confirmed = await (window as any).api.confirm({
            message: `Are you sure you want to delete ${versionsToDelete.size} version(s)? This action cannot be undone.`,
            title: 'Confirm Deletion',
            type: 'warning'
        });

        if (confirmed) {
            let successCount = 0;
            for (const vid of versionsToDelete) {
                const success = await (window as any).api.draft.delete(rootDir, vid);
                if (success) successCount++;
            }

            if (successCount > 0) {
                toast.success(`Deleted ${successCount} version(s)`);
                // Refresh
                if (inspectingFile) {
                    const history = await (window as any).api.draft.getHistory(rootDir, inspectingFile.path);
                    setFileVersions(history);
                    setVersionsToDelete(new Set());
                    // Update global report background
                    fetchReport();
                }
            } else {
                toast.error("Failed to delete versions.");
            }
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

    function formatBytes(bytes: number, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

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

    const filteredAndSortedFiles = useMemo(() => {
        if (!storageReport?.files) return [];

        let result = storageReport.files;

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
        return [...result].sort((a: any, b: any) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            if (sortConfig.key === 'totalHistorySize' || sortConfig.key === 'versionCount') {
                return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }
            return sortConfig.direction === 'asc' ?
                String(aValue).localeCompare(String(bValue)) :
                String(bValue).localeCompare(String(aValue));
        });

    }, [storageReport, searchTerm, extensionFilter, extensionMode, sortConfig]);

    const renderStorageDetail = () => {
        if (!storageReport) return <div className="loading-spinner">Loading analysis...</div>;

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
                        <div className="big-value">{storageReport.fileCount}</div>
                    </div>
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
                    </div>
                    <div className="file-list">
                        {filteredAndSortedFiles.map((file: FileReport, index: number) => (
                            <div key={index} className="file-row clickable" onClick={() => handleFileClick(file)}>
                                <span className="file-path" title={file.path}>{file.path}</span>
                                <span className="file-versions">
                                    <span className="badge">{file.versionCount}</span>
                                </span>
                                <span className="file-date">{new Date(file.latestDate).toLocaleDateString()}</span>
                                <span className="file-size">{formatBytes(file.totalHistorySize)}</span>
                            </div>
                        ))}
                        {filteredAndSortedFiles.length === 0 && (
                            <div className="empty-state">
                                <Search size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                <p>No files found matching "{searchTerm}"</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderFileInspection = () => {
        if (!inspectingFile) return null;

        return (
            <div className="inspection-view fade-in">
                <div className="inspection-header">
                    <h2>{inspectingFile.path}</h2>
                    <div className="inspection-actions">
                        {versionsToDelete.size > 0 && (
                            <button className="btn-confirm-delete" onClick={confirmDeletion}>
                                <Trash2 size={16} /> Delete {versionsToDelete.size} Selected
                            </button>
                        )}
                    </div>
                </div>

                <div className="version-list-wrapper">
                    <table className="version-table">
                        <thead>
                            <tr>
                                <th style={{ width: '50px' }}>
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
                                <tr key={v.id} className={versionsToDelete.has(v.id) ? 'selected-row' : ''}>
                                    <td>
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
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--ev-c-black)' }}>
            <Sidebar
                isOpen={true}
                user={user}
                onGoHome={() => navigate('/home')}
            />
            <div className="cleanup-container">
                <div className="cleanup-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                        <div>
                            {(inspectingFile) && (
                                <button className="back-link" onClick={handleBack}>
                                    <ArrowLeft size={18} /> Back to File List
                                </button>
                            )}
                            <h1 className="cleanup-title">
                                {inspectingFile ? 'File History' : 'Storage Optimization'}
                            </h1>
                            {!inspectingFile && (
                                <p className="cleanup-subtitle">
                                    Analyze and clean up old versions, unused assets, and temporary files to free up space.
                                </p>
                            )}
                        </div>

                        {!inspectingFile && (
                            <div className="search-bar-wrapper" style={{ marginBottom: 0, width: '300px' }}>
                                <Search size={18} className="search-icon" />
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
                </div>

                <div className="module-content">
                    {renderStorageDetail()}
                </div>
            </div>
        </div>
    );
};

export default Cleanup;
