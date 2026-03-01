import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Users, Info, BarChart2, ShieldAlert, Hash } from 'lucide-react';
import '../../styles/AppLayout.css';
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

                // Immediately unblock user capabilities by setting early fallback
                setCurrentUserProfile(fallbackProfile);

                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    setCurrentUserProfile(data);
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
        <div style={{ display: 'flex', height: '100vh', width: '100%', backgroundColor: '#313338' }}>
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
            <div style={{
                width: '240px',
                backgroundColor: '#2b2d31', /* Discord channel sidebar color */
                borderRight: '1px solid #1e1f22',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0
            }}>
                {/* Server Header */}
                <div style={{
                    padding: '16px',
                    borderBottom: '1px solid #1e1f22',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <h1 style={{ fontSize: '16px', fontWeight: 'bold', color: '#f2f3f5', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={20} /> Community
                    </h1>
                    {currentUserProfile?.is_admin && (
                        <div style={{ color: 'gold' }} title="Admin">
                            <ShieldAlert size={16} />
                        </div>
                    )}
                </div>

                {/* Channel List */}
                <div style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{
                        fontSize: '12px', fontWeight: 'bold', color: '#949ba4',
                        textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '8px'
                    }}>
                        Text Channels
                    </div>

                    {/* General Channel */}
                    <button
                        onClick={() => setActiveTab('general')}
                        style={{
                            background: activeTab === 'general' ? '#404249' : 'transparent',
                            border: 'none',
                            color: activeTab === 'general' ? '#f2f3f5' : '#949ba4',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderRadius: '4px',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'background 0.1s, color 0.1s'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== 'general') {
                                e.currentTarget.style.backgroundColor = '#35373c';
                                e.currentTarget.style.color = '#dbdee1';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== 'general') {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#949ba4';
                            }
                        }}
                    >
                        <Hash size={20} color="#80848e" /> general-chat
                    </button>

                    {/* Updates Channel */}
                    <button
                        onClick={() => setActiveTab('updates')}
                        style={{
                            background: activeTab === 'updates' ? '#404249' : 'transparent',
                            border: 'none',
                            color: activeTab === 'updates' ? '#f2f3f5' : '#949ba4',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderRadius: '4px',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'background 0.1s, color 0.1s'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== 'updates') {
                                e.currentTarget.style.backgroundColor = '#35373c';
                                e.currentTarget.style.color = '#dbdee1';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== 'updates') {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#949ba4';
                            }
                        }}
                    >
                        <Info size={20} color="#80848e" /> updates-and-requests
                    </button>

                    <div style={{
                        fontSize: '12px', fontWeight: 'bold', color: '#949ba4',
                        textTransform: 'uppercase', marginTop: '16px', marginBottom: '8px', paddingLeft: '8px'
                    }}>
                        Activities
                    </div>

                    {/* Polls */}
                    <button
                        onClick={() => setActiveTab('polls')}
                        style={{
                            background: activeTab === 'polls' ? '#404249' : 'transparent',
                            border: 'none',
                            color: activeTab === 'polls' ? '#f2f3f5' : '#949ba4',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderRadius: '4px',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'background 0.1s, color 0.1s'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== 'polls') {
                                e.currentTarget.style.backgroundColor = '#35373c';
                                e.currentTarget.style.color = '#dbdee1';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== 'polls') {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#949ba4';
                            }
                        }}
                    >
                        <BarChart2 size={20} color="#80848e" /> polls
                    </button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#313338' }}>
                {/* Top Channel Title Bar */}
                <div style={{
                    height: '52px',
                    borderBottom: '1px solid #1e1f22',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    flexShrink: 0
                }}>
                    <h2 style={{ fontSize: '16px', margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {activeTab === 'general' && <><Hash size={24} color="#80848e" /> general-chat</>}
                        {activeTab === 'updates' && <><Info size={24} color="#80848e" /> updates-and-requests</>}
                        {activeTab === 'polls' && <><BarChart2 size={24} color="#80848e" /> polls</>}
                    </h2>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {activeTab === 'general' && <ChatTab channel="general" currentUser={currentUserProfile} />}
                    {activeTab === 'updates' && <ChatTab channel="updates" currentUser={currentUserProfile} />}
                    {activeTab === 'polls' && <PollsTab currentUser={currentUserProfile} />}
                </div>
            </div>
        </div>
    );
};

export default Community;
