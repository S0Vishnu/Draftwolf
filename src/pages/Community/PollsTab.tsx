import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Profile } from './index';
import { toast } from 'react-toastify';
import { formatDistanceToNow } from 'date-fns';
import { BarChart2, Check, Plus, Sparkles } from 'lucide-react';

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
        if (!currentUser?.id) {
            toast.error('You must be logged in to create a poll');
            return;
        }

        const { data: pollData, error: pollError } = await supabase
            .from('polls')
            .insert({ question: newQuestion, created_by: currentUser.id })
            .select()
            .single();

        if (pollError) {
            toast.error(pollError.message || 'Failed to create poll');
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

    const handleVote = async (poll: Poll, optionId: string) => {
        if (!currentUser) return;

        const previousPolls = JSON.parse(JSON.stringify(polls)) as Poll[];

        // Optimistic update: apply vote in UI immediately
        setPolls((current) =>
            current.map((p) => {
                if (p.id !== poll.id) return p;
                const votesWithoutMine = (p.votes ?? []).filter((v) => v.user_id !== currentUser.id);
                const newVote = { option_id: optionId, user_id: currentUser.id };
                return { ...p, votes: [...votesWithoutMine, newVote] };
            })
        );

        // Sync with backend afterwards
        const optionIds = poll.options?.map((o) => o.id) ?? [];
        if (optionIds.length > 0) {
            await supabase
                .from('poll_votes')
                .delete()
                .eq('user_id', currentUser.id)
                .in('option_id', optionIds);
        }

        const { error } = await supabase.from('poll_votes').insert({
            option_id: optionId,
            user_id: currentUser.id
        });

        if (error) {
            setPolls(previousPolls);
            if (error.code === '23505') {
                toast.info("You've already voted for this option.");
            } else {
                toast.error(error.message || 'Vote failed');
            }
        }
    };

    return (
        <div className="poll-page-wrap">

            {polls.length === 0 && (
                <div className="community-empty-state community-empty-state-polls">
                    <div className="community-empty-state-icon-wrap community-empty-state-icon-polls">
                        <BarChart2 size={48} strokeWidth={1.5} />
                    </div>
                    <h3 className="community-empty-state-title">No polls yet</h3>
                    <p className="community-empty-state-text">
                        {currentUser?.is_admin
                            ? 'Create the first poll to get community feedback.'
                            : 'There are no active polls. Check back later!'}
                    </p>
                </div>
            )}

            {/* Render Polls */}
            {polls.length > 0 && polls.map(poll => {
                const totalVotes = poll.votes?.length || 0;

                return (
                    <article key={poll.id} className="poll-card">
                        <h3 className="poll-question">{poll.question}</h3>
                        <p className="poll-meta">
                            Asked by <strong>{poll.profiles?.username ?? 'Unknown'}</strong>
                            <span>·</span>
                            {formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}
                        </p>

                        <div className="poll-options">
                            {poll.options?.map(option => {
                                const optionVotes = poll.votes?.filter(v => v.option_id === option.id).length || 0;
                                const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                                const hasVoted = poll.votes?.some(v => v.option_id === option.id && v.user_id === currentUser?.id);

                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => handleVote(poll, option.id)}
                                        className={`poll-option-btn ${hasVoted ? 'voted' : ''}`}
                                    >
                                        <div
                                            className="poll-option-fill"
                                            style={{ width: `${percentage}%` }}
                                            aria-hidden
                                        />
                                        <span className="option-label">
                                            {hasVoted && <Check size={18} strokeWidth={2.5} className="poll-option-check" />}
                                            {option.option_text}
                                        </span>
                                        <span className="option-stats">{percentage}% ({optionVotes})</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="poll-total">
                            <span className="poll-total-dot" aria-hidden />
                            {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
                        </div>
                    </article>
                );
            })}

            {/* Create New Poll (Admin) - at bottom */}
            {currentUser?.is_admin && (
                <section className="poll-create-card">
                    <h3 className="poll-create-title">
                        <span className="poll-create-title-icon">
                            <Sparkles size={20} strokeWidth={2} />
                        </span>
                        Create New Poll
                    </h3>
                    <input
                        type="text"
                        placeholder="What do you want to ask?"
                        value={newQuestion}
                        onChange={e => setNewQuestion(e.target.value)}
                        className="poll-create-input"
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
                            className="poll-create-input"
                        />
                    ))}
                    <button
                        type="button"
                        onClick={() => setNewOptions([...newOptions, ''])}
                        className="poll-add-option"
                    >
                        <Plus size={16} strokeWidth={2.5} />
                        Add option
                    </button>

                    <button
                        type="button"
                        onClick={handleCreatePoll}
                        className="poll-create-submit"
                    >
                        Create poll
                    </button>
                </section>
            )}
        </div>
    );
};

export default PollsTab;
