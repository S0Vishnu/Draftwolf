import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../styles/CustomPopup.css';

interface CustomPopupProps {
    isOpen: boolean;
    title: string;
    message?: string;
    icon?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    isDangerous?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    children?: React.ReactNode;
}

const CustomPopup: React.FC<CustomPopupProps> = ({
    isOpen, title, message, icon, confirmText = "Confirm", cancelText = "Cancel",
    isDangerous = false, onConfirm, onCancel, children
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onCancel();
        };
        globalThis.addEventListener('keydown', handleKeyDown);
        return () => globalThis.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return createPortal(
        <div className="custom-popup-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onCancel} onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
            <div className="custom-popup-dialog" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} ref={dialogRef}>
                {icon && <div className="custom-popup-icon">{icon}</div>}
                <h3 className="custom-popup-title">{title}</h3>
                {message && <p className="custom-popup-message">{message}</p>}
                {children && <div className="custom-popup-body">{children}</div>}
                <div className="custom-popup-actions">
                    <button className="custom-popup-btn secondary" onClick={onCancel}>{cancelText}</button>
                    <button
                        className={`custom-popup-btn ${isDangerous ? 'danger' : 'primary'}`}
                        onClick={onConfirm}
                        autoFocus
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CustomPopup;
