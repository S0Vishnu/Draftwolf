import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase';
import { Profile } from './index';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Send, Smile, X } from 'lucide-react';
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
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMessages();

        const subscription = supabase
            .channel(`public:community_messages:${channel}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages', filter: `channel=eq.${channel}` }, payload => {
                // Simple reload to fetch joins properly (could be optimized)
                fetchMessages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [channel]);

    const fetchMessages = async () => {
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
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages', error);
        } else {
            // Small logic to fetch reply messages content (can be done with a map/reduce or a second query)
            const msgs = data as any[];

            // Let's populate reply_message if reply_to is present
            const enhancedMsgs = msgs.map(m => {
                if (m.reply_to) {
                    const repMsg = msgs.find(cm => cm.id === m.reply_to);
                    return { ...m, reply_message: repMsg };
                }
                return m;
            });

            setMessages(enhancedMsgs);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
        }
    };

    const onEmojiClick = (emojiObject: any) => {
        setNewMessage(prev => prev + emojiObject.emoji);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#313338' }}>
            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {messages.map(msg => (
                    <MessageItem
                        key={msg.id}
                        message={msg}
                        currentUser={currentUser}
                        onReply={() => setReplyingTo(msg)}
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '0 16px 24px 16px', backgroundColor: '#313338', flexShrink: 0 }}>
                {replyingTo && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: '#2b2d31', padding: '8px 12px', borderRadius: '8px 8px 0 0',
                        fontSize: '12px', color: '#b5bac1', borderBottom: '1px solid #1e1f22'
                    }}>
                        <div>Replying to <strong style={{ color: '#f2f3f5' }}>@{replyingTo.profiles.username}</strong></div>
                        <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                )}

                {imageFile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px' }}>
                        <span style={{ color: '#4ade80' }}>Image ready: {imageFile.name}</span>
                        <button onClick={() => setImageFile(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', position: 'relative' }}>
                    {showEmojiPicker && (
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 10, marginBottom: '10px' }}>
                            <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} />
                        </div>
                    )}

                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center',
                        backgroundColor: '#383a40', /* Discord input box color */
                        borderRadius: replyingTo ? '0 0 8px 8px' : '8px',
                        padding: '0 16px'
                    }}>
                        <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files?.[0]) setImageFile(e.target.files[0]);
                            }}
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="image-upload" className="chat-action-btn" aria-label="Upload image" style={{ color: '#b5bac1', padding: '10px 10px 10px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M13 11.5A2.5 2.5 0 0 1 10.5 14A2.5 2.5 0 0 1 8 11.5A2.5 2.5 0 0 1 10.5 9A2.5 2.5 0 0 1 13 11.5M4 18V6A2 2 0 0 1 6 4H18A2 2 0 0 1 20 6V18A2 2 0 0 1 18 20H6A2 2 0 0 1 4 18M18 18V14L14.5 9.5L10 15L8 12.5L6 15.5V18H18Z" /></svg>
                        </label>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage() }}
                            placeholder={`Message #${channel}`}
                            style={{
                                flex: 1, background: 'none', border: 'none', color: '#dbdee1', padding: '14px 0',
                                outline: 'none', fontSize: '15px'
                            }}
                        />
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            style={{ background: 'none', border: 'none', color: '#b5bac1', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <Smile size={24} />
                        </button>
                        <button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() && !imageFile}
                            style={{
                                background: 'none', border: 'none',
                                color: (newMessage.trim() || imageFile) ? '#5865f2' : '#b5bac1', /* Discord blurple if active */
                                padding: '10px', cursor: (newMessage.trim() || imageFile) ? 'pointer' : 'default',
                                display: 'flex', alignItems: 'center', transition: 'color 0.2s',
                                opacity: (newMessage.trim() || imageFile) ? 1 : 0.5
                            }}
                        >
                            <Send size={20} style={{ transform: 'rotate(45deg)', marginTop: '-4px' }} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatTab;
