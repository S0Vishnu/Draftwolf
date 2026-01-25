import { FileEntry } from '../FileItem';
import { TodoItem } from '../TodoList';

export interface InspectorPanelProps {
    file: FileEntry | null;
    projectRoot: string;
    onClose: () => void;
    onRename?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
    onRefresh?: () => void;
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
    parent?: string;
    parents?: string[];
    parentId?: string;
}
