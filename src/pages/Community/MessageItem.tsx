import React from 'react';
import { supabase } from '../../supabase';
import { Reply, AlertTriangle, Trash2, BadgeCheck } from 'lucide-react';
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
        <div className="discord-message-item-container">

            <img
                src={message.profiles?.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${message.profiles?.username || 'user'}`}
                alt={message.profiles?.username}
                className={`discord-message-avatar ${message.profiles?.is_admin ? 'verified' : ''}`}
                onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://api.dicebear.com/9.x/avataaars/svg?seed=${message.profiles?.username || 'user'}`;
                }}
            />

            <div className="discord-message-content-wrapper">
                {message.reply_message && (
                    <div className="discord-message-reply-preview">
                        <div className="discord-message-reply-line" />
                        <img
                            src={message.reply_message.profiles?.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${message.reply_message.profiles?.username || 'user'}`}
                            className="discord-message-reply-avatar"
                            alt=""
                            onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = `https://api.dicebear.com/9.x/avataaars/svg?seed=${message.reply_message.profiles?.username || 'user'}`;
                            }}
                        />
                        <span className="discord-message-reply-username">@{message.reply_message.profiles?.username}</span>
                        <span className="discord-message-reply-text">
                            {message.reply_message.content?.substring(0, 60)} {message.reply_message.content && message.reply_message.content.length > 60 ? '...' : ''}
                        </span>
                    </div>
                )}

                <div className="discord-message-header">
                    <strong className="discord-message-username">
                        {message.profiles?.username || 'Unknown User'}
                    </strong>
                    {message.profiles?.is_admin && (
                        <span className="discord-message-verified-badge" title="Verified">
                            <BadgeCheck size={14} strokeWidth={2.5} />
                        </span>
                    )}
                    <span className="discord-message-timestamp">
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                </div>

                <div className="discord-message-body">
                    {message.content}
                </div>

                {message.image_url && (
                    <img
                        src={message.image_url}
                        alt="Upload"
                        className="discord-message-image"
                    />
                )}

                {/* Discord-style Hover Action Pill */}
                <div className="discord-message-actions">
                    <button
                        onClick={onReply}
                        className="discord-message-action-btn"
                        title="Reply"
                    >
                        <Reply size={16} />
                    </button>

                    {/* <button
                        onClick={handleReport}
                        className="discord-message-action-btn danger"
                        title="Report"
                    >
                        <AlertTriangle size={16} />
                    </button> */}

                    {canDelete && (
                        <button
                            onClick={handleDelete}
                            className="discord-message-action-btn danger"
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
