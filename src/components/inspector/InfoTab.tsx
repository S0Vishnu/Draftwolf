import React, { useState, useRef, useEffect } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import { FileEntry } from '../FileItem';
import FileIcon from '../FileIcon';

interface InfoTabProps {
    file: FileEntry;
    tags: string[];
    onAddTag: (tag: string) => void;
    onRemoveTag: (tag: string) => void;
}

const InfoTab: React.FC<InfoTabProps> = ({ file, tags, onAddTag, onRemoveTag }) => {
    const [tagInput, setTagInput] = useState('');
    const [showTagInput, setShowTagInput] = useState(false);
    const tagInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (showTagInput && tagInputRef.current) {
            tagInputRef.current.focus();
        }
    }, [showTagInput]);

    const handleAddTag = () => {
        const val = tagInput.trim();
        if (val) {
            onAddTag(val);
            setTagInput('');
        }
    };

    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return '--';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (date?: Date) => {
        if (!date) return '--';
        return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) +
            ' - ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            <div className="preview-large">
                <FileIcon name={file.name} isDirectory={file.isDirectory} size={90} />
            </div>
            <div className="inspector-props">
                <div className="prop-row">
                    <label>Name</label>
                    <div className="val">{file.name}</div>
                </div>
                <div className="prop-row">
                    <label>Type</label>
                    <div className="val">{file.type}</div>
                </div>
                <div className="prop-row">
                    <label>Size</label>
                    <div className="val">{formatSize(file.size)}</div>
                </div>
                <div className="prop-row">
                    <label>Modified</label>
                    <div className="val">{formatDate(file.mtime)}</div>
                </div>
                <div className="prop-row">
                    <label>Full Path</label>
                    <div className="val path-val">{file.path}</div>
                </div>

                <div className="prop-row">
                    <div className="tags-header">
                        <label>Tags</label>
                        {!showTagInput && (
                            <button
                                className="add-tag-icon-btn"
                                onClick={() => setShowTagInput(true)}
                                title="Add new tag"
                            >
                                <Plus size={12} />
                            </button>
                        )}
                    </div>
                    <div className="tags-wrapper">
                        {tags.map(t => (
                            <div key={t} className="info-tag-badge">
                                <Tag size={10} />
                                {t}
                                <span className="tag-remove" onClick={() => onRemoveTag(t)}>
                                    <X size={10} />
                                </span>
                            </div>
                        ))}
                    </div>
                    {showTagInput && (
                        <input
                            ref={tagInputRef}
                            className="add-tag-input"
                            placeholder="Type tag name..."
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    handleAddTag();
                                }
                                if (e.key === 'Escape') {
                                    setShowTagInput(false);
                                    setTagInput('');
                                }
                            }}
                            onBlur={() => {
                                if (!tagInput.trim()) {
                                    setShowTagInput(false);
                                }
                            }}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default InfoTab;
