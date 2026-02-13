import React, { Suspense, lazy } from 'react';
import { X, FileWarning } from 'lucide-react';
import '../../styles/DiffViewer.css';

// Lazy load heavy components
const ImageDiff = lazy(() => import('./ImageDiff'));
const ModelDiff = lazy(() => import('./ModelDiff'));

// ─── File extension categories ───────────────────────────────────

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff', 'tif', 'svg']);
const MODEL_EXTS = new Set(['glb', 'gltf', 'obj']);

function getExt(filePath: string): string {
    return (filePath.split('.').pop() || '').toLowerCase();
}

function getCategory(filePath: string): 'image' | 'model' | 'unsupported' {
    const ext = getExt(filePath);
    if (IMAGE_EXTS.has(ext)) return 'image';
    if (MODEL_EXTS.has(ext)) return 'model';
    return 'unsupported';
}

// Convert a local file path to a file:// URL for rendering
function toFileURL(filePath: string): string {
    // Electron can load file:// URLs with webSecurity: false
    // Normalize backslashes to forward slashes
    const normalized = filePath.replaceAll('\\', '/');
    return `file:///${normalized.replace(/^\/+/, '')}`;
}

// ─── Main DiffViewer ─────────────────────────────────────────────

interface DiffViewerProps {
    oldPath: string;
    newPath: string;
    oldLabel?: string;
    newLabel?: string;
    onClose: () => void;
}

const DiffViewer: React.FC<DiffViewerProps> = ({
    oldPath,
    newPath,
    oldLabel = 'Previous Version',
    newLabel = 'Current',
    onClose,
}) => {
    const category = getCategory(newPath);
    const oldCategory = getCategory(oldPath);

    // If file types don't match, show unsupported
    const effectiveCategory = category === oldCategory ? category : 'unsupported';

    const oldSrc = toFileURL(oldPath);
    const newSrc = toFileURL(newPath);

    return (
        <div className="diff-viewer-overlay">
            <div className="diff-viewer-modal">
                {/* Header */}
                <div className="diff-viewer-header">
                    <div className="diff-viewer-title">
                        <span className="diff-viewer-title-icon">⚡</span>
                        Visual Diff
                    </div>
                    <button className="diff-viewer-close" onClick={onClose} aria-label="Close diff viewer">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="diff-viewer-content">
                    <Suspense
                        fallback={
                            <div className="diff-loading">
                                <div className="diff-loading-spinner" />
                                <span>Loading diff viewer…</span>
                            </div>
                        }
                    >
                        {effectiveCategory === 'image' && (
                            <ImageDiff
                                oldSrc={oldSrc}
                                newSrc={newSrc}
                                oldLabel={oldLabel}
                                newLabel={newLabel}
                            />
                        )}
                        {effectiveCategory === 'model' && (
                            <ModelDiff
                                oldSrc={oldSrc}
                                newSrc={newSrc}
                                oldLabel={oldLabel}
                                newLabel={newLabel}
                            />
                        )}
                        {effectiveCategory === 'unsupported' && (
                            <div className="diff-unsupported">
                                <FileWarning size={48} strokeWidth={1.5} />
                                <h3>Visual diff not available</h3>
                                <p>
                                    Visual diffing is supported for images ({[...IMAGE_EXTS].join(', ')})
                                    and 3D models ({[...MODEL_EXTS].join(', ')}).
                                </p>
                            </div>
                        )}
                    </Suspense>
                </div>
            </div>
        </div>
    );
};

export default DiffViewer;
export { IMAGE_EXTS, MODEL_EXTS, getCategory };
