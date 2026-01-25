import React from 'react';
import { Upload, Trash2, Plus } from 'lucide-react';
import { AttachmentItem } from './types';

interface AttachmentsTabProps {
    attachments: AttachmentItem[];
    onAdd: () => void;
    onDelete: (id: string) => void;
    onPreview: (resolvedPath: string) => void;
    onResolvePath: (path: string) => string;
    isDragging: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
}

const AttachmentsTab: React.FC<AttachmentsTabProps> = ({
    attachments,
    onAdd,
    onDelete,
    onPreview,
    onResolvePath,
    isDragging,
    onDragOver,
    onDragLeave,
    onDrop
}) => {
    return (
        <div
            className="attachments-container"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div className={`attachments-dropzone ${isDragging ? 'drag-active' : ''}`}>
                <div className="attachments-grid">
                    {attachments.map((att, i) => (
                        <div
                            key={att.id}
                            className="attachment-item"
                            onClick={() => onPreview(onResolvePath(att.path))}
                            style={{ animationDelay: `${i * 50}ms` }}
                        >
                            {att.type === 'image' && (
                                <img
                                    src={onResolvePath(att.path)}
                                    alt={att.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            )}
                            <div className="attachment-overlay">
                                <button
                                    className="delete-attachment-btn"
                                    onClick={(e) => { e.stopPropagation(); onDelete(att.id); }}
                                    title="Remove attachment"
                                >
                                    <Trash2 size={14} />
                                </button>
                                <div className="attachment-name">
                                    {att.name}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {attachments.length === 0 || isDragging ? (
                    <div
                        className="upload-placeholder"
                        onClick={onAdd}
                        style={{ cursor: 'pointer', minHeight: attachments.length > 0 ? '150px' : '300px' }}
                    >
                        <div className="upload-icon-circle">
                            <Upload size={24} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#e0e0e0', fontWeight: 500, marginBottom: 4 }}>
                                {isDragging ? 'Drop images here' : 'Click or Drop Images'}
                            </div>
                            {!isDragging && (
                                <div style={{ fontSize: 12, color: '#666' }}>
                                    Supports JPG, PNG, GIF, WEBP
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <button className="upload-btn" onClick={onAdd} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', marginTop: 'auto' }}>
                        <Plus size={16} /> Add Another Image
                    </button>
                )}
            </div>
        </div>
    );
};

export default AttachmentsTab;
