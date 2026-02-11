
import React from 'react';
import { Search, RefreshCw, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface HeaderProps {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    isPreviewOpen?: boolean;
    togglePreview?: () => void;
    searchQuery?: string;
    setSearchQuery?: (query: string) => void;
    refreshDirectory?: () => void;
    isLoading?: boolean;
}

const Header: React.FC<HeaderProps> = ({
    isSidebarOpen,
    toggleSidebar,
    isPreviewOpen = false,
    togglePreview = () => {},
    searchQuery = '',
    setSearchQuery = () => {},
    refreshDirectory = () => {},
    isLoading = false
}) => {
    return (
        <header className="top-bar">
            <div className="header-left">
                <button className="icon-btn-ghost" onClick={toggleSidebar}>
                    {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                </button>
            </div>

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
                <button className="icon-btn-ghost" onClick={togglePreview}>
                    {isPreviewOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
                </button>
            </div>
        </header>
    );
};

export default Header;
