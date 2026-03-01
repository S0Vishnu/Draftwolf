import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Profile } from './index';
import { toast } from 'react-toastify';
import { formatDistanceToNow } from 'date-fns';

interface PollOption {
    id: string;
    poll_id: string;
    option_text: string;
}

interface Poll {
    id: string;
    question: string;
    created_by: string;
    created_at: string;
    profiles: Profile;
    options?: PollOption[];
    votes?: any[]; // Array of vote objects
}

interface PollsTabProps {
    currentUser: Profile | null;
}

const PollsTab: React.FC<PollsTabProps> = ({ currentUser }) => {
    const [polls, setPolls] = useState<Poll[]>([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [newOptions, setNewOptions] = useState<string[]>(['', '']);

    useEffect(() => {
        fetchPolls();

        const sub = supabase.channel('public:polls')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchPolls())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchPolls())
            .subscribe();

        return () => { supabase.removeChannel(sub); };
    }, []);

    const fetchPolls = async () => {
        const { data: pollsData, error: pollsError } = await supabase
            .from('polls')
            .select(`*, profiles(username, avatar_url, is_admin)`)
            .order('created_at', { ascending: false });

        if (pollsError) {
            console.error(pollsError);
            return;
        }

        const { data: optionsData } = await supabase.from('poll_options').select('*');
        const { data: votesData } = await supabase.from('poll_votes').select('*');

        const mappedPolls = pollsData.map(p => ({
            ...p,
            options: optionsData?.filter(o => o.poll_id === p.id) || [],
            votes: votesData?.filter(v => optionsData?.find(o => o.id === v.option_id && o.poll_id === p.id)) || []
        }));

        setPolls(mappedPolls as Poll[]);
    };

    const handleCreatePoll = async () => {
        if (!newQuestion.trim() || newOptions.filter(o => o.trim()).length < 2) {
            toast.error('Question and at least 2 options are required');
            return;
        }

        const { data: pollData, error: pollError } = await supabase
            .from('polls')
            .insert({ question: newQuestion, created_by: currentUser?.id })
            .select()
            .single();

        if (pollError) {
            toast.error('Failed to create poll');
            return;
        }

        const optionsToInsert = newOptions.filter(o => o.trim()).map(o => ({
            poll_id: pollData.id,
            option_text: o.trim()
        }));

        await supabase.from('poll_options').insert(optionsToInsert);

        toast.success('Poll created');
        setNewQuestion('');
        setNewOptions(['', '']);
        fetchPolls(); // Refresh immediately
    };

    const handleVote = async (optionId: string) => {
        if (!currentUser) return;

        // Check if user already voted on this poll broadly (requires checking context of option to poll)
        // Simplified: optimistic insert, rely on DB constraints or just let them switch votes if DB allows.
        const { error } = await supabase.from('poll_votes').insert({
            option_id: optionId,
            user_id: currentUser.id
        });

        if (error) {
            toast.error('Vote failed: ' + error.message);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', padding: '16px' }}>

            {currentUser?.is_admin && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px' }}>
                    <h3 style={{ marginTop: 0, color: 'white' }}>Create New Poll (Admin)</h3>
                    <input
                        type="text"
                        placeholder="Poll Question"
                        value={newQuestion}
                        onChange={e => setNewQuestion(e.target.value)}
                        style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', marginBottom: '12px' }}
                    />
                    {newOptions.map((opt, i) => (
                        <input
                            key={i}
                            type="text"
                            placeholder={`Option ${i + 1}`}
                            value={opt}
                            onChange={e => {
                                const updated = [...newOptions];
                                updated[i] = e.target.value;
                                setNewOptions(updated);
                            }}
                            style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '6px', marginBottom: '8px' }}
                        />
                    ))}
                    <button
                        onClick={() => setNewOptions([...newOptions, ''])}
                        style={{ background: 'none', color: '#3b82f6', border: 'none', cursor: 'pointer', padding: '8px' }}
                    >
                        + Add Option
                    </button>

                    <button
                        onClick={handleCreatePoll}
                        style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', marginTop: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Create Poll
                    </button>
                </div>
            )}

            {/* Render Polls */}
            {polls.map(poll => {
                const totalVotes = poll.votes?.length || 0;

                return (
                    <div key={poll.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>{poll.question}</h3>
                            <span style={{ fontSize: '12px', color: 'gray' }}>
                                Asked by {poll.profiles.username} • {formatDistanceToNow(new Date(poll.created_at))} ago
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {poll.options?.map(option => {
                                const optionVotes = poll.votes?.filter(v => v.option_id === option.id).length || 0;
                                const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                                const hasVoted = poll.votes?.some(v => v.option_id === option.id && v.user_id === currentUser?.id);

                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => handleVote(option.id)}
                                        style={{
                                            position: 'relative', overflow: 'hidden', padding: '12px 16px',
                                            background: hasVoted ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                                            border: hasVoted ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '8px', color: 'white', cursor: 'pointer',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}
                                    >
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${percentage}%`, background: 'rgba(59, 130, 246, 0.1)', zIndex: 0 }} />
                                        <span style={{ zIndex: 1 }}>{option.option_text}</span>
                                        <span style={{ zIndex: 1, fontSize: '14px', color: 'gray' }}>{percentage}% ({optionVotes})</span>
                                    </button>
                                )
                            })}
                        </div>
                        <div style={{ marginTop: '12px', fontSize: '12px', color: 'gray', textAlign: 'right' }}>
                            {totalVotes} total votes
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default PollsTab;
