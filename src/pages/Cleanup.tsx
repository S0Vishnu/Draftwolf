import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { HardDrive, Trash2, Archive, Search, ArrowLeft, Check, AlertCircle } from 'lucide-react';
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

const Cleanup = () => {
    const navigate = useNavigate();
    const [user] = useAuthState(auth);
    const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [storageReport, setStorageReport] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Detail View State
    const [inspectingFile, setInspectingFile] = useState<FileReport | null>(null);
    const [fileVersions, setFileVersions] = useState<VersionDetail[]>([]);
    const [versionsToDelete, setVersionsToDelete] = useState<Set<string>>(new Set());

    const rootDir = localStorage.getItem('rootDir');

    const modules = [
        {
            id: 'storage',
            title: 'Storage Optimization',
            description: 'Analyze and clean up old versions, unused assets, and temporary files to free up space.',
            icon: <HardDrive size={24} />,
            colorClass: 'card-storage',
            stats: {
                label: 'Total Used',
                value: storageReport ? formatBytes(storageReport.totalSize) : 'Calculating...'
            }
        },
        {
            id: 'backups',
            title: 'Manage Backups',
            description: 'Configure automated backups, view backup history, and restore from external archives.',
            icon: <Archive size={24} />,
            colorClass: 'card-backups',
            stats: { label: 'Last Backup', value: '2 days ago' }
        },
        {
            id: 'trash',
            title: 'Trash Bin',
            description: 'Review deleted items, restore accidentally removed files, or permanently empty the trash.',
            icon: <Trash2 size={24} />,
            colorClass: 'card-trash',
            stats: { label: 'Items', value: '14' }
        }
    ];

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
        } else if (selectedModule) {
            setSelectedModule(null);
        } else {
            navigate('/home');
        }
    };

    const handleModuleClick = (id: string) => {
        if (id === 'storage') {
            setSelectedModule('storage');
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

    const filteredFiles = storageReport?.files.filter((f: FileReport) =>
        f.path.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

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

                <div className="file-list-header">
                    <span>File Path</span>
                    <span>Versions</span>
                    <span>Last Modified</span>
                    <span>History Size</span>
                </div>
                <div className="file-list">
                    {filteredFiles.map((file: FileReport, index: number) => (
                        <div key={index} className="file-row clickable" onClick={() => handleFileClick(file)}>
                            <span className="file-path" title={file.path}>{file.path}</span>
                            <span className="file-versions badge">{file.versionCount}</span>
                            <span className="file-date">{new Date(file.latestDate).toLocaleDateString()}</span>
                            <span className="file-size">{formatBytes(file.totalHistorySize)}</span>
                        </div>
                    ))}
                    {filteredFiles.length === 0 && (
                        <div className="empty-state">No files found matching "{searchTerm}"</div>
                    )}
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
                                <th style={{ width: '50px' }}>Select</th>
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
                            {(selectedModule || inspectingFile) && (
                                <button className="back-link" onClick={handleBack} style={{ marginBottom: '10px', background: 'transparent', border: 'none', color: 'var(--ev-c-text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <ArrowLeft size={16} /> {inspectingFile ? 'Back to File List' : 'Back to Overview'}
                                </button>
                            )}
                            <h1 className="cleanup-title">
                                {inspectingFile ? 'File History' : (selectedModule === 'storage' ? 'Storage Analysis' : 'System Cleanup')}
                            </h1>
                            {!inspectingFile && (
                                <p className="cleanup-subtitle">
                                    {selectedModule === 'storage'
                                        ? 'Detailed breakdown of space usage by file versions.'
                                        : 'Manage storage, backups, and deleted items to keep your workspace optimized.'}
                                </p>
                            )}
                        </div>

                        {selectedModule === 'storage' && !inspectingFile && (
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

                {!selectedModule ? (
                    <div className="cleanup-grid">
                        {modules.map((module) => (
                            <div
                                key={module.id}
                                className={`cleanup-card ${module.colorClass}`}
                                onClick={() => handleModuleClick(module.id)}
                            >
                                <div className="card-icon">
                                    {module.icon}
                                </div>
                                <h3 className="card-title">{module.title}</h3>
                                <p className="card-description">{module.description}</p>
                                <div className="card-stats">
                                    <span>{module.stats.label}</span>
                                    <span className="stat-value">{module.stats.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="module-content">
                        {selectedModule === 'storage' && renderStorageDetail()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Cleanup;
