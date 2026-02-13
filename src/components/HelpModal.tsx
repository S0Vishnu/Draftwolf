import React, { useRef, useEffect, useState } from 'react';
import { X, Heart, Coffee, ExternalLinkIcon, Search, ListTodo, Brush, Puzzle, BookOpen, RotateCcw } from 'lucide-react';
import logo from '../assets/logo_full.svg';
import '../styles/HelpModal.css';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const [appVersion, setAppVersion] = useState("1.1.8");

    useEffect(() => {
        if ((window as any).api && (window as any).api.getAppVersion) {
            (window as any).api.getAppVersion().then((v: string) => setAppVersion(v));
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleOpenLink = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
        e.preventDefault();
        if ((window as any).api && (window as any).api.openExternal) {
            (window as any).api.openExternal(url);
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="help-modal-overlay" onClick={onClose}>
            <div className="help-modal-dialog" onClick={e => e.stopPropagation()} ref={dialogRef}>
                <div className="help-modal-header">
                    <h2 className="help-modal-title">About Draftwolf</h2>
                    <button className="help-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="help-modal-content">
                    <div className="help-section intro">
                        <div className="app-logo">
                            <img src={logo} alt="Draftwolf Logo" className="logo-image" />
                        </div>
                        <p className="version">Version {appVersion}</p>
                        <p className="about-tagline">Local version control for your files, no git required. Organize drafts, versions, and metadata in one place.</p>
                    </div>

                    <div className="help-section features">
                        <div className="feature-list">
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <Search size={18} strokeWidth={2} />
                                </div>
                                <div className="feature-info">
                                    <h5>Inspector Panel</h5>
                                    <p>View properties, manage tasks, and handle version history for any selected file.</p>
                                </div>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <ListTodo size={18} strokeWidth={2} />
                                </div>
                                <div className="feature-info">
                                    <h5>Tasks & Metadata</h5>
                                    <p>Attach to-dos and reference images directly to specific files so you never lose context.</p>
                                </div>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <Brush size={18} strokeWidth={2} />
                                </div>
                                <div className="feature-info">
                                    <h5>Cleanup</h5>
                                    <p>Merge or archive old versions and keep your workspace tidy without losing history.</p>
                                </div>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <Puzzle size={18} strokeWidth={2} />
                                </div>
                                <div className="feature-info">
                                    <h5>Extensions</h5>
                                    <p>Connect Blender and other tools via plugins to integrate Draftwolf into your pipeline.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="help-section version-control">
                        <h4>Version Control</h4>
                        <div className="guide-steps">
                            <div className="step">
                                <span className="step-num">1</span>
                                <p>Select a file and open the <strong>Inspector Panel</strong> on the right.</p>
                            </div>
                            <div className="step">
                                <span className="step-num">2</span>
                                <p>Click the <strong>Versions</strong> tab <span className="icon-inline"><BookOpen size={12} /></span>.</p>
                            </div>
                            <div className="step">
                                <span className="step-num">3</span>
                                <p>Click <strong>+ New Version</strong>, give it a label, and hit Commit.</p>
                            </div>
                            <div className="step">
                                <span className="step-num">4</span>
                                <p>Use the <strong>Restore</strong> <span className="icon-inline"><RotateCcw size={12} /></span> button to revert changes anytime.</p>
                            </div>
                        </div>
                    </div>

                    <div className="help-section shortcuts">
                        <h4>Keyboard Shortcuts</h4>
                        <div className="shortcut-grid">
                            <div className="shortcut-item">
                                <span className="key-combo"><kbd>Ctrl</kbd> + <kbd>S</kbd></span>
                                <span className="action">Save File</span>
                            </div>
                            <div className="shortcut-item">
                                <span className="key-combo"><kbd>Ctrl</kbd> + <kbd>P</kbd></span>
                                <span className="action">Quick Open</span>
                            </div>
                            <div className="shortcut-item">
                                <span className="key-combo"><kbd>Ctrl</kbd> + <kbd>F</kbd></span>
                                <span className="action">Find</span>
                            </div>
                            <div className="shortcut-item">
                                <span className="key-combo"><kbd>esc</kbd></span>
                                <span className="action">Close Modals</span>
                            </div>
                        </div>
                    </div>

                    <div className="help-section credits">
                        <h4>Credits</h4>
                        <p className="help-modal-footer">
                            <a className="footer-link" href="https://github.com/S0Vishnu/Draftwolf/issues" onClick={(e) => handleOpenLink(e, "https://github.com/S0Vishnu/Draftwolf/issues")}>For Issues & Feedback <ExternalLinkIcon size={12} /></a>
                        </p>
                        <span className="with-love">Made with <Heart size={14} className="heart-icon" /> for builders</span>
                    </div>
                </div>

                <div className="help-modal-footer-container">
                    <div className="help-modal-footer">
                        <a href="https://www.buymeacoffee.com/s0vishnu" onClick={(e) => handleOpenLink(e, "https://www.buymeacoffee.com/s0vishnu")} className="footer-link">
                            <Coffee size={16} /> Buy me a coffee
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
