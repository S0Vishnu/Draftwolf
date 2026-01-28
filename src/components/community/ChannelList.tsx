import React from 'react';
import { Hash, Volume2, MessageSquare } from 'lucide-react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

const channels = [
    { id: 'general', name: 'General', type: 'text', icon: Hash },
    { id: 'help', name: 'Help & Support', type: 'text', icon: Hash },
    { id: 'announcements', name: 'Announcements', type: 'text', icon: Volume2 },
    { id: 'polls', name: 'Community Polls', type: 'text', icon: MessageSquare },
];

interface ChannelListProps {
    activeChannel: string;
    onSelectChannel: (id: string) => void;
}

const ChannelList: React.FC<ChannelListProps> = ({ activeChannel, onSelectChannel }) => {
    // Query for polls
    const pollQuery = query(
        collection(db, 'community_messages'),
        where('channelId', '==', 'polls')
    );
    const [snapshot] = useCollection(pollQuery);

    // Calculate active polls
    const activePollsCount = snapshot?.docs.filter(doc => {
        const data = doc.data();
        if (!data.createdAt || data.type !== 'poll' || data.isClosed) return false;
        const created = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return created > sevenDaysAgo;
    }).length || 0;

    return (
        <div className="channel-list">
            <h3 style={{ padding: '0 12px', marginBottom: '10px', fontSize: '12px', textTransform: 'uppercase', color: '#666', fontWeight: 'bold' }}>
                Channels
            </h3>
            {channels.map(channel => (
                <div
                    key={channel.id}
                    className={`channel-item ${activeChannel === channel.id ? 'active' : ''}`}
                    onClick={() => onSelectChannel(channel.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <channel.icon size={16} style={{ marginRight: '8px', opacity: 0.7 }} />
                        <span>{channel.name}</span>
                    </div>
                    {channel.id === 'polls' && activePollsCount > 0 && (
                        <span style={{
                            backgroundColor: '#4a9eff',
                            color: 'white',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            minWidth: '16px',
                            textAlign: 'center'
                        }}>
                            {activePollsCount}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ChannelList;
