import React from 'react';
import '../styles/UpdateModal.css';

interface UpdateModalProps {
    isOpen: boolean;
    version: string;
    onIgnore: () => void;
    onRestart: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({
    isOpen,
    version,
    onIgnore,
    onRestart
}) => {
    if (!isOpen) return null;

    return (
        <div className="update-modal-overlay">
            <div className="update-modal">
                <div className="update-modal-body">
                    <span className="update-modal-title">Update ready</span>
                    <span className="update-modal-text">Restart to install v{version}?</span>
                </div>
                <div className="update-modal-actions">
                    <button type="button" onClick={onIgnore} className="btn-update-ignore">Later</button>
                    <button type="button" onClick={onRestart} className="btn-update-primary">Restart</button>
                </div>
            </div>
        </div>
    );
};

export default UpdateModal;
