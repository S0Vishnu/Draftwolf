import React, { useState, useEffect } from 'react';
import { File, Folder, Brain } from 'lucide-react';

interface FileIconProps {
    name: string;
    path?: string;
    isDirectory: boolean;
    size?: number;
    className?: string;
}

const getFileColor = (ext: string): string => {
    switch (ext) {
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'svg':
            return '#4facfe'; // Cyan-Blue for images
        case 'blend':
            return '#e69c45'; // Blender Orange
        case 'gltf':
        case 'glb':
        case 'obj':
        case 'fbx':
            return '#00f2fe'; // Cyan for 3D
        case 'js':
        case 'ts':
        case 'tsx':
        case 'jsx':
        case 'json':
            return '#F0DB4F'; // JS Yellow
        case 'html':
            return '#E44D26'; // HTML Orange
        case 'css':
            return '#264de4'; // CSS Blue
        case 'py':
            return '#ffd54f'; // Python Yellow
        case 'md':
        case 'txt':
            return '#a0a0a0'; // Grey
        case 'zip':
        case 'rar':
        case '7z':
            return '#ffb74d'; // Archive Orange
        case 'wolfbrain':
            return '#8b5cf6'; // Wolfbrain Purple
        default:
            return '#4facfe'; // Default Cyan-Blue
    }
};

const FileIcon: React.FC<FileIconProps> = ({ name, path, isDirectory, size = 32, className = '' }) => {
    // Determine extension
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const [iconUrl, setIconUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        // Fetch native icon for specific types (Blender, Executables, Shortcuts)
        if (!isDirectory && path && (ext === 'blend' || ext === 'exe' || ext === 'lnk' || ext === 'blend1')) {
            window.api.getFileIcon(path).then(url => {
                if (isMounted && url) setIconUrl(url);
            }).catch(err => {
                console.error("Failed to load icon for", path, err);
            });
        }
        return () => { isMounted = false; };
    }, [path, ext, isDirectory]);

    if (isDirectory) {
        return (
            <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={className}>
                <Folder size={size} color="#FFC107" fill="#FFC107" fillOpacity={0.2} strokeWidth={1.5} />
            </div>
        );
    }

    if (iconUrl) {
        return (
            <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={className}>
                <img src={iconUrl} style={{ width: size, height: size, objectFit: 'contain' }} alt={name} />
            </div>
        );
    }

    const color = getFileColor(ext);

    // Special render for Wolfbrain
    if (ext === 'wolfbrain') {
        return (
            <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={className}>
                <File size={size} color={color} strokeWidth={1.5} />
                <div style={{
                    position: 'absolute',
                    top: '55%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Brain size={size * 0.45} color={color} strokeWidth={2} />
                </div>
            </div>
        );
    }

    // Calculate font size relative to icon size
    const fontSize = Math.max(8, Math.round(size * 0.16));

    return (
        <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={className}>
            <File size={size} color={color} strokeWidth={1.5} />
            <span style={{
                position: 'absolute',
                top: '55%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                color: color,
                textTransform: 'uppercase',
                maxWidth: '80%',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                letterSpacing: '-0.5px'
            }}>
                {ext.slice(0, 4)}
            </span>
        </div>
    );
};

export default FileIcon;
