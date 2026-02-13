
import React, { useState, useEffect } from 'react';
import { X, GitCommit } from 'lucide-react';

import { AIService, ChangeInfo, CommitProposal } from '../services/AIService';
import '../styles/AICommitModal.css'; // Add styling later? Or inline for now.

interface AICommitModalProps {
    isOpen: boolean;
    onClose: () => void;
    changes: ChangeInfo[];
    onCommit: (proposal: CommitProposal) => void;
}

const AICommitModal: React.FC<AICommitModalProps> = ({ isOpen, onClose, changes, onCommit }) => {
    const [loading, setLoading] = useState(true);
    const [proposals, setProposals] = useState<CommitProposal[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && changes.length > 0) {
            setLoading(true);
            AIService.generateProposal(changes)
                .then(setProposals)
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        }
    }, [isOpen, changes]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: '#1E1E1E', width: 500, borderRadius: 8, padding: 20,
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid #333'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>🤖</span> AI Change Analysis
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                        <div className="spinner" style={{ marginBottom: 10 }}>Analyzing changes...</div>
                        <small>Generating smart commit messages</small>
                    </div>
                ) : error ? (
                    <div style={{ color: '#ff5555', padding: 20, textAlign: 'center' }}>
                        Failed to analyze: {error}
                    </div>
                ) : (
                    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <div style={{ marginBottom: 15, color: '#aaa', fontSize: 14 }}>
                            Proposed Version Groups:
                        </div>

                        {proposals.map((prop, idx) => (
                            <div key={idx} style={{
                                backgroundColor: '#252526', padding: 15, borderRadius: 6, marginBottom: 12,
                                border: '1px solid #333'
                            }}>
                                <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: 8, fontSize: 16 }}>
                                    {prop.message}
                                </div>
                                <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
                                    {prop.description}
                                </div>

                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 15 }}>
                                    {prop.files.map(f => (
                                        <span key={f} style={{
                                            backgroundColor: '#333', color: '#ccc', padding: '2px 8px', borderRadius: 4, fontSize: 12
                                        }}>
                                            {f}
                                        </span>
                                    ))}
                                </div>

                                <button
                                    onClick={() => onCommit(prop)}
                                    style={{
                                        width: '100%', padding: '8px 12px', backgroundColor: '#37373d', color: '#fff',
                                        border: '1px solid #444', borderRadius: 4, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        fontSize: 14, fontWeight: 500
                                    }}
                                >
                                    <GitCommit size={14} />
                                    Use This Proposal
                                </button>
                            </div>
                        ))}

                        {proposals.length === 0 && (
                            <div style={{ padding: 20, color: '#aaa', textAlign: 'center' }}>
                                No clear groupings found.
                            </div>
                        )}
                    </div>
                )}

                <div style={{ marginTop: 20, paddingTop: 15, borderTop: '1px solid #333', textAlign: 'right' }}>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13 }}
                    >
                        Skip AI Proposals
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AICommitModal;
