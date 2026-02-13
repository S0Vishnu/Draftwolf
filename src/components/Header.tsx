
import React from 'react';
import { Search, RefreshCw, PanelRightClose, PanelRightOpen, Settings, Pin } from 'lucide-react';


interface HeaderProps {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    isPreviewOpen?: boolean;
    togglePreview?: () => void;
    searchQuery?: string;
    setSearchQuery?: (query: string) => void;
    refreshDirectory?: () => void;
    isLoading?: boolean;
    onSettings?: () => void;
    onTogglePin?: () => void;
    isPinned?: boolean;
}


const Header: React.FC<HeaderProps> = ({
    isSidebarOpen,
    toggleSidebar,
    isPreviewOpen = false,
    togglePreview = () => { },
    searchQuery = '',
    setSearchQuery = () => { },
    refreshDirectory = () => { },
    isLoading = false,
    onSettings,
    onTogglePin,
    isPinned = false
}) => {

    return (
        <header className="top-bar">
            <div className="search-container">
                <Search size={16} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="header-right">
                <button className="icon-btn-ghost" onClick={refreshDirectory} title="Sync/Refresh">
                    <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
                </button>
                {onSettings && (
                    <button className="icon-btn-ghost" onClick={onSettings} title="Project Settings">
                        <Settings size={18} />
                    </button>
                )}
                {onTogglePin && (
                    <button
                        className={`icon-btn-ghost ${isPinned ? 'active' : ''}`}
                        onClick={onTogglePin}
                        title={isPinned ? "Unpin Project" : "Pin Project"}
                    >
                        <Pin size={18} fill={isPinned ? "currentColor" : "none"} />
                    </button>
                )}

                <button className="icon-btn-ghost" onClick={togglePreview}>
                    {isPreviewOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
                </button>
            </div>
        </header>
    );
};

export default Header;
