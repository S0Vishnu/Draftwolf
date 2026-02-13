import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Columns, Layers, SlidersHorizontal } from 'lucide-react';

type ViewMode = 'slider' | 'side-by-side' | 'overlay';

interface ImageDiffProps {
    oldSrc: string;
    newSrc: string;
    oldLabel?: string;
    newLabel?: string;
}

const ImageDiff: React.FC<ImageDiffProps> = ({
    oldSrc,
    newSrc,
    oldLabel = 'Old',
    newLabel = 'New',
}) => {
    const [mode, setMode] = useState<ViewMode>('slider');
    const [sliderPos, setSliderPos] = useState(50);
    const [overlayOpacity, setOverlayOpacity] = useState(0.5);
    const [dragging, setDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback(() => setDragging(true), []);
    const handleMouseUp = useCallback(() => setDragging(false), []);

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!dragging || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            setSliderPos(Math.max(0, Math.min(100, x)));
        },
        [dragging]
    );

    useEffect(() => {
        if (dragging) {
            globalThis.addEventListener('mousemove', handleMouseMove);
            globalThis.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            globalThis.removeEventListener('mousemove', handleMouseMove);
            globalThis.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, handleMouseMove, handleMouseUp]);

    const modes: { key: ViewMode; icon: React.ReactNode; label: string }[] = [
        { key: 'slider', icon: <SlidersHorizontal size={14} />, label: 'Slider' },
        { key: 'side-by-side', icon: <Columns size={14} />, label: 'Side by Side' },
        { key: 'overlay', icon: <Layers size={14} />, label: 'Overlay' },
    ];

    return (
        <div className="diff-image-root">
            {/* Mode Switcher */}
            <div className="diff-mode-bar">
                {modes.map((m) => (
                    <button
                        key={m.key}
                        className={`diff-mode-btn ${mode === m.key ? 'active' : ''}`}
                        onClick={() => setMode(m.key)}
                    >
                        {m.icon}
                        <span>{m.label}</span>
                    </button>
                ))}
            </div>

            {mode === 'slider' && (
                <div
                    className="diff-slider-container"
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    style={{ cursor: dragging ? 'ew-resize' : 'default' }}
                >
                    {/* New image (full, underneath) */}
                    <img src={newSrc} className="diff-slider-img diff-slider-img-base" alt={newLabel} draggable={false} />

                    {/* Old image (clipped via clip-path so it doesn't resize) */}
                    <img
                        src={oldSrc}
                        className="diff-slider-img diff-slider-img-overlay"
                        alt={oldLabel}
                        draggable={false}
                        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                    />

                    {/* Slider handle */}
                    <div className="diff-slider-handle" style={{ left: `${sliderPos}%` }}>
                        <div className="diff-slider-handle-line" />
                        <div className="diff-slider-handle-grip">
                            <span />
                            <span />
                            <span />
                        </div>
                    </div>

                    {/* Labels */}
                    <div className="diff-slider-label diff-slider-label-left">{oldLabel}</div>
                    <div className="diff-slider-label diff-slider-label-right">{newLabel}</div>
                </div>
            )}

            {/* Side by Side Mode */}
            {mode === 'side-by-side' && (
                <div className="diff-sidebyside">
                    <div className="diff-sidebyside-pane">
                        <div className="diff-pane-label">{oldLabel}</div>
                        <img src={oldSrc} alt={oldLabel} draggable={false} />
                    </div>
                    <div className="diff-sidebyside-divider" />
                    <div className="diff-sidebyside-pane">
                        <div className="diff-pane-label">{newLabel}</div>
                        <img src={newSrc} alt={newLabel} draggable={false} />
                    </div>
                </div>
            )}

            {/* Overlay (Onion Skin) Mode */}
            {mode === 'overlay' && (
                <div className="diff-overlay-container">
                    <div className="diff-overlay-images">
                        <img src={oldSrc} className="diff-overlay-img" alt={oldLabel} draggable={false} />
                        <img
                            src={newSrc}
                            className="diff-overlay-img diff-overlay-img-top"
                            alt={newLabel}
                            style={{ opacity: overlayOpacity }}
                            draggable={false}
                        />
                    </div>
                    <div className="diff-overlay-controls">
                        <span className="diff-overlay-label">{oldLabel}</span>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={overlayOpacity}
                            onChange={(e) => setOverlayOpacity(Number.parseFloat(e.target.value))}
                            className="diff-overlay-slider"
                            aria-label="Overlay opacity"
                        />
                        <span className="diff-overlay-label">{newLabel}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageDiff;
