import React, { Suspense, lazy } from 'react';
import { X, FileWarning, ChevronDown, Check } from 'lucide-react';
import '../../styles/DiffViewer.css';

// Lazy load heavy components
const ImageDiff = lazy(() => import('./ImageDiff'));
const ModelDiff = lazy(() => import('./ModelDiff'));

// ─── File extension categories ───────────────────────────────────

export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff', 'tif', 'svg']);
export const MODEL_EXTS = new Set(['glb', 'gltf', 'obj']);

export function getExt(filePath: string): string {
    return (filePath.split('.').pop() || '').toLowerCase();
}

export function getCategory(filePath: string): 'image' | 'model' | 'unsupported' {
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
    history: any[];
    projectRoot: string;
    backupPath?: string;
    relativePath: string;
    currentFilePath: string;
    initialLeftVersionId: string;
    initialRightVersionId?: string; // includes 'current'
    onClose: () => void;
}

const CustomDropdown: React.FC<{
    value: string;
    options: { id: string; label: string; date: string }[];
    onChange: (val: string) => void;
    placeholder?: string;
}> = ({ value, options, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.id === value);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="diff-custom-dropdown" ref={dropdownRef}>
            <div 
                className={`diff-dropdown-trigger ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpen(!isOpen);
                    }
                }}
                role="button"
                tabIndex={0}
            >
                <div className="diff-dropdown-value">
                    <span className="diff-dropdown-main-label">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    {selectedOption?.date && (
                        <span className="diff-dropdown-sub-label">{selectedOption.date}</span>
                    )}
                </div>
                <ChevronDown size={14} className={`diff-dropdown-arrow ${isOpen ? 'rotated' : ''}`} />
            </div>

            {isOpen && (
                <div className="diff-dropdown-menu" role="listbox">
                    {options.map(opt => (
                        <div 
                            key={opt.id} 
                            className={`diff-dropdown-item ${opt.id === value ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(opt.id);
                                setIsOpen(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onChange(opt.id);
                                    setIsOpen(false);
                                }
                            }}
                            role="option"
                            aria-selected={opt.id === value}
                            tabIndex={0}
                        >
                            <div className="diff-dropdown-item-content">
                                <span className="diff-dropdown-item-label">{opt.label}</span>
                                {opt.date && <span className="diff-dropdown-item-date">{opt.date}</span>}
                            </div>
                            {opt.id === value && <Check size={14} className="diff-dropdown-check" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DiffViewer: React.FC<DiffViewerProps> = ({
    history,
    projectRoot,
    backupPath,
    relativePath,
    currentFilePath,
    initialLeftVersionId,
    initialRightVersionId = 'current',
    onClose,
}) => {
    const [leftVersionId, setLeftVersionId] = React.useState(initialLeftVersionId);
    const [rightVersionId, setRightVersionId] = React.useState(initialRightVersionId);
    const [leftPath, setLeftPath] = React.useState<string | null>(null);
    const [rightPath, setRightPath] = React.useState<string | null>(null);
    const [extracting, setExtracting] = React.useState(false);

    const category = getCategory(currentFilePath);

    React.useEffect(() => {
        const extractVersions = async () => {
            setExtracting(true);
            try {
                const tempDir = `${projectRoot}/.draft/temp`;
                const ext = currentFilePath.includes('.') ? '.' + currentFilePath.split('.').pop() : '';
                const fileName = currentFilePath.split(/[/\\]/).pop() || 'file';
                const nameWithoutExt = fileName.replace(ext, '');

                const extractOne = async (vId: string) => {
                    const tempFile = `${tempDir}/${nameWithoutExt}_v${vId}_${Date.now()}${ext}`;
                    await globalThis.api.draft.extract(projectRoot, vId, relativePath, tempFile, backupPath);
                    return tempFile;
                };

                const lp = await extractOne(leftVersionId);
                const rp = rightVersionId === 'current' ? currentFilePath : await extractOne(rightVersionId);

                setLeftPath(lp);
                setRightPath(rp);
            } catch (e) {
                console.error('[DiffViewer] Extraction failed:', e);
            } finally {
                setExtracting(false);
            }
        };

        extractVersions();
    }, [leftVersionId, rightVersionId, projectRoot, backupPath, relativePath, currentFilePath]);

    const leftLabel = React.useMemo(() => {
        const ver = history.find(v => v.id === leftVersionId);
        return ver?.label || `Version ${leftVersionId.slice(0, 8)}`;
    }, [history, leftVersionId]);

    const rightLabel = React.useMemo(() => {
        if (rightVersionId === 'current') return 'Current File';
        const ver = history.find(v => v.id === rightVersionId);
        return ver?.label || `Version ${rightVersionId?.slice(0, 8)}`;
    }, [history, rightVersionId]);

    const leftSrc = leftPath ? toFileURL(leftPath) : '';
    const rightSrc = rightPath ? toFileURL(rightPath) : '';

    const versionOptions = React.useMemo(() => {
        return history.map(v => ({
            id: v.id,
            label: v.label || v.id.slice(0, 8),
            date: new Date(v.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        }));
    }, [history]);

    const rightOptions = React.useMemo(() => [
        { id: 'current', label: 'Current File', date: 'Working Copy' },
        ...versionOptions
    ], [versionOptions]);

    return (
        <div className="diff-viewer-overlay">
            <div className="diff-viewer-modal animate-in">
                {/* Header */}
                <div className="diff-viewer-header">
                    <div className="diff-viewer-title-group">
                        <div className="diff-viewer-title">
                            <span className="diff-viewer-title-icon">⚡</span>
                            Visual Diff
                        </div>
                        <div className="diff-version-selectors">
                            <CustomDropdown 
                                value={leftVersionId}
                                options={versionOptions}
                                onChange={setLeftVersionId}
                            />
                            <span className="diff-version-vs">vs</span>
                            <CustomDropdown 
                                value={rightVersionId}
                                options={rightOptions}
                                onChange={setRightVersionId}
                            />
                        </div>
                    </div>
                    <button className="diff-viewer-close" onClick={onClose} aria-label="Close diff viewer">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="diff-viewer-content">
                    {extracting ? (
                        <div className="diff-loading-overlay animate-fade">
                            <div className="diff-loading-card">
                                <div className="diff-loading-spinner" />
                                <div className="diff-loading-text">
                                    <h3>Extracting Versions</h3>
                                    <p>Preparing file comparison...</p>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    
                    <div className={`diff-viewer-panes ${extracting ? 'blur-content' : ''}`}>
                        <Suspense
                            fallback={
                                <div className="diff-loading">
                                    <div className="diff-loading-spinner" />
                                    <span>Loading components…</span>
                                </div>
                            }
                        >
                            {category === 'image' && leftSrc && rightSrc && (
                                <ImageDiff
                                    oldSrc={leftSrc}
                                    newSrc={rightSrc}
                                    oldLabel={leftLabel}
                                    newLabel={rightLabel}
                                />
                            )}
                            {category === 'model' && leftSrc && rightSrc && (
                                <ModelDiff
                                    oldSrc={leftSrc}
                                    newSrc={rightSrc}
                                    oldLabel={leftLabel}
                                    newLabel={rightLabel}
                                />
                            )}
                            {category === 'unsupported' && (
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
        </div>
    );
};

export default DiffViewer;
