import React from 'react';
import { Download, Rocket, X, RefreshCw } from 'lucide-react';
import '../styles/UpdateModal.css';

interface UpdateModalProps {
    isOpen: boolean;
    version: string;
    onUpdate: () => void;
    onIgnore: () => void;
    onRestart: () => void;
    status: 'available' | 'downloading' | 'ready';
    progress: number;
}

const UpdateModal: React.FC<UpdateModalProps> = ({
    isOpen,
    version,
    onUpdate,
    onIgnore,
    onRestart,
    status,
    progress
}) => {
    if (!isOpen) return null;

    return (
        <div className="update-modal-overlay">
            <div className="update-modal">
                <div style={{ marginBottom: '1rem' }}>
                    {status === 'ready' ? (
                        <Rocket size={48} className="text-purple-500" style={{ color: '#8b5cf6' }} />
                    ) : (
                        <Download size={48} className="text-blue-500" style={{ color: '#3b82f6' }} />
                    )}
                </div>

                <h2>
                    {status === 'ready'
                        ? 'Update Ready!'
                        : status === 'downloading'
                            ? 'Downloading Update...'
                            : 'Update Available'}
                </h2>

                <p>
                    {status === 'ready'
                        ? 'The new version is downloaded and ready to install.'
                        : status === 'downloading'
                            ? 'Please wait while we download the latest version.'
                            : `Version ${version} is available. Would you like to update now?`}
                </p>

                {status === 'downloading' ? (
                    <div className="progress-container">
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="progress-text">{Math.round(progress)}% loaded</div>
                    </div>
                ) : (
                    <div className="update-modal-actions">
                        {status === 'available' ? (
                            <>
                                <button onClick={onIgnore} className="btn-update-ignore">
                                    Ignore
                                </button>
                                <button onClick={onUpdate} className="btn-update-primary">
                                    Update Now
                                </button>
                            </>
                        ) : (
                            // Ready state
                            <>
                                <button onClick={onIgnore} className="btn-update-ignore">
                                    Later
                                </button>
                                <button onClick={onRestart} className="btn-update-primary">
                                    Restart & Install
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpdateModal;
