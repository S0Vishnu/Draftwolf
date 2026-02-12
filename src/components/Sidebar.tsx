import React from 'react';
import { Home as HomeIcon, Folder, Settings as SettingsIcon, Database, Users, Package, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { User } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/icons/logo.png';

interface SidebarProps {
    isOpen: boolean;
    toggleSidebar?: () => void;
    user: User | null | undefined;
    onOpenFolder?: () => void;
    onGoHome?: () => void;
    hasActiveWorkspace?: boolean;
    pinnedFolders?: { path: string; name: string }[];
    onSelectProject?: (path: string) => void;
    activePath?: string | null;
}

interface SidebarProjectLinkProps {
    folder: any;
    isActive: boolean;
    isOpen: boolean;
    onSelect: (path: string) => void;
    navigate: (path: string) => void;
}

const SidebarProjectLink: React.FC<SidebarProjectLinkProps> = ({ folder, isActive, isOpen, onSelect, navigate }) => (
    <button
        className={`side-btn project-btn ${isActive ? 'active' : ''}`}
        onClick={(e) => {
            e.stopPropagation();
            onSelect(folder.path);
        }}
        title={isOpen ? "" : folder.name}
    >
        <div className="project-icon-wrapper" style={{ 
            background: folder.color ? `${folder.color}25` : 'rgba(59, 130, 246, 0.1)',
            border: folder.color ? `1px solid ${folder.color}55` : '1px solid rgba(59, 130, 246, 0.2)',
        }}>
            <span className="project-letter" style={{ color: folder.color || 'var(--accent)' }}>
                {folder.name.charAt(0).toUpperCase()}
            </span>
        </div>
        <span className="btn-label">{folder.name}</span>
        
        {isOpen && (
            <button 
                className="project-settings-trigger"
                onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/project-settings?path=${encodeURIComponent(folder.path)}`);
                }}
                title="Project Settings"
                aria-label={`Settings for ${folder.name}`}
            >
                <SettingsIcon size={14} />
            </button>
        )}
    </button>
);

const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    toggleSidebar,
    user,
    onOpenFolder,
    onGoHome,
    hasActiveWorkspace = false,
    pinnedFolders = [],
    onSelectProject,
    activePath
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    const handleRecentsClick = () => {
        if (onGoHome) {
            onGoHome();
        } else if (location.pathname !== '/home') {
            navigate('/home');
        }
    };


    return (
        <aside 
            className={`sidebar ${isOpen ? '' : 'collapsed'}`}
            onClick={(e) => {
                // Only trigger if clicking the aside background or non-button elements
                if (!isOpen && toggleSidebar) {
                    toggleSidebar();
                }
            }}
        >
            <div className="sidebar-content">
                <div className="sidebar-header">
                    <div className="sidebar-logo-container">
                        <img src={logo} alt="DraftWolf" className="sidebar-logo-img" />
                        {isOpen && <span className="app-logo-text">DraftWolf</span>}
                    </div>
                    <button className="sidebar-toggle-btn" onClick={(e) => { e.stopPropagation(); toggleSidebar?.(); }} title={isOpen ? "Close sidebar" : "Open sidebar"}>
                        {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                    </button>
                </div>
                <div className="sidebar-top">
                    {isOpen && <div className="section-label">GENERAL</div>}
                    {/* Home / Recent Workspaces Button */}
                    <button
                        className={`side-btn ${isActive('/home') && !hasActiveWorkspace ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRecentsClick();
                        }}
                        title={isOpen ? "" : "Recent Workspaces"}
                    >
                        <HomeIcon size={22} />
                        <span className="btn-label">Workspaces</span>
                    </button>

                    {onOpenFolder && (
                        <button
                            className="side-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenFolder();
                            }}
                            title={isOpen ? "" : "Open Folder"}
                        >
                            <Folder size={22} />
                            <span className="btn-label">Open Folder</span>
                        </button>
                    )}

                    <button
                        className={`side-btn ${isActive('/community') ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate('/community');
                        }}
                        title={isOpen ? "" : "Community"}
                    >
                        <Users size={22} />
                        <span className="btn-label">Community</span>
                    </button>
                </div>

                {/* Pinned Folders List */}
                <div className="sidebar-projects">
                    {pinnedFolders.length > 0 && (
                        <>
                            <div className="sidebar-divider" />
                            {isOpen && <div className="section-label">PROJECTS</div>}
                            {pinnedFolders.map((folder: any, index) => (
                                <SidebarProjectLink
                                    key={`${folder.path}-${index}`}
                                    folder={folder}
                                    isActive={activePath === folder.path}
                                    isOpen={isOpen}
                                    onSelect={onSelectProject || (() => {})}
                                    navigate={navigate}
                                />
                            ))}
                        </>
                    )}
                </div>

                <div className="sidebar-bottom">
                    <div className="sidebar-divider" />
                    <button
                        className={`side-btn ${isActive('/extensions') ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate('/extensions');
                        }}
                        title={isOpen ? "" : "Extensions"}
                    >
                        <Package size={22} />
                        <span className="btn-label">Extensions</span>
                    </button>
                    <button
                        className={`side-btn ${isActive('/cleanup') ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate('/cleanup');
                        }}
                        title={isOpen ? "" : "Cleanup & Storage"}
                    >
                        <Database size={22} />
                        <span className="btn-label">Cleanup</span>
                    </button>

                    <button
                        className={`side-btn settings-btn ${isActive('/settings') ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate('/settings');
                        }}
                        title={isOpen ? "" : "Settings & Profile"}
                    >
                        <div className="settings-icon-wrapper">
                            {user?.photoURL ? (
                                <img
                                    src={user.photoURL}
                                    alt="Profile"
                                    className="sidebar-profile-img"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <SettingsIcon size={22} />
                            )}
                        </div>
                        <span className="btn-label">Settings</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
