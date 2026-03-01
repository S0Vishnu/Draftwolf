import React, { useMemo, useState } from 'react';
import { Trash2, RotateCcw, Download, GitCommit, Edit2, Eye } from 'lucide-react';
import { FileEntry } from '../FileItem';

interface VersionsTabProps {
    history: any[];
    isCreating: boolean;
    setIsCreating: (val: boolean) => void;
    versionLabel: string;
    setVersionLabel: (val: string) => void;
    onCreateVersion: () => void;
    loading: boolean;
    activeVersionId: string | null;
    file?: FileEntry | null;
    onDownload: (ver: any, verNum: number) => void;
    onDelete: (id: string) => void;
    onRestore: (id: string) => void;
    onRename: (id: string, newLabel: string) => void;
    onCompare?: (versionId: string) => void;
    projectRoot?: string;
    changedFiles?: { path: string; type: 'add' | 'change' | 'unlink'; timestamp: number }[];
    currentRelativePath?: string | null;
    onNavigateToChanges?: () => void;
}

const LANE_COLORS = [
    '#6e7bf2', // Blue
    '#ff7eb6', // Pink
    '#50fa7b', // Green
    '#f1fa8c', // Yellow
    '#bd93f9', // Purple
    '#ff5555', // Red
    '#8be9fd', // Cyan
    '#ffb86c', // Orange
];

const ROW_HEIGHT = 44;
const LANE_WIDTH = 14;
const LEFT_PADDING = 8;
const DOT_SIZE = 7;

const VersionsTab: React.FC<VersionsTabProps> = ({
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
    onCompare,
    projectRoot,
    changedFiles,
    currentRelativePath,
    onNavigateToChanges
}) => {
    const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState<string>('');

    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return '--';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const isDirty = useMemo(() => {
        if (!projectRoot || !changedFiles) return false;
        // Use the relative path passed from parent if available, otherwise try file.path
        const normalize = (p: string) => p.replaceAll('\\', '/').toLowerCase();
        
        let pathForComparison = null;
        if (currentRelativePath) {
            pathForComparison = normalize(currentRelativePath);
        } else if (file) {
            pathForComparison = normalize(file.path);
        }

        if (pathForComparison) {
            // Compare against changedFiles
            // The backend sends paths relative to project root
            const change = changedFiles.find(c => normalize(c.path) === pathForComparison);

            if (change) return true;
        }
        return false;
    }, [file, projectRoot, changedFiles, currentRelativePath]);

    const graphData = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];
        const lanes: (string | null)[] = [];
        const idToIndex = new Map<string, number>(history.map((v, i) => [v.id, i]));

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
            if ((!pId || !idToIndex.has(pId)) && index < history.length - 1) {
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

        nodes.forEach(node => {
            const parentId = node.parentId || node.parent;
            if (parentId) {
                const parentNode = nodes.find(n => n.id === parentId);
                if (parentNode) {
                    links.push({
                        source: { x: node.x, y: node.y },
                        target: { x: parentNode.x, y: parentNode.y },
                        color: node.color,
                        sourceId: node.id,
                        targetId: parentNode.id
                    });
                }
            }
        });

        return { nodes, links, maxLane: lanes.length };
    }, [history]);

    const { nodes, links, maxLane } = graphData;

    // Calculate content indentation
    // Content starts after all lanes
    const contentLeftMargin = LEFT_PADDING + (maxLane * LANE_WIDTH) + 12;

    return (
        <div className="versions-list">
            {isDirty && (
                <button 
                    className="unsaved-changes-banner"
                    style={{
                        padding: '8px 12px',
                        margin: '8px 12px 12px 12px',
                        backgroundColor: 'rgba(255, 184, 108, 0.1)',
                        border: '1px solid rgba(255, 184, 108, 0.2)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: '#ffb86c',
                        cursor: onNavigateToChanges ? 'pointer' : 'default',
                        width: 'calc(100% - 24px)',
                        textAlign: 'left'
                    }}
                    onClick={() => onNavigateToChanges?.()}
                    title="Click to view changes"
                >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ffb86c' }} />
                    <span>This file has unsaved changes</span>
                </button>
            )}
            {isCreating && (
                <div className="creation-form">
                    <textarea
                        className="creation-input"
                        placeholder="Version Label (e.g. Added textures)"
                        value={versionLabel}
                        onChange={e => setVersionLabel(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                e.stopPropagation();
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
                            title={isDirty ? undefined : "No changes detected in this file"}
                        >
                            {loading ? 'Saving...' : 'Commit'}
                        </button>
                    </div>
                </div>
            )}

            <div className="graph-container">
                {/* SVG Layer for Connections */}
                <svg className="version-graph-svg" style={{ height: Math.max(200, history.length * ROW_HEIGHT) }}>
                    {links.map((link, i) => {
                        const dy = link.target.y - link.source.y;
                        let dPath = '';
                        
                        if (link.source.x === link.target.x) {
                            dPath = `M ${link.source.x} ${link.source.y} L ${link.target.x} ${link.target.y}`;
                        } else {
                            const c1y = link.source.y + dy * 0.5;
                            const c2y = link.target.y - dy * 0.5;
                            dPath = `M ${link.source.x} ${link.source.y} C ${link.source.x} ${c1y}, ${link.target.x} ${c2y}, ${link.target.x} ${link.target.y}`;
                        }

                        return (
                            <path
                                key={`${link.sourceId}-${link.targetId}`}
                                d={dPath}
                                stroke={link.color}
                                strokeWidth="2"
                                strokeLinecap="round"
                                fill="none"
                                opacity="0.5"
                            />
                        );
                    })}
                </svg>

                {/* Nodes and Content */}
                {nodes.map((node) => {
                    const verNum = history.length - node.index;
                    const isActive = node.id === activeVersionId;

                    return (
                        <div key={node.id} className="version-row" style={{ height: ROW_HEIGHT }}>
                            {/* Dot */}
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

                            {/* Minimal Card Content */}
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
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onRename(node.id, editingLabel);
                                                    setEditingVersionId(null);
                                                } else if (e.key === 'Escape') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setEditingVersionId(null);
                                                }
                                            }}
                                            onBlur={() => {
                                                if (editingLabel !== node.label) {
                                                    onRename(node.id, editingLabel);
                                                }
                                                setEditingVersionId(null);
                                            }}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="commit-message" title={node.label || 'Untitled'}>
                                            {node.label || 'Untitled Version'}
                                        </span>
                                    )}
                                    <span className="commit-id">v{verNum}</span>
                                </div>
                                <div className="commit-lower">
                                    <span>{node.timestamp ? new Date(node.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}</span>
                                    <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
                                    <span>{formatSize(node.totalSize)}</span>
                                </div>

                                <div className="commit-actions">
                                    {onCompare && !file?.isDirectory && (
                                        <button
                                            className="version-action-btn version-compare-btn"
                                            onClick={(e) => { e.stopPropagation(); onCompare(node.id); }}
                                            title="Compare with current"
                                        >
                                            <Eye size={13} />
                                        </button>
                                    )}
                                    <button
                                        className="version-action-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingVersionId(node.id);
                                            setEditingLabel(node.label || 'Untitled Version');
                                        }}
                                        title="Rename"
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                    <button
                                        className="version-action-btn"
                                        onClick={(e) => { e.stopPropagation(); onDownload(node, verNum); }}
                                        title={file?.isDirectory ? "Cannot download directory" : "Download"}
                                        disabled={file?.isDirectory}
                                        style={file?.isDirectory ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                    >
                                        <Download size={13} />
                                    </button>
                                    <button className="version-action-btn" onClick={(e) => { e.stopPropagation(); onRestore(node.id); }} title="Restore">
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

                {history.length === 0 && !isDirty && !isCreating && (
                    <div className="empty-state">
                        <GitCommit size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                        <div>No versions created yet</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VersionsTab;
