import React from 'react';
import { Power, Wifi, HelpCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import './Footer.css';

interface FooterProps {
    onShutDown?: () => void;
}

const Footer: React.FC<FooterProps> = ({ onShutDown }) => {
    const [isOnline, setIsOnline] = React.useState(navigator.onLine);

    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <footer className="app-footer">
            <div className="footer-left">
                <button className="footer-item" title="Shut Down" onClick={onShutDown}><Power size={14} /></button>
                <div className="footer-divider"></div>
                <button className="footer-item" title={isOnline ? "Online" : "Offline"}>
                    <Wifi size={14} color={isOnline ? "#41D56A" : "#F64141"} />
                </button>
            </div>

            <div className="footer-right">
                <button className="footer-item" title="Help"><HelpCircle size={14} /></button>
                <div className="footer-message-box">
                    Task details fetched
                </div>
                <div className="footer-status-group">
                    <div className="status-item" title="Errors">
                        <XCircle size={14} className="status-icon error" />
                        <span>(0)</span>
                    </div>
                    <div className="status-item" title="Warnings">
                        <AlertTriangle size={14} className="status-icon warning" />
                        <span>(0)</span>
                    </div>
                    <div className="status-item" title="Info">
                        <Info size={14} className="status-icon info" />
                        <span>(12)</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
