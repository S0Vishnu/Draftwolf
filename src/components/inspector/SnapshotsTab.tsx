import React, { useMemo, useState, useEffect } from 'react';
import { Trash2, RotateCcw, Edit2, Archive, HardDrive } from 'lucide-react';
import { FileEntry } from '../FileItem';
import { Version } from './types';

interface SnapshotsTabProps {
    history: Version[];
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
    onRename: (id: string, newLabel: string) => void;
    projectRoot: string;
}

const LANE_COLORS = [
    '#6e7bf2', '#ff7eb6', '#50fa7b', '#f1fa8c',
    '#bd93f9', '#ff5555', '#8be9fd', '#ffb86c',
];

const ROW_HEIGHT = 44;
const LANE_WIDTH = 14;
const LEFT_PADDING = 8;
const DOT_SIZE = 7;

const formatSize = (bytes?: number) => {
    if (bytes === undefined) return '--';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const SnapshotsTab: React.FC<SnapshotsTabProps> = ({
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
    onRestore,
    onRename,
    projectRoot
}) => {
    const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState<string>('');
    const [stats, setStats] = useState<{ totalSize: number, totalCompressedSize: number, compressionRatio: string } | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // @ts-ignore
                const s = await globalThis.api.draft.getStorageReport(projectRoot);
                setStats(s);
            } catch (e) {
                console.error("Failed to fetch storage stats", e);
            }
        };
        fetchStats();
    }, [projectRoot, history]); // Refresh when history changes

    // Calculate Graph Layout (Reused from VersionsTab)
    const graphData = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];
        const lanes: (string | null)[] = [];
        const idToIndex = new Map<string, number>();
        history.forEach((v, i) => idToIndex.set(v.id, i));

        history.forEach((ver, index) => {
            let parentId = ver.parentId || ver.parent;
            const parentExists = parentId && idToIndex.has(parentId);
            if (!parentExists && index < history.length - 1) {
                parentId = history[index + 1].id;
            }

            let laneIndex = lanes.indexOf(ver.id);
            if (laneIndex === -1) {
                if (index === history.length - 1) {
                    laneIndex = 0;
                } else {
                    laneIndex = lanes.indexOf(null);
                    if (laneIndex === -1) {
                        laneIndex = lanes.length;
                        lanes.push(null);
                    }
                }
            }

            if (lanes.length === 0 && laneIndex === 0) lanes.push(null);
            lanes[laneIndex] = parentId || null;
            const color = LANE_COLORS[laneIndex % LANE_COLORS.length];

            nodes.push({
                ...ver,
                parentId,
                index,
                laneIndex,
                color,
                x: LEFT_PADDING + laneIndex * LANE_WIDTH,
                y: index * ROW_HEIGHT + (ROW_HEIGHT / 2)
            });


        });

        // Second pass for links
        nodes.forEach(node => {
            const parentId = node.parentId || node.parent;
            if (parentId) {
                const parentNode = nodes.find((n: any) => n.id === parentId);
                if (parentNode) {
                    links.push({
                        source: { x: node.x, y: node.y },
                        target: { x: parentNode.x, y: parentNode.y },
                        color: node.color
                    });
                }
            }
        });

        return { nodes, links, maxLane: lanes.length };
    }, [history]);

    const { nodes, links, maxLane } = graphData;
    const contentLeftMargin = LEFT_PADDING + (maxLane * LANE_WIDTH) + 12;

    return (
        <div className="versions-list">
            {/* Stats Header */}
            {stats && (
                <div className="snapshot-stats-container">
                    <div className="stats-info-group">
                        <HardDrive size={16} className="text-muted" />
                        <div>
                            <div className="stats-label">Storage Used</div>
                            <div className="stats-value">
                                {formatSize(stats.totalCompressedSize)}
                                <span className="stats-sub-text"> / {formatSize(stats.totalSize)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="stats-efficiency-group">
                        <div className="stats-label">Efficiency</div>
                        <div className="stats-efficiency-value">
                            {stats.totalSize > 0
                                ? Math.round((1 - (stats.totalCompressedSize / stats.totalSize)) * 100)
                                : 0}% Saved
                        </div>
                    </div>
                </div>
            )}

            {isCreating && (
                <div className="creation-form">
                    <textarea
                        className="creation-input"
                        placeholder="Snapshot Label (e.g. Added textures)"
                        value={versionLabel}
                        onChange={e => setVersionLabel(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                onCreateVersion();
                            }
                        }}
                        rows={1}
                        style={{ height: 'auto', minHeight: '34px' }}
                        autoFocus
                    />
                    <div className="creation-actions">
                        <button onClick={() => setIsCreating(false)} className="btn-cancel">Cancel</button>
                        <button onClick={onCreateVersion} disabled={loading} className="btn-commit">{loading ? 'Saving...' : 'Snapshot'}</button>
                    </div>
                </div>
            )}

            <div className="graph-container">
                <svg className="version-graph-svg" style={{ height: Math.max(200, history.length * ROW_HEIGHT) }}>
                    {links.map((link, i) => {

                        const dy = link.target.y - link.source.y;
                        let d = '';
                        if (link.source.x === link.target.x) {
                            d = `M ${link.source.x} ${link.source.y} L ${link.target.x} ${link.target.y}`;
                        } else {
                            const c1y = link.source.y + dy * 0.5;
                            const c2y = link.target.y - dy * 0.5;
                            d = `M ${link.source.x} ${link.source.y} C ${link.source.x} ${c1y}, ${link.target.x} ${c2y}, ${link.target.x} ${link.target.y}`;
                        }
                        return <path key={i} d={d} stroke={link.color} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />;
                    })}
                </svg>

                {nodes.map((node) => {
                    const verNum = history.length - node.index;
                    const isActive = node.id === activeVersionId;

                    return (
                        <div key={node.id} className="version-row" style={{ height: ROW_HEIGHT }}>
                            <div
                                className="commit-node"
                                style={{
                                    left: node.x - (DOT_SIZE / 2),
                                    top: '50%',
                                    marginTop: -(DOT_SIZE / 2),
                                    backgroundColor: node.color,
                                    borderColor: '#0d0e12',
                                    boxShadow: isActive ? `0 0 0 3px ${node.color}40` : 'none',
                                    width: DOT_SIZE,
                                    height: DOT_SIZE
                                }}
                                title={`ID: ${node.id}`}
                            />

                            <div
                                className={`commit-card ${isActive ? 'active' : ''}`}
                                style={{ marginLeft: contentLeftMargin }}
                            >
                                <div className="commit-upper">
                                    {editingVersionId === node.id ? (
                                        <input
                                            type="text"
                                            className="version-rename-input"
                                            value={editingLabel}
                                            onChange={(e) => setEditingLabel(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    onRename(node.id, editingLabel);
                                                    setEditingVersionId(null);
                                                } else if (e.key === 'Escape') setEditingVersionId(null);
                                            }}
                                            onBlur={() => {
                                                if (editingLabel !== node.label) onRename(node.id, editingLabel);
                                                setEditingVersionId(null);
                                            }}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="commit-message" title={node.label || 'Untitled'}>
                                            {node.label || 'Untitled Snapshot'}
                                        </span>
                                    )}
                                    <span className="commit-id">v{verNum}</span>
                                </div>
                                <div className="commit-lower">
                                    <span>{node.timestamp ? new Date(node.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}</span>
                                    <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
                                    {/* Show compressed size if available, otherwise regular size */}
                                    <span title={`Uncompressed: ${formatSize(node.totalSize)}`}>
                                        {formatSize(node.totalCompressedSize || node.totalSize)}
                                        {node.totalCompressedSize && (
                                            <span style={{ color: '#50fa7b', marginLeft: '4px', fontSize: '9px' }}>
                                                CAS
                                            </span>
                                        )}
                                    </span>
                                </div>

                                <div className="commit-actions">
                                    <button
                                        className="version-action-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingVersionId(node.id);
                                            setEditingLabel(node.label || 'Untitled Snapshot');
                                        }}
                                        title="Rename"
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                    <button className="version-action-btn" onClick={(e) => { e.stopPropagation(); onRestore(node.id); }} title="Restore Snapshot">
                                        <RotateCcw size={13} />
                                    </button>
                                    <button className="version-action-btn" onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} title="Delete">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {history.length === 0 && !isCreating && (
                    <div className="empty-state">
                        <Archive size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                        <div>No snapshots yet</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SnapshotsTab;
