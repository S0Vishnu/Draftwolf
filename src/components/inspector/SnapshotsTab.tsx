import React, { useMemo, useState, useEffect } from 'react';
import { Trash2, RotateCcw, Edit2, Archive, HardDrive, FilePlus, FileText, FileX, ArrowRight } from 'lucide-react';
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
    backupPath?: string;
    changedFiles?: { path: string; type: 'add' | 'change' | 'unlink'; timestamp: number }[];
    onNavigateToChanges?: () => void;
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
    projectRoot,
    backupPath,
    changedFiles,
    onNavigateToChanges
}) => {
    const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState<string>('');
    const [stats, setStats] = useState<{ totalSize: number, totalCompressedSize: number, compressionRatio: string } | null>(null);

    const isDirty = useMemo(() => {
        if (!projectRoot || !changedFiles) return false;
        // If file is explicitly passed (folder), check if any changed file is inside it
        // Otherwise (project root), check if any changes exist
        const normalize = (p: string) => p.replaceAll('\\', '/').toLowerCase();
        
        let target = '';
        if (file) {
            const normalizedRoot = normalize(projectRoot);
            target = normalize(file.path);
            if (target.startsWith(normalizedRoot)) {
                target = target.substring(normalizedRoot.length).replaceAll(/^[/\\]+/g, '');
            }
        }
        
        if (!target || target === '.' || target === '') {
            return changedFiles.length > 0;
        }

        return changedFiles.some(c => {
            const cPath = normalize(c.path);
            return cPath === target || cPath.startsWith(target + '/');
        });
    }, [projectRoot, changedFiles, file]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // @ts-ignore
                const s = await globalThis.api.draft.getStorageReport(projectRoot, backupPath);
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

        const getLaneIndex = (idx: number, verId: string) => {
            const currentLane = lanes.indexOf(verId);
            if (currentLane !== -1) return currentLane;
            if (idx === history.length - 1) return 0;
            const emptyLane = lanes.indexOf(null);
            if (emptyLane !== -1) return emptyLane;
            lanes.push(null);
            return lanes.length - 1;
        };

        history.forEach((ver: any, index: number) => {
            let pId = ver.parentId || ver.parent;
            const needsFallback = (!pId || !idToIndex.has(pId)) && index < history.length - 1;
            
            if (needsFallback) {
                pId = history[index + 1].id;
            }

            const laneIndex = getLaneIndex(index, ver.id);
            if (lanes.length === 0 && laneIndex === 0) lanes.push(null);
            lanes[laneIndex] = pId || null;

            nodes.push({
                ...ver,
                parentId: pId,
                index,
                laneIndex,
                color: LANE_COLORS[laneIndex % LANE_COLORS.length],
                x: LEFT_PADDING + laneIndex * LANE_WIDTH,
                y: index * ROW_HEIGHT + (ROW_HEIGHT / 2)
            });
        });

        // Second pass for links
        nodes.forEach(node => {
            const pId = node.parentId || node.parent;
            if (!pId) return;

            const pNode = nodes.find((n: any) => n.id === pId);
            if (pNode) {
                links.push({
                    source: { x: node.x, y: node.y },
                    target: { x: pNode.x, y: pNode.y },
                    color: node.color,
                    sourceId: node.id,
                    targetId: pNode.id
                });
            }
        });

        return { nodes, links, maxLane: lanes.length };
    }, [history]);

    const { nodes, links, maxLane } = graphData;
    const contentLeftMargin = LEFT_PADDING + (maxLane * LANE_WIDTH) + 12;

    const previewFiles = (changedFiles || []).slice(0, 2);
    const extraCount = (changedFiles || []).length - previewFiles.length;

    return (
        <div className="versions-list">
            {(changedFiles && changedFiles.length > 0) && (
                <div className="changes-preview-card">
                    <div className="changes-preview-header">
                        <span className="changes-preview-title">Pending Changes</span>
                        <span className="changes-preview-count">{changedFiles.length}</span>
                    </div>
                    <div className="changes-preview-items">
                        {previewFiles.map((f) => {
                            let Icon = FileText;
                            if (f.type === 'add') Icon = FilePlus;
                            if (f.type === 'unlink') Icon = FileX;

                            let color = '#ffb86c';
                            if (f.type === 'add') color = '#50fa7b';
                            if (f.type === 'unlink') color = '#ff5555';

                            const name = f.path.replaceAll('\\', '/').split('/').pop() || f.path;
                            return (
                                <div key={f.path} className="changes-preview-item">
                                    <Icon size={12} style={{ color, flexShrink: 0 }} />
                                    <span className="changes-preview-name" title={f.path}>{name}</span>
                                </div>
                            );
                        })}
                        {extraCount > 0 && (
                            <span className="changes-preview-more">+{extraCount} more</span>
                        )}
                    </div>
                    {onNavigateToChanges && (
                        <button className="changes-preview-btn" onClick={onNavigateToChanges}>
                            View Changes <ArrowRight size={12} />
                        </button>
                    )}
                </div>
            )}
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
                        <button
                            onClick={onCreateVersion}
                            disabled={loading || !isDirty}
                            className="btn-commit"
                            style={loading || !isDirty ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            title={isDirty ? undefined : "No changes detected in this directory"}
                        >
                            {loading ? 'Saving...' : 'Snapshot'}
                        </button>
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
                        return <path key={`${link.sourceId}-${link.targetId}`} d={d} stroke={link.color} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />;
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
                                    {node.ignoredCount > 0 && (
                                        <>
                                            <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
                                            <span style={{ color: '#a78bfa', fontSize: '10px' }} title={`${node.ignoredCount} file(s) excluded by .draftignore`}>
                                                🚫 {node.ignoredCount} ignored
                                            </span>
                                        </>
                                    )}
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
