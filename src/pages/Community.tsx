import React from 'react';
import Sidebar from '../components/Sidebar';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import '../styles/Community.css';
import ChannelList from '../components/community/ChannelList';
import ChatArea from '../components/community/ChatArea';

import logoFull from '../assets/logo_full.svg';

const Community = () => {
    const [user] = useAuthState(auth);
    const navigate = useNavigate();
    const [activeChannel, setActiveChannel] = React.useState('general');

    React.useEffect(() => {
        // Basic protection handled by route/app logic usually
    }, [user, navigate]);

    const [isSidebarOpen, setIsSidebarOpen] = React.useState(() => localStorage.getItem('isSidebarOpen') !== 'false');
    return (
        <div className="app-shell" style={{ flexDirection: 'column' }}>
            <div className="app-inner" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
                <Sidebar
                    isOpen={isSidebarOpen}
                    toggleSidebar={() => {
                        const newState = !isSidebarOpen;
                        setIsSidebarOpen(newState);
                        localStorage.setItem('isSidebarOpen', String(newState));
                    }}
                    user={user}
                />
                <div className="community-container" style={{ flex: 1 }}>
                    <div className="community-sidebar">
                        <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center' }}>
                            <img src={logoFull} alt="Draftwolf" style={{ height: '16px' }} />
                        </div>
                        <ChannelList activeChannel={activeChannel} onSelectChannel={setActiveChannel} />
                    </div>
                    <ChatArea channelId={activeChannel} />
                </div>
            </div>
        </div>
    );
};

export default Community;
