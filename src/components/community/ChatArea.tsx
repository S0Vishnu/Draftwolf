import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, X, Loader2, Plus, Search, CornerUpLeft } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme, EmojiStyle } from 'emoji-picker-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollection, useDocument } from 'react-firebase-hooks/firestore';
import { collection, addDoc, query, where, Timestamp, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import MessageItem from './MessageItem';
import PollItem from './PollItem';
import ConfirmDialog from '../ConfirmDialog';
import { toast } from 'react-toastify';

interface ChatAreaProps {
    channelId: string;
}

const ChatArea: React.FC<ChatAreaProps> = ({ channelId }) => {
    const [user] = useAuthState(auth);

    // Fetch user role from Firestore
    const [userDoc] = useDocument(user ? doc(db, 'users', user.uid) : null);
    const userData = userDoc?.data();
    const isAdmin = userData?.role === 'admin';

    const [newMessage, setNewMessage] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Search & Lazy Load
    const [searchQuery, setSearchQuery] = useState('');
    const [messageLimit, setMessageLimit] = useState(20);

    // Poll Creation State
    const [isCreatingPoll, setIsCreatingPoll] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState([
        { id: crypto.randomUUID(), text: '' },
        { id: crypto.randomUUID(), text: '' }
    ]);

    // Reply & Emoji State
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    // Close emoji picker on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };

        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

    // Calculate 7 days ago for query
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const simpleQuery = query(
        collection(db, 'community_messages'),
        where('channelId', '==', channelId)
    );

    const [snapshot, loading, error] = useCollection(simpleQuery);

    // Client-side sort, filter, and "lazy render"
    const allMessages = snapshot?.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(msg => {
            // Expiry check
            if (msg.createdAt) {
                const date = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                if (date <= sevenDaysAgo) return false;
            }

            // Search filter
            if (searchQuery) {
                const text = msg.text || '';
                const question = msg.question || '';
                const query = searchQuery.toLowerCase();
                return text.toLowerCase().includes(query) || question.toLowerCase().includes(query);
            }
            return true;
        })
        .sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeA - timeB;
        }) || [];

    // Lazy Load / Pagination Logic (Client Side for 7-day window)
    const visibleMessages = allMessages.slice(Math.max(allMessages.length - messageLimit, 0));
    const hasMore = allMessages.length > messageLimit;

    useEffect(() => {
        // Only auto-scroll if we are at the bottom or it's the first load
        // For now simple: scroll to bottom if not viewing history
        if (!hasMore || messageLimit === 20) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [snapshot, channelId, searchQuery]);

    const loadMore = () => {
        setMessageLimit(prev => prev + 20);
    };

    // Helper function to upload image - extracted to reduce complexity
    const uploadImage = async (file: File): Promise<string> => {
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image size must be less than 5MB");
            throw new Error("Image size exceeds limit");
        }

        // Debug log for bucket config
        console.log("Storage Bucket Config:", storage.app.options.storageBucket);
        if (!storage.app.options.storageBucket) {
            toast.error("Config Error: Storage Bucket is missing in .env");
            throw new Error("Storage bucket not configured");
        }

        const fileRef = ref(storage, `community/${channelId}/${Date.now()}_${file.name}`);
        const uploadTask = await uploadBytesResumable(fileRef, file);
        return await getDownloadURL(uploadTask.ref);
    };

    // Helper function to handle message errors - extracted to reduce complexity
    const handleMessageError = (error: any) => {
        console.error("Error sending message:", error);
        if (error.code) console.error("Firebase Error Code:", error.code);
        if (error.customData) console.error("Error Custom Data:", error.customData);

        const errorMessage = error.message || "Unknown error";
        const isCorsOrUnknown = errorMessage.includes("unknown") || errorMessage.includes("cors");

        if (isCorsOrUnknown) {
            console.warn("Potential Issues: 1. CORS (Fixed in Electron Main?) 2. Invalid Bucket Name in .env");
            toast.error(`Upload Failed (${error.code || 'Unknown'}): ${errorMessage}`);
        } else {
            toast.error(`Failed to send message: ${errorMessage}`);
        }
    };

    // Helper function to reset form state - extracted to reduce complexity
    const resetMessageForm = () => {
        setNewMessage('');
        if (textInputRef.current) {
            textInputRef.current.style.height = 'auto';
        }
        setImageFile(null);
        setReplyingTo(null);
        setShowEmojiPicker(false);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!newMessage.trim() && !imageFile) || !user) return;

        setIsUploading(true);
        try {
            let imageUrl = '';
            if (imageFile) {
                imageUrl = await uploadImage(imageFile);
            }

            await addDoc(collection(db, 'community_messages'), {
                text: newMessage,
                channelId,
                userId: user.uid,
                displayName: user.displayName || 'Anonymous',
                photoURL: user.photoURL || '',
                createdAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days TTL
                type: imageUrl ? 'image' : 'text',
                imageUrl,
                replyTo: replyingTo ? {
                    id: replyingTo.id,
                    displayName: replyingTo.displayName,
                    text: replyingTo.text || 'Image'
                } : null,
                likes: []
            });

            resetMessageForm();
        } catch (error: any) {
            handleMessageError(error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCreatePoll = async () => {
        if (!pollQuestion.trim() || pollOptions.some(o => !o.text.trim())) {
            toast.error("Please fill in question and all options");
            return;
        }

        try {
            const optionsData = pollOptions
                .filter(o => o.text.trim())
                .map((option, idx) => ({
                    id: idx,
                    text: option.text,
                    votes: []
                }));

            await addDoc(collection(db, 'community_messages'), {
                question: pollQuestion,
                options: optionsData,
                channelId,
                userId: user?.uid,
                displayName: user?.displayName || 'Admin',
                createdAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
                type: 'poll'
            });

            setIsCreatingPoll(false);
            setPollQuestion('');
            setPollOptions([
                { id: crypto.randomUUID(), text: '' },
                { id: crypto.randomUUID(), text: '' }
            ]);
            toast.success("Poll created");
        } catch (e) {
            console.error(e);
            toast.error("Failed to create poll");
        }
    };

    const [pollToDeleteId, setPollToDeleteId] = useState<string | null>(null);

    const handleDeleteMessage = (id: string) => {
        setPollToDeleteId(id);
    };

    const handleConfirmDeletePoll = async () => {
        if (!pollToDeleteId) return;
        const idToDelete = pollToDeleteId;
        setPollToDeleteId(null);
        await deleteDoc(doc(db, 'community_messages', idToDelete));
    };



    const handleReply = (msg: any) => {
        setReplyingTo(msg);
        textInputRef.current?.focus();
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setNewMessage(prev => prev + emojiData.emoji);
        // Don't close picker immediately
    };

    const channelNames: Record<string, string> = {
        'general': 'General',
        'help': 'Help & Support',
        'announcements': 'Announcements',
        'polls': 'Polls'
    };

    const isReadOnly = (channelId === 'announcements' && !isAdmin) || (channelId === 'polls' && !isAdmin);
    const isPollChannel = channelId === 'polls';

    // Handler for poll option changes - extracted to reduce nesting
    const handlePollOptionChange = (idx: number, value: string) => {
        const newOpts = [...pollOptions];
        newOpts[idx] = { ...newOpts[idx], text: value };
        setPollOptions(newOpts);
    };

    // Handler for removing poll option - extracted to reduce nesting
    const handleRemovePollOption = (idx: number) => {
        setPollOptions(pollOptions.filter((_, i) => i !== idx));
    };

    // Handler for textarea auto-resize - extracted to reduce nesting
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewMessage(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    // Handler for Ctrl+Enter submission - extracted to reduce nesting
    const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Render the appropriate input area based on channel type and permissions
    const renderInputArea = () => {
        if (isReadOnly) {
            return (
                <div style={{ textAlign: 'center', color: '#666', padding: '10px', fontStyle: 'italic' }}>
                    Only admins can post in this channel.
                </div>
            );
        }

        // Poll channel with admin privileges
        if (isPollChannel && isAdmin) {
            if (isCreatingPoll) {
                return (
                    <div className="poll-creator">
                        <h4 style={{ marginBottom: '10px', color: '#ccc' }}>Create New Poll</h4>
                        <input
                            className="poll-input"
                            placeholder="Ask a question..."
                            value={pollQuestion}
                            onChange={e => setPollQuestion(e.target.value)}
                        />
                        {pollOptions.map((opt) => (
                            <div key={opt.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <input
                                    className="poll-input"
                                    placeholder={`Option ${pollOptions.indexOf(opt) + 1}`}
                                    value={opt.text}
                                    onChange={e => handlePollOptionChange(pollOptions.indexOf(opt), e.target.value)}
                                    style={{ marginBottom: 0 }}
                                />
                                {pollOptions.length > 2 && (
                                    <button onClick={() => handleRemovePollOption(pollOptions.indexOf(opt))} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={() => setPollOptions([...pollOptions, { id: crypto.randomUUID(), text: '' }])}
                            style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <Plus size={14} /> Add Option
                        </button>

                        <div className="poll-creator-footer">
                            <button className="btn-secondary" onClick={() => setIsCreatingPoll(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleCreatePoll}>Post Poll</button>
                        </div>
                    </div>
                );
            }

            return (
                <button
                    onClick={() => setIsCreatingPoll(true)}
                    style={{ width: '100%', padding: '12px', background: '#252526', border: '1px dashed #444', color: '#aaa', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    <Plus size={18} /> Create New Poll
                </button>
            );
        }

        // Regular message form
        return (
            <form
                onSubmit={handleSendMessage}
                style={{
                    display: 'flex',
                    backgroundColor: '#1e1e1e',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    alignItems: 'center',
                    border: '1px solid #333',
                    position: 'relative' // Needed for absolute positioning of reply bar
                }}
            >
                {replyingTo && (
                    <div className="reply-preview-bar" style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        right: 0,
                        background: '#252526',
                        padding: '8px 12px',
                        borderTop: '1px solid #333',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.9rem',
                        color: '#ccc'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CornerUpLeft size={16} color="#aaa" />
                            <span>Replying to <b>{replyingTo.displayName}</b></span>
                        </div>
                        <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>
                            <X size={16} />
                        </button>
                    </div>
                )}

                <textarea
                    ref={textInputRef}
                    value={newMessage}
                    onChange={handleTextareaChange}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder={`Message #${channelNames[channelId] || 'channel'} (Ctrl+Enter to send)`}
                    disabled={isUploading}
                    rows={1}
                    style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        padding: '8px 12px',
                        outline: 'none',
                        fontSize: '15px',
                        resize: 'none',
                        lineHeight: '1.4',
                        maxHeight: '200px',
                        overflowY: 'auto'
                    }}
                />

                <div style={{ position: 'relative' }} ref={emojiPickerRef}>
                    {showEmojiPicker && (
                        <div style={{
                            position: 'absolute',
                            bottom: '40px', // Push it up a bit more to clear the input
                            right: '-10px',
                            zIndex: 1000,
                            marginBottom: '10px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}>
                            <EmojiPicker
                                onEmojiClick={onEmojiClick}
                                theme={Theme.DARK}
                                emojiStyle={EmojiStyle.NATIVE}
                                width={300}
                                height={400}
                                lazyLoadEmojis={true}
                                skinTonesDisabled={true}
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        style={{ background: 'none', border: 'none', color: showEmojiPicker ? '#4a9eff' : '#888', cursor: 'pointer', padding: '4px', marginRight: '4px' }}
                    >
                        <Smile size={20} />
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={(!newMessage && !imageFile) || isUploading}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: (!newMessage && !imageFile) ? '#444' : '#4a9eff',
                        cursor: (!newMessage && !imageFile) ? 'default' : 'pointer',
                        padding: '4px'
                    }}
                >
                    {isUploading ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
                </button>
            </form>
        );
    };

    // Helper to get date label for messages - extracted to reduce nesting
    const getDateLabel = (timestamp: any) => {
        if (!timestamp) return 'Today'; // Assume fresh message
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        }
    };

    return (
        <div className="community-main">
            <div className="community-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}># {channelNames[channelId] || channelId}</span>
                    <span style={{ marginLeft: '12px', fontSize: '0.8rem', opacity: 0.5 }}>
                        {isPollChannel ? 'Active Community Polls' : 'Messages expire after 7 days'}
                    </span>
                </div>

                {/* Search Bar */}
                <div className="community-search" style={{ display: 'flex', alignItems: 'center', background: '#252526', borderRadius: '4px', padding: '4px 8px', border: '1px solid #333' }}>
                    <Search size={16} color="#888" />
                    <input
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', marginLeft: '8px', outline: 'none', width: '150px', fontSize: '13px' }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0, display: 'flex' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="message-feed">
                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                        <Loader2 className="spin" size={24} />
                    </div>
                )}

                {error && (
                    <div style={{ color: '#ef4444', textAlign: 'center', padding: '20px' }}>
                        Error loading messages: {error.message} <br />
                        {JSON.stringify(error)}
                    </div>
                )}

                {/* Load More Button */}
                {hasMore && !loading && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}>
                        <button
                            onClick={loadMore}
                            style={{ background: '#252526', border: '1px solid #333', color: '#aaa', padding: '4px 12px', borderRadius: '12px', cursor: 'pointer', fontSize: '12px' }}
                        >
                            Load previous messages
                        </button>
                    </div>
                )}

                {!loading && visibleMessages.length === 0 && (
                    <div className="empty-state">
                        <h3>{searchQuery ? 'No results found' : 'No posts yet'}</h3>
                        <p>{searchQuery ? 'Try a different search term' : `Be the first to post in #${channelNames[channelId]}!`}</p>
                    </div>
                )}

                {visibleMessages.map((msg, index) => {
                    const prevMsg = index > 0 ? visibleMessages[index - 1] : null;
                    const currentDateLabel = getDateLabel(msg.createdAt);
                    const prevDateLabel = prevMsg ? getDateLabel(prevMsg.createdAt) : null;
                    const showDateSeparator = currentDateLabel !== prevDateLabel;

                    return (
                        <React.Fragment key={msg.id}>
                            {showDateSeparator && (
                                <div className="date-separator">
                                    <span>{currentDateLabel}</span>
                                </div>
                            )}
                            {msg.type === 'poll' ? (
                                <PollItem key={msg.id} message={msg} currentUser={user} isAdmin={isAdmin} onDelete={handleDeleteMessage} />
                            ) : (
                                <MessageItem
                                    key={msg.id}
                                    message={msg}
                                    currentUser={user}
                                    onReply={handleReply}
                                />
                            )}
                        </React.Fragment>
                    );
                })}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="message-input-area">
                {renderInputArea()}
            </div>
            <ConfirmDialog
                isOpen={!!pollToDeleteId}
                title="Delete Poll"
                message="Are you sure you want to delete this poll? This action cannot be undone."
                onConfirm={handleConfirmDeletePoll}
                onCancel={() => setPollToDeleteId(null)}
                isDangerous={true}
                confirmText="Delete Poll"
            />
        </div >
    );
};

export default ChatArea;
