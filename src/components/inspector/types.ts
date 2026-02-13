import { FileEntry } from '../FileItem';

export type InspectorTab = 'info' | 'tasks' | 'versions' | 'attachments' | 'snapshots';
export type InspectorAction = 'createVersion' | 'compare' | null;

export interface InspectorPanelProps {
    file: FileEntry | null;
    projectRoot: string;
    onClose: () => void;
    onRename?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
    onRefresh?: () => void;
    initialTab?: InspectorTab;
    initialAction?: InspectorAction;
    onActionHandled?: () => void;
    backupPath?: string;
}

export interface AttachmentItem {
    id: string;
    type: 'image';
    path: string; // Internal path e.g. "attachments/..."
    name: string;
    createdAt: number;
}

export interface Version {
    id: string;
    label: string;
    timestamp: number | string;
    files: Record<string, string>;
    totalSize?: number;
    totalCompressedSize?: number;
    parent?: string;
    parents?: string[];
    parentId?: string;
}
