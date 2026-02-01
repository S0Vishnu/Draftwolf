import React, { useState, useRef, useEffect } from 'react';
import { X, Pin, GripHorizontal, Plus, Image as ImageIcon, Type, Trash2 } from 'lucide-react';
import './wolfbrain.css';

interface MoodboardProps {
    onClose: () => void;
    isOpen: boolean;
}

interface CanvasItem {
    id: string;
    type: 'text' | 'image';
    x: number;
    y: number;
    content: string; // text value or image URL
    width: number;
    height: number;
    scale?: number;
    zIndex: number;
}

export const Moodboard: React.FC<MoodboardProps> = ({ onClose, isOpen }) => {
    // Window State
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [size, setSize] = useState({ width: 600, height: 500 });
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

    // Canvas State
    const [items, setItems] = useState<CanvasItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const backgroundRef = useRef<HTMLDivElement>(null);

    // Interaction State
    const [dragMode, setDragMode] = useState<'none' | 'window' | 'item' | 'resize'>('none');
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Offset from object origin
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Mouse start position for deltas

    // Load Data
    useEffect(() => {
        const savedItems = localStorage.getItem('wolfbrain_items');
        if (savedItems) {
            try { setItems(JSON.parse(savedItems)); } catch (e) { }
        }

        const savedPos = localStorage.getItem('wolfbrain_pos');
        if (savedPos) {
            try { setPosition(JSON.parse(savedPos)); } catch (e) { }
        }
        const savedSize = localStorage.getItem('wolfbrain_size');
        if (savedSize) {
            try { setSize(JSON.parse(savedSize)); } catch (e) { }
        }
        const savedTop = localStorage.getItem('wolfbrain_top');
        if (savedTop === 'true') setIsAlwaysOnTop(true);
    }, []);

    // Save Data
    useEffect(() => {
        if (items.length > 0) localStorage.setItem('wolfbrain_items', JSON.stringify(items));
    }, [items]);

    useEffect(() => {
        localStorage.setItem('wolfbrain_size', JSON.stringify(size));
    }, [size]);

    // --- Window Dragging ---
    const handleWindowMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setDragMode('window');
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    // --- Window Resizing ---
    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        setDragMode('resize');
        setDragStart({ x: e.clientX, y: e.clientY });
        setDragOffset({ x: size.width, y: size.height }); // Store initial scale
    };

    // --- Item Interaction ---
    const handleItemMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        setSelectedItemId(id);
        setDragMode('item');

        // Find item offset relative to mouse
        const item = items.find(i => i.id === id);
        if (item) {
            // Bring to front
            const maxZ = Math.max(...items.map(i => i.zIndex), 0);
            if (item.zIndex < maxZ) {
                setItems(prev => prev.map(i => i.id === id ? { ...i, zIndex: maxZ + 1 } : i));
            }

            // Calculate offset relative to window content area
            // We need mouse position relative to canvas container
            if (backgroundRef.current) {
                const rect = backgroundRef.current.getBoundingClientRect();
                const mouseIdx = e.clientX - rect.left;
                const mouseIdy = e.clientY - rect.top;

                setDragOffset({
                    x: mouseIdx - item.x,
                    y: mouseIdy - item.y
                });
            }
        }
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        // Deselect if clicking empty space
        if (e.target === backgroundRef.current) {
            setSelectedItemId(null);
        }
    };

    // --- Canvas Operations ---
    const addTextItem = (x: number, y: number) => {
        const newItem: CanvasItem = {
            id: Date.now().toString(),
            type: 'text',
            x,
            y,
            content: '',
            width: 200,
            height: 100,
            zIndex: items.length + 1
        };
        setItems(prev => [...prev, newItem]);
        setSelectedItemId(newItem.id);
    };

    const addImageItem = (url: string, x: number = 50, y: number = 50) => {
        const newItem: CanvasItem = {
            id: Date.now().toString(),
            type: 'image',
            x,
            y,
            content: url,
            width: 200,
            height: 200, // Aspect ratio fix later
            zIndex: items.length + 1
        };
        setItems(prev => [...prev, newItem]);
        setSelectedItemId(newItem.id);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (e.target === backgroundRef.current) {
            const rect = backgroundRef.current.getBoundingClientRect();
            addTextItem(e.clientX - rect.left, e.clientY - rect.top);
        }
    };

    const updateItemContent = (id: string, content: string) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, content } : i));
    };

    const deleteSelected = () => {
        if (selectedItemId) {
            setItems(prev => prev.filter(i => i.id !== selectedItemId));
            setSelectedItemId(null);
        }
    };

    // --- Global Mouse Move ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (dragMode === 'window') {
                const newX = e.clientX - dragOffset.x;
                const newY = e.clientY - dragOffset.y;
                setPosition({ x: newX, y: newY });
            }
            else if (dragMode === 'resize') {
                const deltaX = e.clientX - dragStart.x;
                const deltaY = e.clientY - dragStart.y;
                setSize({
                    width: Math.max(300, dragOffset.x + deltaX),
                    height: Math.max(200, dragOffset.y + deltaY)
                });
            }
            else if (dragMode === 'item' && selectedItemId && backgroundRef.current) {
                // Determine new Item X/Y
                const rect = backgroundRef.current.getBoundingClientRect();
                const mouseRelX = e.clientX - rect.left;
                const mouseRelY = e.clientY - rect.top;

                const newX = mouseRelX - dragOffset.x;
                const newY = mouseRelY - dragOffset.y;

                setItems(prev => prev.map(i =>
                    i.id === selectedItemId
                        ? { ...i, x: newX, y: newY }
                        : i
                ));
            }
        };

        const handleMouseUp = () => {
            if (dragMode === 'window') {
                localStorage.setItem('wolfbrain_pos', JSON.stringify(position));
            }
            setDragMode('none');
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
                // Don't delete if editing text (check focus)
                const active = document.activeElement;
                if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) return;
                deleteSelected();
            }
        };

        // Paste Handling
        const handlePaste = (e: ClipboardEvent) => {
            if (!isOpen) return;
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            if (event.target?.result) {
                                addImageItem(event.target.result as string);
                            }
                        };
                        reader.readAsDataURL(blob);
                        e.preventDefault(); // Stop creating defaults
                    }
                } else if (items[i].type.indexOf('text/plain') !== -1) {
                    // Maybe handle text paste as new card if nothing selected?
                    // For now let default paste handle text inside textareas
                }
            }
        };

        // Drop Handling
        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isOpen) return;
        };

        if (dragMode !== 'none') {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('paste', handlePaste);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('paste', handlePaste);
        };
    }, [dragMode, dragOffset, dragStart, position, selectedItemId, isOpen]);


    // --- Toggle ---
    const toggleAlwaysOnTop = () => {
        const newState = !isAlwaysOnTop;
        setIsAlwaysOnTop(newState);
        localStorage.setItem('wolfbrain_top', String(newState));
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    addImageItem(ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Drop Handling ---
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (ev.target?.result) {
                        const rect = backgroundRef.current?.getBoundingClientRect();
                        const x = rect ? e.clientX - rect.left : 50;
                        const y = rect ? e.clientY - rect.top : 50;
                        addImageItem(ev.target.result as string, x, y);
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };

    if (!isOpen) return null;

    return (
        <div
            className={`moodboard-panel ${isAlwaysOnTop ? 'always-on-top' : ''}`}
            style={{
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height
            }}
        >
            {/* Header / Drag Handle */}
            <div className="moodboard-header" onMouseDown={handleWindowMouseDown}>
                <div className="moodboard-title">
                    <GripHorizontal size={14} style={{ opacity: 0.5 }} />
                    Wolfbrain
                </div>
                <div className="moodboard-actions" onMouseDown={e => e.stopPropagation()}>
                    <button className="mb-action-btn" title="Add Text" onClick={() => addTextItem(50, 50)}>
                        <Type size={14} />
                    </button>
                    <button className="mb-action-btn" title="Add Image" onClick={() => fileInputRef.current?.click()}>
                        <ImageIcon size={14} />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                    <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }}></div>
                    <button
                        className={`mb-action-btn ${isAlwaysOnTop ? 'active' : ''}`}
                        onClick={toggleAlwaysOnTop}
                        title={isAlwaysOnTop ? "Unpin" : "Pin On Top"}
                    >
                        <Pin size={14} />
                    </button>
                    <button className="mb-action-btn" onClick={onClose} title="Close">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div
                className="moodboard-canvas"
                ref={backgroundRef}
                onMouseDown={handleCanvasMouseDown}
                onDoubleClick={handleDoubleClick}
                onDrop={onDrop}
                onDragOver={onDragOver}
            >
                {items.length === 0 && (
                    <div className="mb-context-hint">
                        Double-click to add text • Paste images • Drag & Drop
                    </div>
                )}

                {items.map(item => (
                    <div
                        key={item.id}
                        className={`mb-item ${selectedItemId === item.id ? 'selected' : ''}`}
                        style={{
                            left: item.x,
                            top: item.y,
                            width: item.width,
                            height: item.height,
                            zIndex: item.zIndex
                        }}
                        onMouseDown={(e) => handleItemMouseDown(e, item.id)}
                    >
                        {item.type === 'image' ? (
                            <img src={item.content} alt="" className="mb-image-content" draggable={false} />
                        ) : (
                            <textarea
                                className="mb-text-content"
                                value={item.content}
                                onChange={(e) => updateItemContent(item.id, e.target.value)}
                                placeholder="Write something..."
                                autoFocus={items.length === 1 && !item.content}
                            />
                        )}

                        {/* Selected Item Controls (Delete) - Tiny hover button maybe? */}
                        {selectedItemId === item.id && (
                            <button
                                style={{
                                    position: 'absolute',
                                    top: -10,
                                    right: -10,
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '20px',
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSelected();
                                }}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Window Resize Handle */}
            <div
                className="resize-handle"
                onMouseDown={handleResizeMouseDown}
            >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="gray">
                    <path d="M10 10L10 0L0 10Z" fillOpacity="0.5" />
                </svg>
            </div>
        </div>
    );
};
