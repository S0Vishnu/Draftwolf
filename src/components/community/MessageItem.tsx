import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Trash2, Edit2, X, Check, MoreVertical, CornerUpLeft } from 'lucide-react';
import { toast } from 'react-toastify';

interface Message {
    id: string;
    text: string;
    userId: string;
    displayName: string;
    photoURL: string;
    createdAt: any;
    imageUrl?: string;
    type: 'text' | 'image';
    replyTo?: {
        id: string;
        displayName: string;
        text: string;
    };
}

interface MessageItemProps {
    message: Message;
    currentUser: User | null | undefined;
    onReply: (message: Message) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, currentUser, onReply }) => {
    const isOwner = currentUser?.uid === message.userId;
    // Basic admin check (could be expanded based on claims)
    const isAdmin = false; // Placeholder

    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(message.text);
    const [showActions, setShowActions] = useState(false);

    const formatTime = (timestamp: any) => {
        if (!timestamp) return 'Sending...';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleDelete = async () => {
        if (!window.confirm("Delete this message?")) return;
        try {
            await deleteDoc(doc(db, 'community_messages', message.id));
            toast.success("Message deleted");
        } catch (error) {
            console.error("Error deleting message:", error);
            toast.error("Failed to delete");
        }
    };

    const handleUpdate = async () => {
        if (editValue.trim() === '') return;
        try {
            await updateDoc(doc(db, 'community_messages', message.id), {
                text: editValue,
                isEdited: true
            });
            setIsEditing(false);
            toast.success("Message updated");
        } catch (error) {
            console.error("Error updating message:", error);
            toast.error("Failed to update");
        }
    };

    return (
        <div
            className="message-item"
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <div className="message-avatar">
                {message.photoURL ? (
                    <img src={message.photoURL} alt={message.displayName} referrerPolicy="no-referrer" />
                ) : (
                    <div className="avatar-placeholder">{message.displayName?.charAt(0) || '?'}</div>
                )}
            </div>

            <div className="message-body">
                <div className="message-header">
                    <span className="message-author">{message.displayName || 'Anonymous'}</span>
                    <span className="message-time">{formatTime(message.createdAt)}</span>
                </div>

                {message.replyTo && (
                    <div className="reply-context-message" style={{
                        fontSize: '0.8rem',
                        color: '#aaa',
                        borderLeft: '2px solid #555',
                        paddingLeft: '8px',
                        marginBottom: '4px',
                        marginTop: '2px'
                    }}>
                        <span style={{ fontWeight: 'bold' }}>{message.replyTo.displayName}</span>: {message.replyTo.text.substring(0, 50)}{message.replyTo.text.length > 50 ? '...' : ''}
                    </div>
                )}

                {isEditing ? (
                    <div className="edit-box">
                        <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdate();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                        />
                        <button onClick={handleUpdate}><Check size={14} /></button>
                        <button onClick={() => setIsEditing(false)}><X size={14} /></button>
                    </div>
                ) : (
                    <div className="message-content">
                        {message.text}
                        {message.imageUrl && (
                            <div className="message-image-container">
                                <img src={message.imageUrl} alt="attachment" loading="lazy" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showActions && !isEditing && (
                <div className="message-actions">
                    <button onClick={() => onReply(message)} title="Reply">
                        <CornerUpLeft size={14} />
                    </button>
                    {(isOwner || isAdmin) && (
                        <>
                            {isOwner && !message.imageUrl && (
                                <button onClick={() => setIsEditing(true)} title="Edit">
                                    <Edit2 size={14} />
                                </button>
                            )}
                            <button onClick={handleDelete} className="danger" title="Delete">
                                <Trash2 size={14} />
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default MessageItem;
