import React, { useState, useMemo, useRef } from 'react';
import { Trash2, Plus, Check, Tag, Search, X } from 'lucide-react';
import '../styles/TodoList.css';

export type Priority = 'low' | 'medium' | 'high';

export interface TodoItem {
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
    priority?: Priority;
    tags?: string[];
}

interface TodoListProps {
    todos: TodoItem[];
    onAdd: (text: string, priority: Priority, tags: string[]) => void;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    availableVersions?: any[];
}

const TodoList: React.FC<TodoListProps> = ({ todos, onAdd, onToggle, onDelete, availableVersions }) => {
    const [inputValue, setInputValue] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed'>('all');
    const [newPriority, setNewPriority] = useState<Priority>('medium');
    const [newTags, setNewTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [isTagInputVisible, setIsTagInputVisible] = useState(false);

    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Track items pending deletion for animation
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInputValue(val);

        // Check for trigger char '@'
        const cursor = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursor);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1 && availableVersions && availableVersions.length > 0) {
            // Check if there's a space after the last @ before the cursor
            // If so, we might have cancelled the trigger or started a new word
            // Actually, we usually want to search for the query after @
            const query = textBeforeCursor.slice(lastAt + 1);
            if (!query.includes(' ')) {
                // We are currently typing a version query
                const matches = availableVersions.filter(v => {
                    const label = (v.label || '').toLowerCase();
                    const id = (v.id || '').toLowerCase();
                    const q = query.toLowerCase();
                    const index = availableVersions.indexOf(v);
                    const verNumVal = availableVersions.length - index;
                    return label.includes(q) || id.includes(q) || `v${verNumVal}`.includes(q);
                }).slice(0, 5);
                setSuggestions(matches);
                setShowSuggestions(true);
                return;
            }
        }
        setShowSuggestions(false);
    };

    const handleSelectVersion = (ver: any) => {
        const cursor = textareaRef.current?.selectionStart || inputValue.length;
        const textBeforeCursor = inputValue.slice(0, cursor);
        const textAfterCursor = inputValue.slice(cursor);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1) {
            // Insert format: @{ver:ID}
            // We use this format to be robust, though user sees it raw while typing.
            const insertText = `@{ver:${ver.id}} `;

            const newText = textBeforeCursor.slice(0, lastAt) + insertText + textAfterCursor;
            setInputValue(newText);
            setShowSuggestions(false);

            // Restore focus
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    const newCursorPos = lastAt + insertText.length;
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 10);
        }
    };

    const renderTodoText = (text: string) => {
        // Regex to match @{ver:ID}
        const regex = /@\{ver:([a-zA-Z0-9-_]+)\}/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Push preceding text
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            const verId = match[1];
            // Resolve version info
            let label = `v:${verId.substring(0, 4)}`;
            if (availableVersions) {
                const ver = availableVersions.find(v => v.id === verId);
                if (ver) {
                    const index = availableVersions.indexOf(ver);
                    const verNum = availableVersions.length - index;

                    // User requested "only version name"
                    if (ver.label) {
                        label = ver.label;
                    } else {
                        label = `v${verNum}`;
                    }
                }
            }

            parts.push(
                <span key={match.index} className="version-tag" title={`Version ID: ${verId}`}>
                    {label}
                </span>
            );

            lastIndex = regex.lastIndex;
        }

        // Push remaining text
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts.length > 0 ? parts : text;
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (inputValue.trim()) {
            onAdd(inputValue, newPriority, newTags);
            setInputValue('');
            setNewTags([]);
            setNewPriority('medium');
            setIsTagInputVisible(false);
            setShowSuggestions(false);
        }
    };

    const handleAddTag = () => {
        if (tagInput.trim() && !newTags.includes(tagInput.trim())) {
            setNewTags([...newTags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setNewTags(newTags.filter(t => t !== tagToRemove));
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingIds(prev => new Set(prev).add(id));
        setTimeout(() => {
            onDelete(id);
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }, 300);
    };

    const filteredTodos = useMemo(() => {
        return todos.filter(todo => {
            const matchesSearch = todo.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                todo.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesFilter = activeFilter === 'all'
                ? true
                : activeFilter === 'active'
                    ? !todo.completed
                    : todo.completed;
            return matchesSearch && matchesFilter;
        }).sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const pMap = { high: 3, medium: 2, low: 1 };
            const pA = pMap[a.priority || 'medium'];
            const pB = pMap[b.priority || 'medium'];
            if (pA !== pB) return pB - pA;
            return b.createdAt - a.createdAt;
        });
    }, [todos, searchQuery, activeFilter]);

    const getPriorityColor = (p?: Priority) => {
        switch (p) {
            case 'high': return '#ff4d4d';
            case 'medium': return '#ffcc00';
            case 'low': return '#6e7bf2';
            default: return '#6e7bf2';
        }
    };

    return (
        <div className="todo-container">

            {/* Controls Header */}
            <div className="controls-header">
                <div className="search-wrapper">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    <Search size={14} className="search-icon" />
                </div>

                <div className="filter-group">
                    {(['all', 'active', 'completed'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setActiveFilter(f)}
                            className={`filter-btn ${activeFilter === f ? 'active' : ''}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Input Section */}
            <div className="input-section">
                <div className="input-row-main">
                    <textarea
                        ref={textareaRef} // Attach ref here
                        placeholder="What needs to be done?"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                                e.currentTarget.style.height = 'auto';
                            }
                        }}
                        onInput={(e) => {
                            const target = e.currentTarget;
                            target.style.height = 'auto';
                            target.style.height = target.scrollHeight + 'px';
                        }}
                        className="main-input"
                        rows={1}
                    />
                    <button
                        onClick={() => handleSubmit()}
                        className="add-btn"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {/* Meta Inputs */}
                <div className="meta-inputs">
                    {/* Priority Selector */}
                    <div className="priority-selector">
                        {(['low', 'medium', 'high'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setNewPriority(p)}
                                title={`Priority: ${p}`}
                                className={`priority-btn ${newPriority === p ? 'active' : ''}`}
                            >
                                <div
                                    className="priority-dot"
                                    style={{
                                        background: getPriorityColor(p),
                                        opacity: newPriority === p ? 1 : 0.3
                                    }}
                                />
                            </button>
                        ))}
                    </div>

                    {/* Tag Trigger */}
                    <button
                        onClick={() => setIsTagInputVisible(!isTagInputVisible)}
                        className={`tag-trigger-btn ${isTagInputVisible ? 'active' : ''}`}
                    >
                        <Tag size={14} /> {newTags.length > 0 ? `${newTags.length} tags` : 'Tags'}
                    </button>

                    {/* Active Tags Display in Input */}
                    <div className="active-tags-list">
                        {newTags.map(tag => (
                            <span key={tag} className="tag-badge">
                                {tag}
                                <X size={10} className="tag-remove-icon" onClick={() => removeTag(tag)} />
                            </span>
                        ))}
                    </div>
                </div>

                {/* Tag Input Expandable */}
                <div className={`tag-input-container ${isTagInputVisible ? 'visible' : ''}`}>
                    <div className="tag-input-wrapper">
                        <input
                            type="text"
                            placeholder="Type tag & press enter"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                            className="tag-input"
                        />
                    </div>
                </div>
                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="todo-suggestions">
                        {suggestions.map((ver, idx) => (
                            <div
                                key={ver.id}
                                className={`suggestion-item ${idx === 0 ? 'active' : ''}`}
                                onClick={() => handleSelectVersion(ver)}
                            >
                                <span className="suggestion-label">
                                    {ver.label || `Version ${availableVersions ? `v${availableVersions.length - availableVersions.indexOf(ver)}` : ''}`}
                                </span>
                                <div className="suggestion-meta">
                                    <span>{new Date(ver.timestamp).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>{ver.id.substring(0, 7)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* List Section */}
            <div className="todo-list">
                {filteredTodos.length === 0 && (
                    <div className="empty-state fade-in">
                        {searchQuery ? 'No matches found.' : 'No tasks found.'}
                    </div>
                )}

                {filteredTodos.map((todo) => (
                    <div
                        key={todo.id}
                        className={`todo-item slide-in ${deletingIds.has(todo.id) ? 'slide-out' : ''}`}
                        style={{ borderLeft: `3px solid ${getPriorityColor(todo.priority)}` }}
                    >
                        {/* Checkbox */}
                        <button
                            onClick={() => onToggle(todo.id)}
                            className={`checkbox-btn ${todo.completed ? 'checked' : ''}`}
                        >
                            {todo.completed && <Check size={12} color="white" strokeWidth={3} />}
                        </button>

                        {/* Content */}
                        <div className="todo-content">
                            <div
                                onClick={() => onToggle(todo.id)}
                                className={`todo-text ${todo.completed ? 'completed' : ''} ${todo.tags && todo.tags.length > 0 ? 'has-tags' : ''}`}
                                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                            >
                                {typeof todo.text === 'string' ? renderTodoText(todo.text) : todo.text}
                            </div>

                            {todo.tags && todo.tags.length > 0 && (
                                <div className="item-tags">
                                    {todo.tags.map((tag, idx) => (
                                        <span key={idx} className="item-tag">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Delete Button */}
                        <button
                            onClick={(e) => handleDelete(todo.id, e)}
                            className="delete-btn"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TodoList;
