
import React from 'react';
import { Home as HomeIcon, Folder, Settings as SettingsIcon, User as UserIcon } from 'lucide-react';
import { User } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
    isOpen: boolean;
    user: User | null | undefined;
    onOpenFolder?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, user, onOpenFolder }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <aside className={`sidebar ${!isOpen ? 'collapsed' : ''}`}>
            <div className="sidebar-content">
                <div className="sidebar-top">
                    <button
                        className={`side-btn ${isActive('/home') ? 'active' : ''}`}
                        onClick={() => navigate('/home')}
                        title="Home"
                    >
                        <HomeIcon size={22} />
                    </button>
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
                        className={`side-btn ${isActive('/settings') ? 'active' : ''}`}
                        onClick={() => navigate('/settings')}
                        title="Settings & Profile"
                    >
                        <SettingsIcon size={22} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
