import React from 'react';
import { Home as HomeIcon, Folder, Settings as SettingsIcon, User as UserIcon, FileText } from 'lucide-react';
import { User } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
    isOpen: boolean;
    user: User | null | undefined;
    onOpenFolder?: () => void;
    onGoHome?: () => void;
    hasActiveWorkspace?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, user, onOpenFolder, onGoHome, hasActiveWorkspace = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    const handleRecentsClick = () => {
        if (onGoHome) {
            onGoHome();
        } else {
            if (location.pathname !== '/home') {
                navigate('/home');
            }
        }
    };

    const handleWorkspaceClick = () => {
        if (location.pathname !== '/home') {
            navigate('/home');
        }
    };

    return (
        <aside className={`sidebar ${!isOpen ? 'collapsed' : ''}`}>
            <div className="sidebar-content">
                <div className="sidebar-top">
                    {/* Home / Recent Workspaces Button */}
                    <button
                        className={`side-btn ${isActive('/home') && !hasActiveWorkspace ? 'active' : ''}`}
                        onClick={handleRecentsClick}
                        title="Recent Workspaces"
                    >
                        <HomeIcon size={22} />
                    </button>

                    {/* Current Workspace Button - Only visible when workspace is active */}
                    {hasActiveWorkspace && (
                        <button
                            className={`side-btn ${isActive('/home') && hasActiveWorkspace ? 'active' : ''}`}
                            onClick={handleWorkspaceClick}
                            title="Current Workspace"
                        >
                            <FileText size={22} />
                        </button>
                    )}

                    {onOpenFolder && (
                        <button
                            className="side-btn"
                            onClick={onOpenFolder}
                            title="Open Folder"
                        >
                            <Folder size={22} />
                        </button>
                    )}
                </div>
                <div className="sidebar-bottom">
                    <button
                        className={`side-btn settings-btn ${isActive('/settings') ? 'active' : ''}`}
                        onClick={() => navigate('/settings')}
                        title="Settings & Profile"
                    >
                        {user?.photoURL ? (
                            <img
                                src={user.photoURL}
                                alt="Profile"
                                className="sidebar-profile-img"
                            />
                        ) : (
                            <SettingsIcon size={22} />
                        )}
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
