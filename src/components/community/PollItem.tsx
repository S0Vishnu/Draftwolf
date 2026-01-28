import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';
import { Trash2, Lock } from 'lucide-react';

interface PollOption {
    id: number;
    text: string;
    votes: string[]; // array of userIds
}

interface PollMessage {
    id: string;
    question: string;
    options: PollOption[];
    userId: string;
    displayName: string;
    createdAt: any;
    expiresAt: any;
    isClosed?: boolean;
}

interface PollItemProps {
    message: PollMessage;
    currentUser: User | null | undefined;
    isAdmin: boolean;
    onDelete: (id: string) => void;
}

const PollItem: React.FC<PollItemProps> = ({ message, currentUser, isAdmin, onDelete }) => {
    const totalVotes = message.options.reduce((acc, opt) => acc + opt.votes.length, 0);
    const [showConfirmClose, setShowConfirmClose] = useState(false);

    const handleVote = async (optionId: number) => {
        if (!currentUser) return;
        if (message.isClosed) return; // Prevent voting if closed

        // Optimistic UI could be handled here, but for now we rely on Firestore stream
        // We need to remove user from OTHER options first (if single choice)
        // Assuming single choice for now as typical for simple polls.

        try {
            // Check if user already voted for this option
            const currentOption = message.options.find(o => o.id === optionId);
            const hasVotedThis = currentOption?.votes.includes(currentUser.uid);

            const newOptions = message.options.map(opt => {
                if (opt.id === optionId) {
                    // Toggle vote
                    if (hasVotedThis) {
                        return { ...opt, votes: opt.votes.filter(u => u !== currentUser.uid) };
                    } else {
                        return { ...opt, votes: [...opt.votes, currentUser.uid] };
                    }
                } else {
                    // Remove from others if single choice desired. Let's assume multi-choice allowed based on "polling with multiple options" phrasing? 
                    // "Polling with multiple options" usually means the poll HAS multiple options, not necessarily that user can SELECT multiple.
                    // But standard polls usually force single choice. Let's enforce single choice for better data.
                    return { ...opt, votes: opt.votes.filter(u => u !== currentUser.uid) };
                }
            });

            await updateDoc(doc(db, 'community_messages', message.id), {
                options: newOptions
            });

        } catch (error) {
            console.error("Vote failed:", error);
        }
    };

    const confirmClosePoll = async () => {
        try {
            await updateDoc(doc(db, 'community_messages', message.id), {
                isClosed: true
            });
            setShowConfirmClose(false);
        } catch (error) {
            console.error("Failed to close poll:", error);
        }
    };

    return (
        <div className={`poll-card ${message.isClosed ? 'closed' : ''}`} style={message.isClosed ? { opacity: 0.8, borderColor: '#444' } : {}}>
            {showConfirmClose && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <h4 style={{ marginBottom: '12px', color: '#fff' }}>Close this poll?</h4>
                    <p style={{ marginBottom: '20px', fontSize: '0.9rem', color: '#ccc' }}>
                        Users won't be able to vote anymore.
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => setShowConfirmClose(false)}
                            style={{
                                background: 'transparent',
                                border: '1px solid #555',
                                color: '#ccc',
                                padding: '6px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmClosePoll}
                            style={{
                                background: '#ef4444',
                                border: 'none',
                                color: 'white',
                                padding: '6px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Close Poll
                        </button>
                    </div>
                </div>
            )}

            <div className="poll-header">
                <span className="poll-author">{message.displayName} asks:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {isAdmin && !message.isClosed && (
                        <button onClick={() => setShowConfirmClose(true)} className="poll-delete-btn" title="Close Poll">
                            <Lock size={14} />
                        </button>
                    )}
                    {isAdmin && (
                        <button onClick={() => onDelete(message.id)} className="poll-delete-btn" title="Delete Poll">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
            <h3 className="poll-question">
                {message.question}
                {message.isClosed && <span style={{ fontSize: '0.8rem', color: '#ef4444', marginLeft: '10px', border: '1px solid #ef4444', padding: '2px 6px', borderRadius: '4px' }}>CLOSED</span>}
            </h3>

            <div className="poll-options">
                {message.options.map((opt) => {
                    const count = opt.votes.length;
                    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const isVoted = currentUser && opt.votes.includes(currentUser.uid);

                    return (
                        <div
                            key={opt.id}
                            className={`poll-option ${isVoted ? 'voted' : ''}`}
                            onClick={() => handleVote(opt.id)}
                            style={{ cursor: message.isClosed ? 'default' : 'pointer' }}
                        >
                            <div className="poll-bar-bg">
                                <div className="poll-bar-fill" style={{ width: `${percent}%` }}></div>
                            </div>
                            <div className="poll-option-content">
                                <span className="poll-option-text">{opt.text}</span>
                                <span className="poll-option-stats">{percent}% ({count})</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="poll-footer">
                {totalVotes} votes • {message.isClosed ? 'Poll Closed' : `Expires in ${Math.ceil((message.expiresAt?.toMillis() - Date.now()) / (1000 * 60 * 60 * 24))} days`}
            </div>
        </div>
    );
};

export default PollItem;
