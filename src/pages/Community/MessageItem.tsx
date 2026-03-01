import React from 'react';
import { supabase } from '../../supabase';
import { Reply, AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'react-toastify';
import { formatDistanceToNow } from 'date-fns';
import { Message } from './ChatTab';
import { Profile } from './index';

interface MessageItemProps {
    message: Message;
    currentUser: Profile | null;
    onReply: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, currentUser, onReply }) => {
    const handleReport = async () => {
        if (!currentUser) return;
        const reason = prompt('Why are you reporting this message/user?');
        if (!reason) return;

        const { error } = await supabase.from('reports').insert({
            reported_user_id: message.user_id,
            reported_by: currentUser.id,
            reason: `Message ID: ${message.id} - ${reason}`
        });

        if (error) toast.error('Failed to submit report');
        else toast.success('Report submitted successfully');
    };

    const handleDelete = async () => {
        if (!globalThis.confirm('Delete this message?')) return;
        const { error } = await supabase.from('community_messages').delete().eq('id', message.id);
        if (error) toast.error('Failed to delete: ' + error.message);
    };

    const canDelete = currentUser?.id === message.user_id || currentUser?.is_admin;

    return (
        <div
            className="message-item-container"
            style={{
                display: 'flex', gap: '16px', padding: '8px 16px',
                position: 'relative', overflow: 'hidden',
                backgroundColor: 'transparent',
                transition: 'background-color 0.1s'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2e3035';
                const actions = e.currentTarget.querySelector('.message-actions') as HTMLElement;
                if (actions) actions.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                const actions = e.currentTarget.querySelector('.message-actions') as HTMLElement;
                if (actions) actions.style.opacity = '0';
            }}
        >
            {/* Admin subtle glow effect */}
            {message.profiles?.is_admin && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'gold' }} />
            )}

            <img
                src={message.profiles?.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${message.profiles?.username || 'user'}`}
                alt={message.profiles?.username}
                style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    boxShadow: message.profiles?.is_admin ? '0 0 0 2px gold' : 'none',
                    marginTop: '2px'
                }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                    <strong style={{ color: message.profiles?.is_admin ? 'gold' : '#f2f3f5', fontSize: '16px', fontWeight: 500 }}>
                        {message.profiles?.username || 'Unknown User'}
                    </strong>
                    {message.profiles?.is_admin && <ShieldAlert size={14} color="gold" style={{ position: 'relative', top: '2px' }} />}
                    <span style={{ fontSize: '12px', color: '#949ba4', fontWeight: 500 }}>
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                </div>

                {message.reply_message && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#b5bac1',
                        marginBottom: '4px', paddingLeft: '48px', position: 'relative', left: '-48px'
                    }}>
                        <div style={{
                            width: '32px', height: '12px', borderLeft: '2px solid #4f545c', borderTop: '2px solid #4f545c',
                            borderRadius: '6px 0 0 0', position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)'
                        }} />
                        <img
                            src={message.reply_message.profiles?.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${message.reply_message.profiles?.username || 'user'}`}
                            style={{ width: '16px', height: '16px', borderRadius: '50%' }}
                        />
                        <span style={{ fontWeight: 500, color: '#f2f3f5' }}>@{message.reply_message.profiles?.username}</span>
                        <span style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
                            {message.reply_message.content?.substring(0, 60)} {message.reply_message.content && message.reply_message.content.length > 60 ? '...' : ''}
                        </span>
                    </div>
                )}

                <div style={{ color: '#dbdee1', fontSize: '15px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>
                    {message.content}
                </div>

                {message.image_url && (
                    <img
                        src={message.image_url}
                        alt="Upload"
                        style={{ maxWidth: '400px', maxHeight: '300px', borderRadius: '8px', marginTop: '8px', objectFit: 'contain' }}
                    />
                )}

                {/* Discord-style Hover Action Pill */}
                <div
                    className="message-actions"
                    style={{
                        position: 'absolute', top: '-16px', right: '16px',
                        display: 'flex', alignItems: 'center',
                        backgroundColor: '#313338', border: '1px solid #1e1f22', borderRadius: '4px',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.1)',
                        opacity: 0, transition: 'opacity 0.1s', zIndex: 1, padding: '2px'
                    }}
                >
                    <button
                        onClick={onReply}
                        style={{ background: 'none', border: 'none', color: '#b5bac1', cursor: 'pointer', padding: '6px 8px', borderRadius: '3px', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#404249'; e.currentTarget.style.color = '#dbdee1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b5bac1'; }}
                        title="Reply"
                    >
                        <Reply size={16} />
                    </button>

                    <button
                        onClick={handleReport}
                        style={{ background: 'none', border: 'none', color: '#b5bac1', cursor: 'pointer', padding: '6px 8px', borderRadius: '3px', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#404249'; e.currentTarget.style.color = '#da373c'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b5bac1'; }}
                        title="Report"
                    >
                        <AlertTriangle size={16} />
                    </button>

                    {canDelete && (
                        <button
                            onClick={handleDelete}
                            style={{ background: 'none', border: 'none', color: '#b5bac1', cursor: 'pointer', padding: '6px 8px', borderRadius: '3px', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#404249'; e.currentTarget.style.color = '#da373c'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b5bac1'; }}
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageItem;
