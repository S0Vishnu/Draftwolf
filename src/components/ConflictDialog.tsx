
import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../styles/ConfirmDialog.css'; // Reusing styles if possible, but I'll create a dedicated one if needed.
// Actually, I'll use the same structure as ConfirmDialog.

interface ConflictDialogProps {
    isOpen: boolean;
    itemName: string;
    onReplace: () => void;
    onSkip: () => void;
    onCancel: () => void;
}

const ConflictDialog: React.FC<ConflictDialogProps> = ({
    isOpen, itemName, onReplace, onSkip, onCancel
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()} ref={dialogRef}>
                <h3 className="modal-title">Item Already Exists</h3>
                <p className="modal-message">
                    An item named <strong>{itemName}</strong> already exists in this location. What would you like to do?
                </p>
                <div className="modal-actions">
                    <button className="modal-btn secondary" onClick={onCancel}>Cancel</button>
                    <button className="modal-btn secondary" onClick={onSkip}>Skip</button>
                    <button className="modal-btn primary" onClick={onReplace}>Replace</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConflictDialog;
