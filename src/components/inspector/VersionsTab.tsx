import React, { useMemo } from 'react';
import { Trash2, RotateCcw, Download, GitCommit } from 'lucide-react';
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
    file: FileEntry;
    onDownload: (ver: any, verNum: number) => void;
    onDelete: (id: string) => void;
    onRestore: (id: string) => void;
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

const ROW_HEIGHT = 56;
const LANE_WIDTH = 16;
const LEFT_PADDING = 8;
const DOT_SIZE = 8;

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
    onRestore
}) => {

    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return '--';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Calculate Graph Layout
    const graphData = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];
        const lanes: (string | null)[] = []; // Stores the 'next expected parent ID' for each lane

        // Map ID to Index for quick lookup
        const idToIndex = new Map<string, number>();
        history.forEach((v, i) => idToIndex.set(v.id, i));

        history.forEach((ver, index) => {
            // Determine Parent ID
            // Logic: ver.parentId is the primary source.
            // Check validity: Does the parent exist in our current list?
            let parentId = ver.parentId || ver.parent;

            const parentExists = parentId && idToIndex.has(parentId);

            // Fallback: If no explicit parent OR parent not found (orphan reference), 
            // assume linear history and connect to the chronologically previous version (next in list).
            if (!parentExists && index < history.length - 1) {
                parentId = history[index + 1].id;
            }

            // Find a lane
            // Check if any lane is expecting this version ID
            let laneIndex = lanes.findIndex(expectedId => expectedId === ver.id);

            if (laneIndex === -1) {
                // If it's the very last node (oldest), always snap to Lane 0 to anchor the graph
                // This prevents the "genesis" commit from floating off to the side if links are broken
                if (index === history.length - 1) {
                    laneIndex = 0;
                } else {
                    // Start a new lane or find empty
                    laneIndex = lanes.findIndex(l => l === null);
                    if (laneIndex === -1) {
                        laneIndex = lanes.length;
                        lanes.push(null);
                    }
                }
            }

            // Assign this version to the lane
            // Update what this lane expects next (the parent of this version)
            // If we forced Lane 0, we overwrite whatever it was expecting (which is fine, we are at the end)
            if (laneIndex >= lanes.length) { // safety extension if forced 0 on empty array? no, lanes.length logic handles pushes
                // handle push cases above
            }
            // Ensure array expands if we forced 0 (should be covered by findIndex logic usually, but 0 is always safe-ish)
            if (lanes.length === 0 && laneIndex === 0) lanes.push(null);

            lanes[laneIndex] = parentId || null;

            // Determine Color
            const color = LANE_COLORS[laneIndex % LANE_COLORS.length];

            nodes.push({
                ...ver,
                parentId, // Explicitly use the resolved/inferred parentId
                index,
                laneIndex,
                color,
                x: LEFT_PADDING + laneIndex * LANE_WIDTH,
                y: index * ROW_HEIGHT + (ROW_HEIGHT / 2)
            });

            // Create Link to Parent
            if (parentId) {
                // We don't know the parent's coordinates yet if we strictly go top-down and parent is below.
                // But we know parent's index via idToIndex map.
                const parentIndex = idToIndex.get(parentId);
                if (parentIndex !== undefined && parentIndex > index) {
                    // Parent is strictly older (lower in list)
                    // We can defer link creation? No, we need to draw lines.
                    // We can tentatively predict parent lane?
                    // Actually, the simple "lane history" logic above already tracks flows.
                    // But for drawing the SVG line, we need source and target (x,y).
                    // We can't know TARGET X until we process the parent.
                    // So we will process links in a second pass or check if we can predict.
                }
            }
        });

        // Second pass for links now that all nodes have assigned lanes/coordinates
        nodes.forEach(node => {
            const parentId = node.parentId || node.parent;
            if (parentId) {
                const parentNode = nodes.find(n => n.id === parentId);
                if (parentNode) {
                    links.push({
                        source: { x: node.x, y: node.y },
                        target: { x: parentNode.x, y: parentNode.y },
                        color: node.color // Use child's color for the line? or parent? usually child flowing into parent.
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
                        <button onClick={onCreateVersion} disabled={loading} className="btn-commit">{loading ? 'Saving...' : 'Commit'}</button>
                    </div>
                </div>
            )}

            <div className="graph-container">
                {/* SVG Layer for Connections */}
                <svg className="version-graph-svg" style={{ height: Math.max(200, history.length * ROW_HEIGHT) }}>
                    {links.map((link, i) => {
                        const dx = link.target.x - link.source.x;
                        const dy = link.target.y - link.source.y;

                        let d = '';
                        if (link.source.x === link.target.x) {
                            d = `M ${link.source.x} ${link.source.y} L ${link.target.x} ${link.target.y}`;
                        } else {
                            // Smooth Cubic Bezier
                            const c1y = link.source.y + dy * 0.5;
                            const c2y = link.target.y - dy * 0.5;
                            d = `M ${link.source.x} ${link.source.y} C ${link.source.x} ${c1y}, ${link.target.x} ${c2y}, ${link.target.x} ${link.target.y}`;
                        }

                        return (
                            <path
                                key={i}
                                d={d}
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
                                    <span className="commit-message" title={node.label || 'Untitled'}>
                                        {node.label || 'Untitled Version'}
                                    </span>
                                    <span className="commit-id">v{verNum}</span>
                                </div>
                                <div className="commit-lower">
                                    <span>{node.timestamp ? new Date(node.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}</span>
                                    <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
                                    <span>{formatSize(node.totalSize)}</span>
                                </div>

                                <div className="commit-actions">
                                    <button
                                        className="version-action-btn"
                                        onClick={(e) => { e.stopPropagation(); onDownload(node, verNum); }}
                                        title={file.isDirectory ? "Cannot download directory" : "Download"}
                                        disabled={file.isDirectory}
                                        style={file.isDirectory ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
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

                {history.length === 0 && !isCreating && (
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
