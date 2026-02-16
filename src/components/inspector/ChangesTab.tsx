import React from 'react';
import { FileText, FilePlus, FileX, RefreshCw } from 'lucide-react';

interface ChangeEntry {
    path: string;
    type: 'add' | 'change' | 'unlink';
    timestamp: number;
}

interface ChangesTabProps {
    changedFiles: ChangeEntry[];
    onRefreshChanges: () => void;
    onCreateVersion: (label: string) => void;
    isCreating: boolean;
}

const TYPE_CONFIG = {
    add: { label: 'Added', color: '#50fa7b', bg: 'rgba(80, 250, 123, 0.12)', icon: FilePlus },
    change: { label: 'Modified', color: '#ffb86c', bg: 'rgba(255, 184, 108, 0.12)', icon: FileText },
    unlink: { label: 'Deleted', color: '#ff5555', bg: 'rgba(255, 85, 85, 0.12)', icon: FileX },
};

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function basename(filePath: string): string {
    const parts = filePath.replaceAll('\\', '/').split('/');
    return parts.at(-1) || filePath;
}

const ChangesTab: React.FC<ChangesTabProps> = ({ changedFiles, onRefreshChanges, onCreateVersion, isCreating }) => {
    const [label, setLabel] = React.useState('');

    const handleCreate = () => {
        if (!label.trim()) return;
        onCreateVersion(label);
        setLabel('');
    };

    const grouped = {
        change: changedFiles.filter(f => f.type === 'change'),
        add: changedFiles.filter(f => f.type === 'add'),
        unlink: changedFiles.filter(f => f.type === 'unlink'),
    };

    const sections = (['change', 'add', 'unlink'] as const).filter(t => grouped[t].length > 0);

    return (
        <div className="changes-container">
            <div className="changes-toolbar">
                <div className="changes-header-row">
                    <span className="changes-total-badge">{changedFiles.length} change{changedFiles.length === 1 ? '' : 's'} detected</span>
                    <button className="refresh-btn" onClick={onRefreshChanges} title="Refresh">
                        <RefreshCw size={13} />
                    </button>
                </div>

                {changedFiles.length > 0 && (
                    <div className="commit-box">
                        <input
                            type="text"
                            placeholder="Version label..."
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            className="commit-input"
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                        <button
                            className="commit-btn"
                            disabled={!label.trim() || isCreating}
                            onClick={handleCreate}
                        >
                            {isCreating ? 'Creating...' : 'Commit'}
                        </button>
                    </div>
                )}
            </div>

            {changedFiles.length === 0 ? (
                <div className="changes-empty-state">
                    <FileText size={36} style={{ opacity: 0.15, marginBottom: 12 }} />
                    <div style={{ color: '#555', fontSize: 13 }}>No unversioned changes</div>
                    <div style={{ color: '#444', fontSize: 11, marginTop: 4 }}>
                        Modified files will appear here
                    </div>
                </div>
            ) : (
                <div className="changes-content-scroll">
                    {sections.map(type => {
                        const config = TYPE_CONFIG[type];
                        const files = grouped[type];

                        return (
                            <div key={type} className="changes-section">
                                <div className="changes-section-header">
                                    <span className="change-type-dot" style={{ backgroundColor: config.color }} />
                                    <span>{config.label}</span>
                                    <span className="changes-section-count">{files.length}</span>
                                </div>
                                <div className="changes-section-list">
                                    {files.map((file, i) => {
                                        const Icon = config.icon;
                                        return (
                                            <div
                                                key={file.path + i}
                                                className="change-item"
                                                style={{ animationDelay: `${i * 30}ms` }}
                                            >
                                                <Icon size={14} style={{ color: config.color, flexShrink: 0 }} />
                                                <div className="change-item-info">
                                                    <span className="change-file-name" title={file.path}>
                                                        {basename(file.path)}
                                                    </span>
                                                    <span className="change-file-path" title={file.path}>
                                                        {file.path}
                                                    </span>
                                                </div>
                                                <span className="change-timestamp">{timeAgo(file.timestamp)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ChangesTab;
