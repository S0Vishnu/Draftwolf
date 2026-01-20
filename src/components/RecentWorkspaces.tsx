
import React from 'react';
import { FolderOpen, X, Clock, FolderPlus, Pin, PinOff } from 'lucide-react';
import '../styles/RecentWorkspaces.css';

interface RecentWorkspace {
    path: string;
    lastOpened: number;
    name?: string;
}

interface RecentWorkspacesProps {
    recents: RecentWorkspace[];
    onOpen: (path: string) => void;
    onRemove: (path: string) => void;
    onOpenFolder: () => void;
    pinnedPaths?: string[];
    onTogglePin?: (path: string) => void;
}

const RecentWorkspaces: React.FC<RecentWorkspacesProps> = ({
    recents,
    onOpen,
    onRemove,
    onOpenFolder,
    pinnedPaths = [],
    onTogglePin
}) => {

    // Sort by last opened
    const sortedRecents = [...recents].sort((a, b) => b.lastOpened - a.lastOpened);

    return (
        <div className="recent-workspaces-container">
            <div className="welcome-header">
                <h1 className="app-title">DraftWolf</h1>
                <p className="welcome-subtitle">
                    Welcome back. Open a recent workspace or start a new project to get started.
                </p>
            </div>

            <div className="action-buttons" style={{ marginBottom: '48px' }}>
                <button className="big-action-btn primary" onClick={onOpenFolder}>
                    <FolderPlus size={24} />
                    Open Folder
                </button>
            </div>

            {sortedRecents.length > 0 && (
                <>
                    <h2 className="section-title">
                        <Clock size={16} />
                        Recently Opened
                    </h2>

                    <div className="workspaces-grid">
                        {sortedRecents.map((workspace) => {
                            const isPinned = pinnedPaths.includes(workspace.path);
                            return (
                                <div
                                    key={workspace.path}
                                    className="workspace-card"
                                    onClick={() => onOpen(workspace.path)}
                                >
                                    <div className="card-header">
                                        <div className="workspace-icon">
                                            <FolderOpen size={24} />
                                        </div>
                                        <div className="card-info">
                                            <h3 className="workspace-name">
                                                {workspace.name || workspace.path.split(/[/\\]/).pop()}
                                            </h3>
                                            <div className="workspace-path" title={workspace.path}>
                                                {workspace.path}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="card-actions">
                                        {onTogglePin && (
                                            <button
                                                className={`action-icon-btn ${isPinned ? 'active' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onTogglePin(workspace.path);
                                                }}
                                                title={isPinned ? "Unpin" : "Pin"}
                                            >
                                                {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                                            </button>
                                        )}
                                        <button
                                            className="action-icon-btn remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemove(workspace.path);
                                            }}
                                            title="Remove from history"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {sortedRecents.length === 0 && (
                <div className="empty-recents">
                    <p>No recently opened workspaces.</p>
                </div>
            )}
        </div>
    );
};

export default RecentWorkspaces;
