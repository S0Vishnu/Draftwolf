import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Users, Info, BarChart2, ShieldAlert, Hash } from 'lucide-react';
import '../../styles/AppLayout.css';
import '../../styles/community.css';
import ChatTab from './ChatTab';
import PollsTab from './PollsTab';
import Sidebar from '../../components/Sidebar';

export interface Profile {
    id: string;
    username: string;
    avatar_url: string;
    is_admin: boolean;
}

const Community: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'general' | 'updates' | 'polls'>('general');
    const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
    const [userAuth, setUserAuth] = useState<any>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('isSidebarOpen') !== 'false');

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserAuth(user);
                const fallbackProfile: Profile = {
                    id: user.id,
                    username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                    avatar_url: user.user_metadata?.avatar_url || '',
                    is_admin: false
                };

                // Immediately unblock user capabilities by checking local storage or setting early fallback
                const cachedProfileStr = localStorage.getItem('currentUserProfile');
                if (cachedProfileStr) {
                    try {
                        const cachedProfile = JSON.parse(cachedProfileStr);
                        if (cachedProfile.id === user.id) {
                            setCurrentUserProfile(cachedProfile);
                        } else {
                            setCurrentUserProfile(fallbackProfile);
                        }
                    } catch (e) {
                        console.log(e);
                        setCurrentUserProfile(fallbackProfile);
                    }
                } else {
                    setCurrentUserProfile(fallbackProfile);
                }

                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    setCurrentUserProfile(data);
                    localStorage.setItem('currentUserProfile', JSON.stringify(data));
                } else if (error?.code === 'PGRST116') {
                    // Optionally try to insert the profile if missing
                    await supabase.from('profiles').insert([fallbackProfile]).select().single();
                } else {
                    console.error("Error fetching profile:", error);
                }
            }
        };
        fetchProfile();
    }, []);

    return (
        <div className="discord-community-container">
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={() => {
                    const newState = !isSidebarOpen;
                    setIsSidebarOpen(newState);
                    localStorage.setItem('isSidebarOpen', String(newState));
                }}
                user={userAuth}
            />
            {/* Discord-style Channel Sidebar */}
            <div className="discord-community-sidebar">
                {/* Server Header */}
                <div className="discord-community-sidebar-header">
                    <h1 className="discord-community-sidebar-title">
                        <Users size={20} /> Community
                    </h1>
                    {currentUserProfile?.is_admin && (
                        <div className="discord-community-admin-icon" title="Admin">
                            <ShieldAlert size={16} />
                        </div>
                    )}
                </div>

                {/* Channel List */}
                <div className="discord-community-channel-list">
                    <div className="discord-community-channel-category">
                        Text Channels
                    </div>

                    {/* General Channel */}
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`discord-community-channel-btn ${activeTab === 'general' ? 'active' : ''}`}
                    >
                        <Hash size={20} color="#80848e" /> general-chat
                    </button>

                    {/* Updates Channel */}
                    <button
                        onClick={() => setActiveTab('updates')}
                        className={`discord-community-channel-btn ${activeTab === 'updates' ? 'active' : ''}`}
                    >
                        <Info size={20} color="#80848e" /> updates-and-requests
                    </button>

                    <div className="discord-community-channel-category" style={{ marginTop: '16px' }}>
                        Activities
                    </div>

                    {/* Polls */}
                    <button
                        onClick={() => setActiveTab('polls')}
                        className={`discord-community-channel-btn ${activeTab === 'polls' ? 'active' : ''}`}
                    >
                        <BarChart2 size={20} color="#80848e" /> polls
                    </button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="discord-community-main-area">
                {/* Top Channel Title Bar */}
                <div className="discord-community-top-bar">
                    <h2 className="discord-community-top-bar-title">
                        {activeTab === 'general' && <><Hash size={24} color="#80848e" /> general-chat</>}
                        {activeTab === 'updates' && <><Info size={24} color="#80848e" /> updates-and-requests</>}
                        {activeTab === 'polls' && <><BarChart2 size={24} color="#80848e" /> polls</>}
                    </h2>
                </div>

                {/* Content */}
                <div className="discord-community-content-area">
                    {activeTab === 'general' && <ChatTab channel="general" currentUser={currentUserProfile} />}
                    {activeTab === 'updates' && <ChatTab channel="updates" currentUser={currentUserProfile} />}
                    {activeTab === 'polls' && <PollsTab currentUser={currentUserProfile} />}
                </div>
            </div>
        </div>
    );
};

export default Community;
