import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Trash2, Edit2, X, Check, CornerUpLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmDialog from '../ConfirmDialog';

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

    const formatTime = (timestamp: any) => {
        if (!timestamp) return 'Sending...';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        setShowDeleteConfirm(false);
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

    const handleReplyClick = () => {
        if (!message.replyTo?.id) return;

        const element = document.getElementById(`message-${message.replyTo.id}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('highlight-message');
            setTimeout(() => element.classList.remove('highlight-message'), 2000);
        } else {
            toast.info("Original message not mapped in current view");
        }
    };

    return (
        <div
            id={`message-${message.id}`}
            className="message-item"
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
                    <button
                        className="reply-context-message"
                        onClick={handleReplyClick}
                        title="Scroll to original message"
                        style={{
                            fontSize: '0.8rem',
                            color: '#aaa',
                            borderLeft: '2px solid #555',
                            paddingLeft: '8px',
                            marginBottom: '4px',
                            marginTop: '2px',
                            cursor: 'pointer',
                            background: 'none',
                            border: 'none',
                            textAlign: 'left',
                            width: '100%',
                            padding: '0'
                        }}
                    >
                        <span style={{ fontWeight: 'bold' }}>{message.replyTo.displayName}</span>: {message.replyTo.text.substring(0, 50)}{message.replyTo.text.length > 50 ? '...' : ''}
                    </button>
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

            {!isEditing && (
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
                            <button onClick={handleDeleteClick} className="danger" title="Delete">
                                <Trash2 size={14} />
                            </button>
                        </>
                    )}
                </div>
            )}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Message"
                message="Are you sure you want to delete this message?"
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                isDangerous={true}
                confirmText="Delete"
            />
        </div>
    );
};

export default MessageItem;
