import React, { useState, useRef, useEffect } from 'react';
import {
    X, Pin, Plus, Image as ImageIcon, Type, Trash2,
    Maximize, Minus, Brain, Save, Download,
    FileText, MousePointer, Square, Circle, Minus as LineIcon,
    ArrowRight, PenTool, StickyNote, RotateCcw, RotateCw, Eraser, MoreVertical,
    Maximize2, ChevronDown, ChevronUp, Lock, Unlock
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { toPng } from 'html-to-image';
import { toast } from 'react-toastify';
import '../styles/Wolfbrain.css';

const STICKY_COLORS = [
    '#fef3c7', // Yellow (Default)
    '#ffeaee', // Pink
    '#dcfce7', // Green
    '#dbeafe', // Blue
    '#ffedd5', // Orange
    '#e0e7ff', // Indigo
];

interface CanvasItem {
    id: string;
    type: 'text' | 'image' | 'sticker' | 'rect' | 'circle' | 'line' | 'arrow' | 'draw';
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string;
    rotation?: number;
    scale?: number;
    zIndex: number;
    // Styling
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    shapeType?: 'rect' | 'circle';
    points?: { x: number, y: number }[]; // For drawing/lines
}

const WolfbrainPage = () => {
    // --- Window State ---
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
    const [rootPath, setRootPath] = useState('');
    const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
    // Sticky Note Settings
    const [isStickyFixedSize, setIsStickyFixedSize] = useState(true);

    // --- Canvas Data ---
    const [items, setItems] = useState<CanvasItem[]>([]);

    // --- Unsaved Changes Tracking ---
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const lastSavedItems = useRef<string>(JSON.stringify([]));


    // Toolbar Responsive State
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [showToolsMenu, setShowToolsMenu] = useState(false);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Multi-select state
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    const [activeTool, setActiveTool] = useState<'move' | 'text' | 'image' | 'sticker' | 'rect' | 'circle' | 'line' | 'arrow' | 'draw' | 'eraser'>('move');

    // --- Interaction State ---
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStartPos, setDrawStartPos] = useState<{ x: number, y: number } | null>(null);
    const [currentDrawPoints, setCurrentDrawPoints] = useState<{ x: number, y: number }[]>([]);

    // --- History State ---
    const [history, setHistory] = useState<CanvasItem[][]>([[]]);
    const [historyStep, setHistoryStep] = useState(0);

    const addToHistory = (newItems: CanvasItem[]) => {
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newItems);
        if (newHistory.length > 50) newHistory.shift(); // Limit history
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
    };

    const handleUndo = () => {
        if (historyStep > 0) {
            setHistoryStep(prev => prev - 1);
            setItems(history[historyStep - 1]);
        }
    };

    const handleRedo = () => {
        if (historyStep < history.length - 1) {
            setHistoryStep(prev => prev + 1);
            setItems(history[historyStep + 1]);
        }
    };

    // Selection Box State
    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const isInteracting = useRef(false); // Ref to track if we should save history on mouse up

    // --- Initialization ---
    useEffect(() => {
        const load = async () => {
            const top = await window.api?.wolfbrain?.getAlwaysOnTop();
            setIsAlwaysOnTop(!!top);

            const savedItems = localStorage.getItem('wolfbrain_items');
            if (savedItems) {
                try {
                    const parsed = JSON.parse(savedItems);
                    setItems(parsed);
                    setHistory([parsed]); // Init history
                    lastSavedItems.current = JSON.stringify(parsed); // Store unformatted for comparison
                    setHasUnsavedChanges(false);
                } catch (e) { }
            }
        };
        load();

        const cleanListener = window.api?.wolfbrain?.onInitPath(async (path) => {
            if (path.toLowerCase().endsWith('.wolfbrain')) {
                // Open File Mode
                const res = await window.api.readFile(path);
                if (res.success && res.content) {
                    try {
                        const parsed = JSON.parse(res.content);
                        setItems(parsed);
                        setHistory([parsed]);
                        setCurrentFilePath(path);
                        lastSavedItems.current = JSON.stringify(parsed); // Store unformatted for comparison
                        setHasUnsavedChanges(false);
                        // Isolate directory from file path for "rootPath" context if needed
                        const separator = path.includes('\\') ? '\\' : '/';
                        const dir = path.substring(0, path.lastIndexOf(separator));
                        setRootPath(dir);
                    } catch (e) {
                        toast.error("Failed to parse Wolfbrain file");
                    }
                } else {
                    toast.error("Failed to read file: " + res.error);
                }
            } else {
                // New/Folder Mode
                setRootPath(path);
                setCurrentFilePath(null);
                setItems([]);
                setHistory([[]]);
                lastSavedItems.current = JSON.stringify([]);
                setHasUnsavedChanges(false);
            }
        });

        return () => cleanListener && cleanListener();
    }, []);

    // --- Keyboard Actions (Undo/Redo/Del) ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            const tag = (document.activeElement?.tagName || '').toLowerCase();
            const isInput = tag === 'input' || tag === 'textarea';

            if (!isInput) {
                if (['Delete', 'Backspace'].includes(e.key)) {
                    if (selectedItemIds.size > 0) {
                        const newItems = items.filter(i => !selectedItemIds.has(i.id));
                        setItems(newItems);
                        setSelectedItemIds(new Set());
                        addToHistory(newItems);
                    }
                }
            }

            if (isCtrl && e.key === 'z') {
                if (e.shiftKey) handleRedo(); else handleUndo();
                e.preventDefault();
            } else if (isCtrl && e.key === 'y') {
                handleRedo();
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [items, selectedItemIds, history, historyStep]);

    // scaleRef for event handlers
    const scaleRef = useRef(1);

    // --- Paste ---
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const active = document.activeElement;
            if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
                if (e.clipboardData?.files?.length) {
                    // fall through to image handler
                } else {
                    return; // Let default text paste happen
                }
            }

            const clipboardItems = e.clipboardData?.items;
            if (!clipboardItems) return;

            let handled = false;
            for (let i = 0; i < clipboardItems.length; i++) {
                const item = clipboardItems[i];
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = (ev) => ev.target?.result && addImageItem(ev.target.result as string);
                        reader.readAsDataURL(blob);
                        handled = true;
                    }
                } else if (item.type === 'text/plain') {
                    item.getAsString((text) => {
                        if (text.trim()) {
                            const active = document.activeElement;
                            if (!(active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)) {
                                const newItem: CanvasItem = {
                                    id: Date.now().toString(), type: 'text', x: 50000, y: 50000, width: 250, height: 150, content: text, zIndex: 999
                                };
                                setItems(p => [...p, newItem]);
                                setSelectedItemIds(new Set([newItem.id]));
                                addToHistory([...items, newItem]);
                            }
                        }
                    });
                    handled = true;
                }
            }
            if (handled) e.preventDefault();
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [items]);

    // --- Drag and Drop for Images ---
    useEffect(() => {
        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                // Handle file drops
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            if (ev.target?.result) {
                                addImageItem(ev.target.result as string);
                            }
                        };
                        reader.readAsDataURL(file);
                    }
                }
            } else {
                // Handle URL drops (from websites)
                const url = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/html');
                if (url) {
                    // Try to extract image URL from HTML or use direct URL
                    const imgMatch = url.match(/<img[^>]+src="([^">]+)"/);
                    const imageUrl = imgMatch ? imgMatch[1] : url;

                    // If it looks like an image URL, add it directly
                    if (imageUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || imageUrl.startsWith('data:image/')) {
                        addImageItem(imageUrl);
                    } else {
                        // Try to fetch and convert to data URL
                        fetch(imageUrl)
                            .then(res => res.blob())
                            .then(blob => {
                                if (blob.type.startsWith('image/')) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                        if (ev.target?.result) {
                                            addImageItem(ev.target.result as string);
                                        }
                                    };
                                    reader.readAsDataURL(blob);
                                }
                            })
                            .catch(err => {
                                console.error('Failed to load dropped image:', err);
                                toast.error('Failed to load image from URL');
                            });
                    }
                }
            }
        };

        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, []);

    // --- Tools Logic ---
    const setTool = (tool: typeof activeTool) => {
        setActiveTool(tool);
        if (tool !== 'move') setSelectedItemIds(new Set()); // Deselect on tool switch
    };

    // --- Actions ---
    const toggleAlwaysOnTop = () => {
        const newState = !isAlwaysOnTop;
        setIsAlwaysOnTop(newState);
        window.api?.wolfbrain?.setAlwaysOnTop(newState);
    };

    // Custom unsaved changes dialog state
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

    const handleClose = async () => {
        if (hasUnsavedChanges) {
            setShowUnsavedDialog(true);
        } else {
            window.api?.wolfbrain?.close();
        }
    };

    const handleSaveAndClose = async () => {
        await handleSaveWolfbrain();
        setShowUnsavedDialog(false);
        window.api?.wolfbrain?.close();
    };

    const handleDiscardAndClose = () => {
        setShowUnsavedDialog(false);
        window.api?.wolfbrain?.close();
    };

    const handleCancelClose = () => {
        setShowUnsavedDialog(false);
    };
    const handleMinimize = () => window.api?.wolfbrain?.minimize();
    const handleToggleMaximize = () => window.api?.wolfbrain?.toggleMaximize();

    const handleSaveWolfbrain = async () => {
        const content = JSON.stringify(items, null, 2);
        const unformattedContent = JSON.stringify(items); // For comparison

        if (currentFilePath) {
            // Overwrite existing
            try {
                const res = await window.api.wolfbrain.saveFile(currentFilePath, content);
                if (res.success) {
                    toast.success("Saved successfully");
                    lastSavedItems.current = unformattedContent;
                    setHasUnsavedChanges(false);
                }
                else toast.error("Failed to save: " + res.error);
            } catch (e: any) { console.error(e); toast.error("Save error: " + e.message); }
        } else {
            // First time save -> Save As
            try {
                const res = await window.api.wolfbrain.saveAs(content);
                if (res.success && res.filePath) {
                    setCurrentFilePath(res.filePath);
                    toast.success("Saved to " + res.filePath.split(/[/\\]/).pop());
                    lastSavedItems.current = unformattedContent;
                    setHasUnsavedChanges(false);
                } else if (res.canceled) {
                    // User canceled, do nothing
                } else {
                    toast.error("Failed to save: " + res.error);
                }
            } catch (e: any) { console.error(e); toast.error("Save error: " + e.message); }
        }
    };

    const handleExportImage = async () => {
        if (!canvasRef.current) return;
        try {
            const dataUrl = await toPng(canvasRef.current, { backgroundColor: '#1e1e24' });
            const link = document.createElement('a');
            link.download = 'wolfbrain-export.png';
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error(err);
            toast.error("Failed to export image");
        }
    };

    // --- Helpers ---
    const getScale = () => {
        let s = 1;
        const transformEl = canvasRef.current;
        if (transformEl && transformEl.parentElement) {
            const match = transformEl.parentElement.style.transform.match(/scale\(([\d\.]+)\)/);
            if (match) s = parseFloat(match[1]);
        }
        return s;
    };

    // --- Creation Handlers ---
    const addTextItem = (x: number, y: number) => {
        // ...
        const newItem: CanvasItem = {
            id: Date.now().toString(), type: 'text', x, y, width: 200, height: 100, zIndex: items.length + 1
        };
        const newItems = [...items, newItem];
        setItems(newItems);
        setSelectedItemIds(new Set([newItem.id]));
        setTool('move');
        addToHistory(newItems);
    };

    const addStickerItem = (x: number, y: number) => {
        // ...
        const newItem: CanvasItem = {
            id: Date.now().toString(), type: 'sticker', x, y, width: 150, height: 150, content: '', backgroundColor: '#fef3c7', zIndex: items.length + 1
        };
        const newItems = [...items, newItem];
        setItems(newItems);
        setSelectedItemIds(new Set([newItem.id]));
        setTool('move');
        addToHistory(newItems);
    };

    const addImageItem = (url: string) => {
        // Load image to get actual dimensions
        const img = new Image();
        img.onload = () => {
            // Calculate dimensions preserving aspect ratio
            const maxSize = 400; // Max width or height
            let width = img.width;
            let height = img.height;

            // Scale down if too large, preserving aspect ratio
            if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width = width * ratio;
                height = height * ratio;
            }

            const newItem: CanvasItem = {
                id: Date.now().toString(),
                type: 'image',
                x: 50000,
                y: 50000,
                width,
                height,
                content: url,
                zIndex: items.length + 1
            };
            const newItems = [...items, newItem];
            setItems(newItems);
            setSelectedItemIds(new Set([newItem.id]));
            setTool('move');
            addToHistory(newItems);
        };
        img.onerror = () => {
            // Fallback to default size if image fails to load
            const newItem: CanvasItem = {
                id: Date.now().toString(),
                type: 'image',
                x: 50000,
                y: 50000,
                width: 300,
                height: 300,
                content: url,
                zIndex: items.length + 1
            };
            const newItems = [...items, newItem];
            setItems(newItems);
            setSelectedItemIds(new Set([newItem.id]));
            setTool('move');
            addToHistory(newItems);
        };
        img.src = url;
    };

    // --- Mouse Handling ---
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only allow Left Drag
        const x = e.nativeEvent.offsetX;
        const y = e.nativeEvent.offsetY;

        if (activeTool === 'move') {
            if (e.target === e.currentTarget) {
                setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
                setSelectedItemIds(new Set());
            }
            return;
        }

        if (activeTool === 'eraser') {
            isInteracting.current = true;
            // Erase on click!
            const hitItem = items.find(i =>
                x >= i.x && x <= i.x + i.width && y >= i.y && y <= i.y + i.height
            ); // Simple box check, vectors are harder. 
            // For vectors we need more complex hit test, but simple box is okay for MVP eraser
            // Or we rely on MouseMove eraser logic
            return;
        }

        if (activeTool === 'text') { addTextItem(x, y); return; }
        if (activeTool === 'sticker') { addStickerItem(x, y); return; }

        // Drawings / Shapes
        setIsDrawing(true);
        isInteracting.current = true; // Mark interaction start
        setDrawStartPos({ x, y });
        setCurrentDrawPoints([{ x, y }]);
        // ... create temp item ...
        const newItem: CanvasItem = {
            id: 'drawing-temp', type: activeTool, x, y, width: 0, height: 0,
            zIndex: items.length + 1, points: [{ x, y }],
            shapeType: activeTool === 'rect' ? 'rect' : activeTool === 'circle' ? 'circle' : undefined
        };
        setItems(prev => [...prev, newItem]);
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        const currentX = e.nativeEvent.offsetX;
        const currentY = e.nativeEvent.offsetY;

        if (selectionBox) {
            setSelectionBox(prev => prev ? { ...prev, currentX, currentY } : null);
            return;
        }

        if (activeTool === 'eraser' && e.buttons === 1) { // Left click held
            // Erase Logic
            // Filter out items that intersect
            const eraserSize = 10;
            setItems(prev => {
                const remaining = prev.filter(i => {
                    // Check intersection
                    if (['line', 'arrow', 'draw'].includes(i.type)) {
                        // Simplify: Check bounds
                        // For better eraser, we'd check segments.
                        // MVP: Check bounding box of vectors. 
                        // Not perfect but works.
                        // But vectors bounding box logic is not computed in 'i'. 
                        // 'i.points' has it.
                        if (!i.points) return true;
                        const xs = i.points.map(p => p.x); const ys = i.points.map(p => p.y);
                        const minX = Math.min(...xs); const maxX = Math.max(...xs);
                        const minY = Math.min(...ys); const maxY = Math.max(...ys);
                        return !(currentX > minX - 10 && currentX < maxX + 10 && currentY > minY - 10 && currentY < maxY + 10);
                    } else {
                        return !(currentX >= i.x && currentX <= i.x + i.width && currentY >= i.y && currentY <= i.y + i.height);
                    }
                });
                return remaining;
            });
            isInteracting.current = true; // items changed
            return;
        }

        if (!isDrawing || !drawStartPos) return;

        // ... drawing updates ...
        if (activeTool === 'draw') {
            setItems(prev => prev.map(i => i.id === 'drawing-temp' ? { ...i, points: [...(i.points || []), { x: currentX, y: currentY }] } : i));
        } else if (activeTool === 'line' || activeTool === 'arrow') {
            setItems(prev => prev.map(i => i.id === 'drawing-temp' ? { ...i, points: [drawStartPos, { x: currentX, y: currentY }] } : i));
        } else {
            const width = currentX - drawStartPos.x;
            const height = currentY - drawStartPos.y;
            setItems(prev => prev.map(i => i.id === 'drawing-temp' ? { ...i, width, height } : i));
        }
    };

    // ... handleCanvasMouseUp empty ...

    // --- Global Interaction Cleanup ---
    useEffect(() => {
        const handleGlobalUp = () => {
            // ... box selection logic ...
            if (selectionBox) {
                // ... same selection box logic ...
                const { startX, startY, currentX, currentY } = selectionBox;
                const left = Math.min(startX, currentX);
                const right = Math.max(startX, currentX);
                const top = Math.min(startY, currentY);
                const bottom = Math.max(startY, currentY);

                const newSelection = new Set<string>();
                items.forEach(item => {
                    const itemR = item.x + Math.abs(item.width || 0);
                    const itemB = item.y + Math.abs(item.height || 0);
                    const overlap = !(itemR < left || item.x > right || itemB < top || item.y > bottom);
                    if (overlap) newSelection.add(item.id);
                });

                if (Math.abs(currentX - startX) > 5 || Math.abs(currentY - startY) > 5) {
                    setSelectedItemIds(newSelection);
                }
                setSelectionBox(null);
            }

            if (isDrawing) {
                setIsDrawing(false);
                setItems(prev => {
                    const updated = prev.map(i => i.id === 'drawing-temp' ? { ...i, id: Date.now().toString() } : i);
                    addToHistory(updated); // Save history after draw
                    return updated;
                });
                if (activeTool !== 'draw') setTool('move');
            }

            if (activeTool === 'eraser' && isInteracting.current) {
                addToHistory(items); // Save history after erase
                isInteracting.current = false;
            }

            // For dragging items, we need to know if we dragged.
            // handled in handleItemMouseDown's winUp?
            // Actually handleItemMouseDown is separate. 
            // We should hook into handleItemMouseDown to save history.
        };

        window.addEventListener('mouseup', handleGlobalUp);
        return () => window.removeEventListener('mouseup', handleGlobalUp);
    }, [selectionBox, isDrawing, items, activeTool]);

    // Update handleItemMouseDown to save history on drag end
    const handleItemMouseDown = (e: React.MouseEvent, id: string) => {
        if (e.button !== 0) return; // Only allow Left Drag
        if (activeTool !== 'move') return;
        e.stopPropagation();

        const isSelected = selectedItemIds.has(id);
        if (!e.shiftKey) {
            if (!isSelected) setSelectedItemIds(new Set([id]));
        } else {
            // shift select logic
            setSelectedItemIds(prev => {
                const n = new Set(prev);
                if (n.has(id)) n.delete(id); else n.add(id);
                return n;
            });
            return;
        }

        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const currentScale = scaleRef.current;
        const dragIds = isSelected ? Array.from(selectedItemIds) : [id];
        const initialPositions = new Map<string, { x: number, y: number }>();
        items.forEach(i => {
            if (dragIds.includes(i.id)) initialPositions.set(i.id, { x: i.x, y: i.y });
        });

        let hasMoved = false;

        const handleWinMove = (ev: MouseEvent) => {
            if (!hasMoved && (Math.abs(ev.clientX - startMouseX) > 2 || Math.abs(ev.clientY - startMouseY) > 2)) hasMoved = true;
            const dx = ev.clientX - startMouseX;
            const dy = ev.clientY - startMouseY;
            const s = currentScale;

            setItems(prev => prev.map(i => {
                if (initialPositions.has(i.id)) {
                    const start = initialPositions.get(i.id)!;
                    return { ...i, x: start.x + (dx / s), y: start.y + (dy / s) };
                }
                return i;
            }));
        };

        const handleWinUp = () => {
            window.removeEventListener('mousemove', handleWinMove);
            window.removeEventListener('mouseup', handleWinUp);
            if (hasMoved) {
                // Save history after drag completion
                setItems(current => {
                    addToHistory(current);
                    return current;
                });
            }
        };

        window.addEventListener('mousemove', handleWinMove);
        window.addEventListener('mouseup', handleWinUp);
    };

    const handleResizeMouseDown = (e: React.MouseEvent, id: string) => {
        if (e.button !== 0) return; // Only allow Left Resize
        e.stopPropagation();

        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const currentScale = scaleRef.current;

        const item = items.find(i => i.id === id);
        if (!item) return;

        const startWidth = item.width;
        const startHeight = item.height;

        const handleWinMove = (ev: MouseEvent) => {
            const dx = ev.clientX - startMouseX;
            const dy = ev.clientY - startMouseY;
            // Stickers ignore scale for resize delta visually, but logically we are in canvas space?
            // Actually, if visual size is fixed, 10px mouse move = 10px visual grow.
            // But in canvas units, that 10px visual grow is 10px * (1/scale) or 10px * scale?
            // If scale is 2 (zoomed in), 10px screen = 5px canvas.
            // Sticker is scaled by 0.5.
            // So if we add 5px canvas width, it adds 2.5px screen width. Incorrect.

            // To grow sticker by 10px SCREEN pixels:
            // scale is s_canvas. Sticker scale is 1/s_canvas.
            // Width_screen = Width_canvas * s_canvas * (1/s_canvas) = Width_canvas.
            // Wait, effective scale is 1.
            // So Width_canvas is essentially Width_screen.
            // So 10px mouse move should equal 10px canvas unit increase?
            // Let's assume 1:1 for now as effective scale is 1.
            // Stickers ignore scale for resize delta if fixed size is enabled
            const s = (item.type === 'sticker' && isStickyFixedSize) ? 1 : currentScale;

            setItems(prev => prev.map(i => i.id === id ? {
                ...i,
                width: Math.max(20, startWidth + (dx / s)),
                height: Math.max(20, startHeight + (dy / s))
            } : i));
        };

        const handleWinUp = () => {
            window.removeEventListener('mousemove', handleWinMove);
            window.removeEventListener('mouseup', handleWinUp);
            setItems(current => {
                addToHistory(current);
                return current;
            });
        };

        window.addEventListener('mousemove', handleWinMove);
        window.addEventListener('mouseup', handleWinUp);
    };
    // --- Render ---
    const renderItem = (item: CanvasItem) => {
        // Safety check for rendering
        if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) return null;

        const isSelected = selectedItemIds.has(item.id);

        // Disable pointer events if not in move mode
        const pointerEvents = activeTool === 'move' ? 'auto' : 'none';

        // Calculate Transform
        let transform = item.rotation ? `rotate(${item.rotation}deg)` : '';
        if (item.type === 'sticker' && isStickyFixedSize) {
            // Counter-scale using CSS variable updated via refs for performance
            transform += ` scale(var(--inv-scale, 1))`;
        }

        const style: React.CSSProperties = {
            pointerEvents,
            position: 'absolute',
            left: item.x,
            top: item.y,
            zIndex: item.zIndex,
            width: item.width,
            height: item.height,
            transform: transform || undefined,
            transformOrigin: '0 0',
            cursor: activeTool === 'move' ? 'grab' : 'crosshair'
        };

        if (item.width < 0) { style.left = item.x + item.width; style.width = Math.abs(item.width); }
        if (item.height < 0) { style.top = item.y + item.height; style.height = Math.abs(item.height); }

        const onMouseDown = (e: React.MouseEvent) => handleItemMouseDown(e, item.id);

        const controls = isSelected && activeTool === 'move' && (
            <>
                {item.type === 'sticker' && (
                    <div className="wb-item-controls-colors no-drag" onMouseDown={e => e.stopPropagation()}>
                        {STICKY_COLORS.map(color => (
                            <button
                                key={color}
                                className={`color-btn ${item.backgroundColor === color ? 'active' : ''}`}
                                style={{ backgroundColor: color }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setItems(p => {
                                        const newItems = p.map(x => x.id === item.id ? { ...x, backgroundColor: color } : x);
                                        addToHistory(newItems);
                                        return newItems;
                                    });
                                }}
                            />
                        ))}
                    </div>
                )}
                <div className="wb-item-controls no-drag" onMouseDown={e => e.stopPropagation()}>
                    <button className="del-btn" onMouseDown={(e) => {
                        e.stopPropagation();
                        setItems(p => {
                            const newItems = p.filter(x => x.id !== item.id);
                            addToHistory(newItems);
                            return newItems;
                        });
                    }}>
                        <Trash2 size={12} />
                    </button>
                </div>
                <div className="resize-handle br no-drag" onMouseDown={(e) => handleResizeMouseDown(e, item.id)} />
            </>
        );

        const content = (() => {
            switch (item.type) {
                case 'text':
                    return (
                        <textarea
                            value={item.content}
                            onChange={e => setItems(prev => prev.map(i => i.id === item.id ? { ...i, content: e.target.value } : i))}
                            placeholder="Type here..."
                            onMouseDown={(e) => {
                                // IMPORTANT: Allow bubbling to parent div so dragging works!
                                // Just ensure we select this item.
                                if (activeTool === 'move') {
                                    setSelectedItemIds(new Set([item.id]));
                                }
                                // e.stopPropagation();  <-- REMOVED THIS
                            }}
                        />
                    );
                case 'sticker':
                    return (
                        <textarea
                            className="sticker-text"
                            value={item.content}
                            onChange={e => setItems(prev => prev.map(i => i.id === item.id ? { ...i, content: e.target.value } : i))}
                            placeholder="Note..."
                            style={{ backgroundColor: item.backgroundColor, borderRadius: 'inherit' }}
                            onMouseDown={(e) => {
                                if (activeTool === 'move') setSelectedItemIds(new Set([item.id]));
                                // e.stopPropagation(); <-- REMOVED THIS
                            }}
                        />
                    );
                case 'image':
                    return <img src={item.content} draggable={false} alt="" style={{ pointerEvents: 'none' }} />;
                case 'rect':
                case 'circle': return null;
                default: return null;
            }
        })();

        const className = `wb-item ${item.type === 'text' ? 'text-item' : item.type === 'sticker' ? 'sticker-item' : item.type === 'image' ? 'image-item' : ''} ${item.type.includes('rect') ? 'wb-shape rect' : item.type.includes('circle') ? 'wb-shape circle' : ''} ${isSelected ? 'selected' : ''}`;

        // Vectors
        if (['line', 'arrow', 'draw'].includes(item.type)) {
            return (
                <svg key={item.id} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents, zIndex: item.zIndex }} onMouseDown={onMouseDown}>
                    <polyline
                        points={item.points?.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="3"
                        markerEnd={item.type === 'arrow' ? 'url(#arrowhead)' : undefined}
                        style={{ cursor: 'pointer' }}
                    />
                    {isSelected && (
                        <polyline points={item.points?.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#a78bfa" strokeWidth="1" strokeDasharray="4" style={{ pointerEvents: 'none' }} />
                    )}
                </svg>
            );
        }

        return (
            <div key={item.id} className={className} style={style} onMouseDown={onMouseDown}>
                {content}
                {controls}
            </div>
        );
    };

    // --- Context Menu State ---
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

    // --- Panning State (Middle Click) ---
    const [isPanning, setIsPanning] = useState(false);

    // --- Global Mouse Listeners for Middle Click & Panning ---
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 1) { // Middle Click
                e.preventDefault();
                setIsPanning(true);
            }
        };
        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 1) {
                setIsPanning(false);
            }
        };
        // Prevent default middle click scroll behavior
        const handleAuxClick = (e: MouseEvent) => {
            if (e.button === 1) e.preventDefault();
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('auxclick', handleAuxClick);
        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('auxclick', handleAuxClick);
        };
    }, []);

    // Close context menu on global click
    useEffect(() => {
        const closeMenu = () => {
            setContextMenu(null);
            setShowToolsMenu(false);
        }
        window.addEventListener('click', closeMenu);
        window.addEventListener('wheel', closeMenu);
        return () => {
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('wheel', closeMenu);
        };
    }, []);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    // --- Actions for Context Menu ---
    const handleDeleteSelected = () => {
        setItems(p => {
            const newItems = p.filter(i => !selectedItemIds.has(i.id));
            addToHistory(newItems);
            return newItems;
        });
        setSelectedItemIds(new Set());
        setContextMenu(null);
    };

    const handleDuplicateSelected = () => {
        const newItems: CanvasItem[] = [];
        const newIds = new Set<string>();

        items.forEach(item => {
            if (selectedItemIds.has(item.id)) {
                const newItem = { ...item, id: Date.now().toString() + Math.random(), x: item.x + 20, y: item.y + 20 };
                newItems.push(newItem);
                newIds.add(newItem.id);
            }
        });

        if (newItems.length > 0) {
            setItems(p => {
                const updated = [...p, ...newItems];
                addToHistory(updated);
                return updated;
            });
            setSelectedItemIds(newIds);
        }
        setContextMenu(null);
    };

    // --- Auto-Save ---
    useEffect(() => {
        // Save even if empty to reflect clears
        localStorage.setItem('wolfbrain_items', JSON.stringify(items));
    }, [items]);

    // --- Track Unsaved Changes ---
    useEffect(() => {
        // Use unformatted JSON for comparison to match what we store in lastSavedItems
        const currentState = JSON.stringify(items);
        setHasUnsavedChanges(currentState !== lastSavedItems.current);
    }, [items]);

    // --- Space Pan State ---
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpacePressed(e.type === 'keydown');
        };
        window.addEventListener('keydown', handleKey);
        window.addEventListener('keyup', handleKey);
        return () => {
            window.removeEventListener('keydown', handleKey);
            window.removeEventListener('keyup', handleKey);
        };
    }, []);


    // Zoom Controls State
    const [isZoomCollapsed, setIsZoomCollapsed] = useState(false);

    return (
        <div className="wolfbrain-window" onContextMenu={handleContextMenu}>
            {/* Unsaved Changes Dialog */}
            {showUnsavedDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100000,
                    backdropFilter: 'blur(4px)'
                }} className="no-drag" onClick={handleCancelClose}>
                    <div style={{
                        background: '#27272a',
                        border: '1px solid #3f3f46',
                        borderRadius: '12px',
                        padding: '24px',
                        minWidth: '400px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{
                            margin: '0 0 12px 0',
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#e4e4e7'
                        }}>Unsaved Changes</h3>
                        <p style={{
                            margin: '0 0 24px 0',
                            color: '#a1a1aa',
                            fontSize: '14px',
                            lineHeight: '1.5'
                        }}>
                            You have unsaved changes. Do you want to save before closing?
                        </p>
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={handleCancelClose}
                                style={{
                                    padding: '8px 16px',
                                    background: 'transparent',
                                    border: '1px solid #3f3f46',
                                    borderRadius: '6px',
                                    color: '#e4e4e7',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#3f3f46'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDiscardAndClose}
                                style={{
                                    padding: '8px 16px',
                                    background: 'transparent',
                                    border: '1px solid #ef4444',
                                    borderRadius: '6px',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#ef4444';
                                    e.currentTarget.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#ef4444';
                                }}
                            >
                                Don't Save
                            </button>
                            <button
                                onClick={handleSaveAndClose}
                                style={{
                                    padding: '8px 16px',
                                    background: '#8b5cf6',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#7c3aed'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#8b5cf6'}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Menu Render */}

            {contextMenu && (
                <div style={{
                    position: 'absolute',
                    top: contextMenu.y,
                    left: contextMenu.x,
                    background: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    padding: '4px',
                    zIndex: 99999,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    minWidth: '120px'
                }} className="no-drag" onMouseDown={e => e.stopPropagation()}>
                    <button
                        onClick={handleDeleteSelected}
                        style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '8px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
                        disabled={selectedItemIds.size === 0}
                    >
                        <Trash2 size={14} style={{ marginRight: 8 }} /> Delete
                    </button>
                    <button
                        onClick={handleDuplicateSelected}
                        style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '8px', background: 'transparent', border: 'none', color: '#e4e4e7', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
                        disabled={selectedItemIds.size === 0}
                    >
                        <FileText size={14} style={{ marginRight: 8 }} /> Duplicate
                    </button>
                </div>
            )}

            <div className="wb-header app-drag-region">
                <div className="wb-title">
                    <Brain size={18} className="text-accent" style={{ color: '#8b5cf6' }} />
                    <span style={{ opacity: 0.9, marginLeft: 8 }}>
                        {currentFilePath ? currentFilePath.split(/[/\\]/).pop()?.replace(/\.wolfbrain$/i, '') : 'Wolfbrain'}{hasUnsavedChanges && <span style={{ color: '#fbbf24', marginLeft: 4 }}>●</span>}
                    </span>
                </div>
                <div className="wb-toolbar no-drag">
                    <button onClick={handleUndo} title="Undo (Ctrl+Z)" disabled={historyStep <= 0}><RotateCcw size={18} /></button>
                    <button onClick={handleRedo} title="Redo (Ctrl+Shift+Z)" disabled={historyStep >= history.length - 1}><RotateCw size={18} /></button>
                    <div className="divider-v" />
                    <button className={`tool-btn ${activeTool === 'move' ? 'active' : ''}`} onClick={() => setTool('move')} title="Select (Middle Click to Pan)"><MousePointer size={18} /></button>
                    <div className="divider-v" />

                    {windowWidth >= 1000 ? (
                        <>
                            <button className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => setTool('text')} title="Text"><Type size={18} /></button>
                            <button className={`tool-btn ${activeTool === 'sticker' ? 'active' : ''}`} onClick={() => setTool('sticker')} title="Sticky Note"><StickyNote size={18} /></button>
                            <button className={`tool-btn ${activeTool === 'image' ? 'active' : ''}`} onClick={() => fileInputRef.current?.click()} title="Image"><ImageIcon size={18} /></button>
                            <div className="divider-v" />
                            <button className={`tool-btn ${activeTool === 'rect' ? 'active' : ''}`} onClick={() => setTool('rect')} title="Rectangle"><Square size={18} /></button>
                            <button className={`tool-btn ${activeTool === 'circle' ? 'active' : ''}`} onClick={() => setTool('circle')} title="Circle"><Circle size={18} /></button>
                            <button className={`tool-btn ${activeTool === 'line' ? 'active' : ''}`} onClick={() => setTool('line')} title="Line"><LineIcon size={18} /></button>
                            <button className={`tool-btn ${activeTool === 'arrow' ? 'active' : ''}`} onClick={() => setTool('arrow')} title="Arrow"><ArrowRight size={18} /></button>
                            <button className={`tool-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => setTool('draw')} title="Draw"><PenTool size={18} /></button>
                            <button className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="Eraser"><Eraser size={18} /></button>
                        </>
                    ) : (
                        <div style={{ position: 'relative' }}>
                            <button
                                className={`tool-btn ${['text', 'sticker', 'image', 'rect', 'circle', 'line', 'arrow', 'draw', 'eraser'].includes(activeTool) ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setShowToolsMenu(!showToolsMenu); }}
                                title="More Tools"
                            >
                                <MoreVertical size={18} />
                            </button>
                            {showToolsMenu && (
                                <div className="wb-popup-menu" style={{
                                    position: 'absolute',
                                    top: '120%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: '#27272a',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    padding: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                    zIndex: 10000
                                }} onMouseDown={e => e.stopPropagation()}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                                        <button className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => { setTool('text'); setShowToolsMenu(false); }} title="Text"><Type size={18} /></button>
                                        <button className={`tool-btn ${activeTool === 'sticker' ? 'active' : ''}`} onClick={() => { setTool('sticker'); setShowToolsMenu(false); }} title="Sticky Note"><StickyNote size={18} /></button>
                                        <button className={`tool-btn ${activeTool === 'image' ? 'active' : ''}`} onClick={() => { fileInputRef.current?.click(); setShowToolsMenu(false); }} title="Image"><ImageIcon size={18} /></button>
                                        <button className={`tool-btn ${activeTool === 'rect' ? 'active' : ''}`} onClick={() => { setTool('rect'); setShowToolsMenu(false); }} title="Rectangle"><Square size={18} /></button>
                                        <button className={`tool-btn ${activeTool === 'circle' ? 'active' : ''}`} onClick={() => { setTool('circle'); setShowToolsMenu(false); }} title="Circle"><Circle size={18} /></button>
                                        <button className={`tool-btn ${activeTool === 'line' ? 'active' : ''}`} onClick={() => { setTool('line'); setShowToolsMenu(false); }} title="Line"><LineIcon size={18} /></button>
                                        <button className={`tool-btn ${activeTool === 'arrow' ? 'active' : ''}`} onClick={() => { setTool('arrow'); setShowToolsMenu(false); }} title="Arrow"><ArrowRight size={18} /></button>
                                        <button className={`tool-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => { setTool('draw'); setShowToolsMenu(false); }} title="Draw"><PenTool size={18} /></button>
                                        <button className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`} onClick={() => { setTool('eraser'); setShowToolsMenu(false); }} title="Eraser"><Eraser size={18} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="wb-actions no-drag">
                    <button onClick={() => setIsStickyFixedSize(!isStickyFixedSize)} className={isStickyFixedSize ? 'active' : ''} title={isStickyFixedSize ? "Fixed Sticky Size: ON" : "Fixed Sticky Size: OFF"}>
                        {isStickyFixedSize ? <Lock size={18} /> : <Unlock size={18} />}
                    </button>
                    <button onClick={toggleAlwaysOnTop} className={isAlwaysOnTop ? 'active' : ''} title="Always On Top"><Pin size={18} /></button>
                    <button onClick={handleSaveWolfbrain} title="Save to Project"><Save size={18} /></button>
                    <button onClick={handleExportImage} title="Export Image"><Download size={18} /></button>
                    <div className="divider-v"></div>
                    <button onClick={handleMinimize} title="Minimize"><Minus size={18} /></button>
                    <button onClick={handleToggleMaximize} title="Maximize/Restore"><Maximize size={18} /></button>
                    <button onClick={handleClose} className="close-btn" title="Close"><X size={18} /></button>
                </div>
            </div>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => {
                if (e.target.files?.[0]) {
                    const r = new FileReader();
                    const f = e.target.files[0];
                    r.onload = ev => ev.target?.result && addImageItem(ev.target.result as string);
                    r.readAsDataURL(f);
                }
            }} />

            <div className="wb-canvas-container">
                <TransformWrapper
                    initialScale={1}
                    minScale={0.1}
                    maxScale={5}
                    limitToBounds={false}
                    // Disable Panning unless Space is held.
                    // This allows Left Drag to be used for Box Select and Drawing.
                    panning={{ disabled: !isPanning }}
                    doubleClick={{ disabled: true }} // Prevent double click zoom interfering
                    wheel={{ step: 0.1 }}
                    centerOnInit={true}
                    onTransformed={(e) => {
                        // Update CSS variable for high-perf counter-scaling without re-renders
                        if (canvasRef.current) {
                            scaleRef.current = e.state.scale;
                            canvasRef.current.style.setProperty('--inv-scale', (1 / e.state.scale).toString());
                        }
                    }}
                >
                    {({ zoomIn, zoomOut, resetTransform, setTransform, state }: any) => {
                        // Update scale ref
                        if (state && typeof state.scale === 'number') scaleRef.current = state.scale;

                        return (
                            <>
                                <div className={`zoom-controls no-drag ${isZoomCollapsed ? 'collapsed' : ''}`}>
                                    <div className="zoom-actions-wrapper">
                                        <button onClick={() => zoomIn()} title="Zoom In"><Plus size={14} /></button>
                                        <button onClick={() => zoomOut()} title="Zoom Out"><Minus size={14} /></button>
                                        <button onClick={() => {
                                            resetTransform();
                                        }} title="Reset to 100%">
                                            <span style={{ fontSize: '9px', fontWeight: 'bold' }}>100%</span>
                                        </button>
                                        <button onClick={() => {
                                            if (items.length === 0) {
                                                resetTransform();
                                                return;
                                            }
                                            // Calculate bounds
                                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                                            items.forEach(i => {
                                                minX = Math.min(minX, i.x);
                                                minY = Math.min(minY, i.y);
                                                maxX = Math.max(maxX, i.x + Math.abs(i.width || 0));
                                                maxY = Math.max(maxY, i.y + Math.abs(i.height || 0));
                                                if (i.points) {
                                                    i.points.forEach(p => {
                                                        minX = Math.min(minX, p.x);
                                                        minY = Math.min(minY, p.y);
                                                        maxX = Math.max(maxX, p.x);
                                                        maxY = Math.max(maxY, p.y);
                                                    });
                                                }
                                            });

                                            const padding = 50;
                                            const width = maxX - minX + (padding * 2);
                                            const height = maxY - minY + (padding * 2);
                                            const cx = minX + (maxX - minX) / 2;
                                            const cy = minY + (maxY - minY) / 2;

                                            if (width <= 0 || height <= 0) { resetTransform(); return; }

                                            const containerW = window.innerWidth;
                                            const containerH = window.innerHeight;

                                            const scaleX = containerW / width;
                                            const scaleY = containerH / height;
                                            let scale = Math.min(scaleX, scaleY);
                                            scale = Math.min(Math.max(scale, 0.1), 5); // Clamp

                                            const x = (containerW / 2) - (cx * scale);
                                            const y = (containerH / 2) - (cy * scale);

                                            setTransform(x, y, scale);
                                        }} title="Fit Screen"><Maximize2 size={14} /></button>
                                        <div className="divider-h" />
                                    </div>
                                    <button className="collapse-btn" onClick={() => setIsZoomCollapsed(!isZoomCollapsed)} title={isZoomCollapsed ? "Expand" : "Collapse"}>
                                        {isZoomCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                </div>
                                <TransformComponent
                                    wrapperStyle={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
                                // REMOVED manual transform override
                                >
                                    <div
                                        ref={canvasRef}
                                        className={`infinite-grid-surface ${activeTool !== 'move' ? 'crosshair' : ''}`}
                                        onMouseDown={handleCanvasMouseDown}
                                        onMouseMove={handleCanvasMouseMove}
                                        onMouseUp={() => { }}
                                    >
                                        {items.map(i => renderItem(i))}
                                        {/* Selection Box Render */}
                                        {selectionBox && (
                                            <div style={{
                                                position: 'absolute',
                                                left: Math.min(selectionBox.startX, selectionBox.currentX),
                                                top: Math.min(selectionBox.startY, selectionBox.currentY),
                                                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                                                height: Math.abs(selectionBox.currentY - selectionBox.startY),
                                                border: '1px solid #8b5cf6',
                                                background: 'rgba(139, 92, 246, 0.1)',
                                                pointerEvents: 'none',
                                                zIndex: 9999
                                            }} />
                                        )}
                                        {/* Markers Defs should be here once */}
                                        <svg width={0} height={0}>
                                            <defs>
                                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                                    <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
                                                </marker>
                                            </defs>
                                        </svg>
                                    </div>
                                </TransformComponent>
                            </>
                        )
                    }}
                </TransformWrapper>
            </div>
        </div>
    );
};

export default WolfbrainPage;
