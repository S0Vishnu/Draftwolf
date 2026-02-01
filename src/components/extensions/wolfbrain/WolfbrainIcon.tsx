import React from 'react';
import { Brain } from 'lucide-react';
import './wolfbrain.css';

interface WolfbrainIconProps {
    onClick: () => void;
    isActive: boolean;
}

export const WolfbrainIcon: React.FC<WolfbrainIconProps> = ({ onClick, isActive }) => {
    return (
        <div
            className={`wolfbrain-icon ${isActive ? 'active' : ''}`}
            onClick={onClick}
            title="Wolfbrain Moodboard"
        >
            <Brain size={18} />
        </div>
    );
};
