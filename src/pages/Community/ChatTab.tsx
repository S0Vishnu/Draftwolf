import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase';
import { Profile } from './index';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Send, Smile, X, MessageCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import MessageItem from './MessageItem';

export interface Message {
    id: string;
    channel: string;
    user_id: string;
    content: string;
    image_url: string | null;
    reply_to: string | null;
    tags: string[];
    created_at: string;
    profiles: Profile;
    reply_message?: Message;
}

interface ChatTabProps {
    channel: string;
    currentUser: Profile | null;
}

const ChatTab: React.FC<ChatTabProps> = ({ channel, currentUser }) => {
    const [messages, setMessages] = useState<Message[]>(() => {
        const cached = localStorage.getItem(`chat_messages_${channel}`);
        return cached ? JSON.parse(cached) : [];
    });
    const [newMessage, setNewMessage] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMessages(true);

        const pollInterval = setInterval(() => {
            fetchMessages(false);
        }, 5000);

        const subscription = supabase
            .channel(`public:community_messages:${channel}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `channel=eq.${channel}` }, async payload => {
                const newMsg = payload.new as Message;

                // Fetch the joined author profile since realtime just gives us user_id
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', newMsg.user_id).single();
                if (profile) newMsg.profiles = profile;

                if (newMsg.reply_to) {
                    const { data: repMsg } = await supabase.from('community_messages').select('*, profiles(*)').eq('id', newMsg.reply_to).single();
                    if (repMsg) newMsg.reply_message = repMsg as Message;
                }

                setMessages(prev => {
                    // Avoid duplicates if this client just sent the message and already fetched it
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    const newMessages = [...prev, newMsg];
                    localStorage.setItem(`chat_messages_${channel}`, JSON.stringify(newMessages.slice(-50)));
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                    return newMessages;
                });
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_messages', filter: `channel=eq.${channel}` }, payload => {
                setMessages(prev => {
                    const newMessages = prev.filter(m => m.id !== payload.old.id);
                    localStorage.setItem(`chat_messages_${channel}`, JSON.stringify(newMessages.slice(-50)));
                    return newMessages;
                });
            })
            .subscribe();

        return () => {
            clearInterval(pollInterval);
            supabase.removeChannel(subscription);
        };
    }, [channel]);

    const fetchMessages = async (isInitial = false) => {
        // We join rows with profiles to get user info
        // Assuming supabase supports this nested select out-of-the-box if foreign keys are set
        const { data, error } = await supabase
            .from('community_messages')
            .select(`
        *,
        profiles (
          id, username, avatar_url, is_admin
        )
      `)
            .eq('channel', channel)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Error fetching messages', error);
        } else {
            // Small logic to fetch reply messages content (can be done with a map/reduce or a second query)
            const msgs = data;

            // Let's populate reply_message if reply_to is present
            const enhancedMsgs = msgs.map(m => {
                if (m.reply_to) {
                    const repMsg = msgs.find(cm => cm.id === m.reply_to);
                    return { ...m, reply_message: repMsg as any };
                }
                return m;
            });

            const finalMsgs = [...enhancedMsgs].reverse(); // we fetched descending to get latest 50, now reverse to chronological
            setMessages(prev => {
                const hasNewMessages = finalMsgs.length > prev.length || (finalMsgs.length > 0 && prev.length > 0 && finalMsgs[finalMsgs.length - 1].id !== prev[prev.length - 1].id);
                if (isInitial || hasNewMessages) {
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                }
                return finalMsgs;
            });
            localStorage.setItem(`chat_messages_${channel}`, JSON.stringify(finalMsgs));
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() && !imageFile) return;
        if (!currentUser) {
            toast.error('You must be logged in to send messages.');
            return;
        }

        let imageUrl = null;
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${currentUser.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('community_images')
                .upload(filePath, imageFile);

            if (uploadError) {
                toast.error('Failed to upload image');
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('community_images')
                .getPublicUrl(filePath);
            imageUrl = publicUrl;
        }

        // Ensure profile exists in the database before sending message to prevent foreign key constraint violations
        const { error: profileError } = await supabase.from('profiles').upsert({
            id: currentUser.id,
            username: currentUser.username,
            avatar_url: currentUser.avatar_url,
            is_admin: currentUser.is_admin
        });

        if (profileError) {
            console.error("Failed to enforce user profile creation:", profileError);
            toast.error("Error verifying your user profile. Please try logging in again.");
            return;
        }

        const { error } = await supabase
            .from('community_messages')
            .insert({
                channel,
                content: newMessage.trim(),
                user_id: currentUser.id,
                image_url: imageUrl,
                reply_to: replyingTo?.id || null,
                tags: [] // Optional tags extract logic can go here
            });

        if (error) {
            toast.error('Failed to send message: ' + error.message);
        } else {
            setNewMessage('');
            setImageFile(null);
            setReplyingTo(null);
            setShowEmojiPicker(false);
            fetchMessages(true);
        }
    };

    const onEmojiClick = (emojiObject: any) => {
        setNewMessage(prev => prev + emojiObject.emoji);
    };

    return (
        <div className="discord-chat-container">
            {/* Messages Area */}
            <div className="discord-chat-messages-area">
                {messages.length === 0 ? (
                    <div className="community-empty-state">
                        <div className="community-empty-state-icon-wrap community-empty-state-icon-chat">
                            <MessageCircle size={48} strokeWidth={1.5} />
                        </div>
                        <h3 className="community-empty-state-title">No messages yet</h3>
                        <p className="community-empty-state-text">
                            Be the first to send a message in <strong>#{channel}</strong>
                        </p>
                    </div>
                ) : (
                    <>
                        {messages.map(msg => (
                            <MessageItem
                                key={msg.id}
                                message={msg}
                                currentUser={currentUser}
                                onReply={() => setReplyingTo(msg)}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="discord-chat-input-area">
                {replyingTo && (
                    <div className="discord-chat-replying-bar">
                        <div>Replying to <strong>@{replyingTo.profiles.username}</strong></div>
                        <button onClick={() => setReplyingTo(null)} className="discord-chat-close-btn"><X size={14} /></button>
                    </div>
                )}

                {imageFile && (
                    <div className="discord-chat-image-ready-bar">
                        <span className="discord-chat-image-ready-text">Image ready: {imageFile.name}</span>
                        <button onClick={() => setImageFile(null)} className="discord-chat-close-btn"><X size={14} /></button>
                    </div>
                )}

                <div className="discord-chat-input-wrapper">
                    {showEmojiPicker && (
                        <div className="discord-chat-emoji-picker-container">
                            <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} />
                        </div>
                    )}

                    <div className={`discord-chat-input-box ${replyingTo ? 'replying' : ''}`}>
                        <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files?.[0]) setImageFile(e.target.files[0]);
                            }}
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="image-upload" className="discord-chat-action-btn" aria-label="Upload image">
                            <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M13 11.5A2.5 2.5 0 0 1 10.5 14A2.5 2.5 0 0 1 8 11.5A2.5 2.5 0 0 1 10.5 9A2.5 2.5 0 0 1 13 11.5M4 18V6A2 2 0 0 1 6 4H18A2 2 0 0 1 20 6V18A2 2 0 0 1 18 20H6A2 2 0 0 1 4 18M18 18V14L14.5 9.5L10 15L8 12.5L6 15.5V18H18Z" /></svg>
                        </label>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage() }}
                            placeholder={`Message #${channel}`}
                            className="discord-chat-text-input"
                        />
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="discord-chat-emoji-btn"
                        >
                            <Smile size={24} />
                        </button>
                        <button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() && !imageFile}
                            className="discord-chat-send-btn"
                        >
                            <Send size={20} className="discord-chat-send-icon" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatTab;
