
import React from 'react';
import { UploadCloud } from 'lucide-react';
import '../styles/DragOverlay.css';

interface DragOverlayProps {
    isVisible: boolean;
}

const DragOverlay: React.FC<DragOverlayProps> = ({ isVisible }) => {
    if (!isVisible) return null;

    return (
        <div className="drag-overlay">
            <div className="drag-overlay-content">
                <div className="drag-icon-wrapper">
                    <UploadCloud size={48} />
                </div>
                <div className="drag-text">
                    <h2 className="drag-title">Import to DraftWolf</h2>
                    <p className="drag-subtitle">Drop your files or folders anywhere to import them</p>
                </div>
            </div>
        </div>
    );
};

export default DragOverlay;
