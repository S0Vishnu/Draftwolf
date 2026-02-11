import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import CustomPopup from '../components/CustomPopup';
import { Settings as SettingsIcon, Save, ChevronLeft, FolderOpen, HardDrive } from 'lucide-react';
import '../styles/AppLayout.css';
import '../styles/Settings.css';

const ProjectSettings: React.FC = () => {
    const [user] = useAuthState(auth);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const projectPath = searchParams.get('path');
    
    // State for local storage data
    const [pinnedFolders, setPinnedFolders] = useState<{ path: string, name: string, color?: string }[]>([]);
    const [recentWorkspaces, setRecentWorkspaces] = useState<{ path: string, name: string }[]>([]);
    const [backupPath, setBackupPath] = useState<string>('');
    const [deletePopupOpen, setDeletePopupOpen] = useState(false);

    useEffect(() => {
        const pinned = JSON.parse(localStorage.getItem('pinnedFolders') || '[]');
        const recents = JSON.parse(localStorage.getItem('recentWorkspaces') || '[]');
        setPinnedFolders(pinned);
        setRecentWorkspaces(recents);

        // Get backup path from pinned or recent
        const pinnedFolder = pinned.find((f: any) => f.path === projectPath);
        const recentFolder = recents.find((r: any) => r.path === projectPath);
        setBackupPath(pinnedFolder?.backupPath || recentFolder?.backupPath || '');

        const folder = pinnedFolder;
        if (folder) {
            setSettings({
                projectName: folder.name,
                color: folder.color || '#3b82f6',
                isPinned: true,
                showHiddenFiles: folder.showHiddenFiles ?? (localStorage.getItem('showHiddenFiles') === 'true'),
                showExtensions: folder.showExtensions ?? (localStorage.getItem('showExtensions') !== 'false')
            });
        } else {
            setSettings({
                projectName: recentFolder?.name || projectPath?.split(/[\\/]/).pop() || 'Project',
                color: '#3b82f6',
                isPinned: false,
                showHiddenFiles: localStorage.getItem('showHiddenFiles') === 'true',
                showExtensions: localStorage.getItem('showExtensions') !== 'false'
            });
        }
    }, [projectPath]);

    const [settings, setSettings] = useState({
        projectName: '',
        color: '#3b82f6',
        isPinned: false,
        showHiddenFiles: false,
        showExtensions: true
    });

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const handleBack = () => navigate('/home');

    const handleSave = () => {
        // Update Pinned Folders
        let updatedPinned = [...pinnedFolders];
        if (settings.isPinned) {
            const index = updatedPinned.findIndex(f => f.path === projectPath);
            const folderData = { 
                path: projectPath || '', 
                name: settings.projectName, 
                color: settings.color,
                showHiddenFiles: settings.showHiddenFiles,
                showExtensions: settings.showExtensions
            };
            if (index !== -1) {
                updatedPinned[index] = folderData;
            } else if (projectPath) {
                updatedPinned.push(folderData);
            }
        } else {
            updatedPinned = updatedPinned.filter(f => f.path !== projectPath);
        }
        localStorage.setItem('pinnedFolders', JSON.stringify(updatedPinned));

        // Update Recent Workspaces
        const updatedRecents = recentWorkspaces.map(r => 
            r.path === projectPath ? { ...r, name: settings.projectName } : r
        );
        localStorage.setItem('recentWorkspaces', JSON.stringify(updatedRecents));
        
        toast.success('Project settings saved');
        navigate('/home');
    };

    const handleDelete = () => {
        setDeletePopupOpen(true);
    };

    const confirmDelete = () => {
        const updatedPinned = pinnedFolders.filter(f => f.path !== projectPath);
        const updatedRecents = recentWorkspaces.filter(r => r.path !== projectPath);
        localStorage.setItem('pinnedFolders', JSON.stringify(updatedPinned));
        localStorage.setItem('recentWorkspaces', JSON.stringify(updatedRecents));
        setDeletePopupOpen(false);
        navigate('/home');
    };

    return (
        <div className="app-shell">
            <Sidebar 
                isOpen={isSidebarOpen} 
                user={user} 
                pinnedFolders={pinnedFolders}
                activePath={projectPath}
                onSelectProject={(path) => navigate(`/project-settings?path=${encodeURIComponent(path)}`)}
            />
            
            <main className="main-content">
                <Header 
                    isSidebarOpen={isSidebarOpen} 
                    toggleSidebar={toggleSidebar}
                />

                <div className="toolbar">
                    <div className="path-breadcrumbs">
                        <button className="nav-btn" onClick={handleBack} title="Back to Home">
                            <ChevronLeft size={18} />
                        </button>
                        <div className="divider-v" />
                        <div className="breadcrumbs-list">
                            <span className="crumb-home">Projects</span>
                            <span className="crumb-sep">/</span>
                            <span className="crumb-part">{settings.projectName}</span>
                            <span className="crumb-sep">/</span>
                            <span className="crumb-part" style={{ color: 'var(--accent)' }}>Settings</span>
                        </div>
                    </div>
                </div>

                <div className="content-area" style={{ padding: '40px' }}>
                    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
                        <header style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ 
                                width: '56px', 
                                height: '56px', 
                                borderRadius: '16px', 
                                background: `linear-gradient(135deg, ${settings.color}22, ${settings.color}11)`, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                border: `1px solid ${settings.color}33`,
                                boxShadow: `0 4px 12px ${settings.color}11`
                            }}>
                                <SettingsIcon size={28} color={settings.color} />
                            </div>
                            <div>
                                <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: 'white' }}>
                                    {settings.projectName}
                                </h1>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px', opacity: 0.8 }}>
                                    Configuration & Project Identity
                                </p>
                            </div>
                        </header>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* General Section */}
                            <section className="settings-section">
                                <div className="section-header">
                                    <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, opacity: 0.9 }}>Appearance & Identity</h2>
                                </div>
                                <div className="section-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <label htmlFor="project-name-input" style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>Project Name</label>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>How this project appears in your sidebar and recent list.</p>
                                        </div>
                                        <input 
                                            id="project-name-input"
                                            type="text" 
                                            className="input-styled" 
                                            style={{ 
                                                width: '100%', 
                                                margin: 0, 
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid var(--border)',
                                                height: '42px',
                                                padding: '0 16px',
                                                borderRadius: '10px',
                                                fontSize: '14px',
                                                color: 'white'
                                            }}
                                            value={settings.projectName}
                                            onChange={(e) => setSettings({...settings, projectName: e.target.value})}
                                        />
                                    </div>

                                    <div className="setting-row">
                                        <span style={{ fontWeight: 600, display: 'block', marginBottom: '12px' }}>Project Color</span>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#6366f1'].map(c => (
                                                <button 
                                                    key={c}
                                                    onClick={() => setSettings({...settings, color: c})}
                                                    style={{ 
                                                        width: '32px', 
                                                        height: '32px', 
                                                        borderRadius: '8px', 
                                                        background: c,
                                                        border: settings.color === c ? '2px solid white' : 'none',
                                                        cursor: 'pointer',
                                                        transition: 'transform 0.2s',
                                                        boxShadow: settings.color === c ? `0 0 10px ${c}` : 'none'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                        <div>
                                            <label htmlFor="pin-toggle" style={{ fontWeight: 600 }}>Pin to Sidebar</label>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keep this project accessible in the PROJECTS section.</p>
                                        </div>
                                        <input 
                                            id="pin-toggle"
                                            type="checkbox" 
                                            checked={settings.isPinned}
                                            onChange={(e) => setSettings({...settings, isPinned: e.target.checked})}
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Preferences Section */}
                            <section className="settings-section">
                                <div className="section-header">
                                    <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, opacity: 0.9 }}>Project Preferences</h2>
                                </div>
                                <div className="section-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <label htmlFor="pref-hidden" style={{ fontWeight: 600 }}>Show Hidden Files</label>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Show files starting with a dot (e.g. .env, .git)</p>
                                        </div>
                                        <input 
                                            id="pref-hidden"
                                            type="checkbox" 
                                            checked={settings.showHiddenFiles}
                                            onChange={(e) => setSettings({...settings, showHiddenFiles: e.target.checked})}
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                        <div>
                                            <label htmlFor="pref-ext" style={{ fontWeight: 600 }}>Show File Extensions</label>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Always display full file extensions</p>
                                        </div>
                                        <input 
                                            id="pref-ext"
                                            type="checkbox" 
                                            checked={settings.showExtensions}
                                            onChange={(e) => setSettings({...settings, showExtensions: e.target.checked})}
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Storage & Paths Section */}
                            <section className="settings-section">
                                <div className="section-header">
                                    <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, opacity: 0.9 }}>Storage & Paths</h2>
                                </div>
                                <div className="section-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="setting-row">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <FolderOpen size={16} color="#6e7bf2" />
                                            <label style={{ fontWeight: 600 }}>Backup Location</label>
                                        </div>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Where project backups are stored. Set during first open.</p>
                                        <div style={{
                                            padding: '10px 14px',
                                            background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: '10px',
                                            fontSize: '13px',
                                            color: backupPath ? 'var(--text-secondary, #d4d4d8)' : 'var(--text-muted)',
                                            wordBreak: 'break-all' as const,
                                            opacity: 0.9
                                        }}>
                                            {backupPath || 'Not configured'}
                                        </div>
                                    </div>

                                    <div className="setting-row" style={{ paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <HardDrive size={16} color="#a1a1aa" />
                                            <label style={{ fontWeight: 600 }}>.draft Folder</label>
                                        </div>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Internal version data is stored here.</p>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '10px 14px',
                                            background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: '10px',
                                            fontSize: '13px',
                                            color: 'var(--text-muted)',
                                            userSelect: 'none' as const
                                        }}>
                                            <span style={{ color: 'var(--text-secondary, #d4d4d8)' }}>{settings.projectName || 'Project Root'}</span>
                                            <span style={{ opacity: 0.4 }}>/</span>
                                            <span style={{ opacity: 0.6, fontFamily: 'monospace' }}>.draft</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Danger Zone */}
                            <section style={{ border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', overflow: 'hidden' }}>
                                <div style={{ padding: '16px 20px', background: 'rgba(239, 68, 68, 0.05)', borderBottom: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                    <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#ef4444', margin: 0 }}>Danger Zone</h2>
                                </div>
                                <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Remove Project</h3>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>This will remove the project from your lists. Files on disk will NOT be deleted.</p>
                                    </div>
                                    <button 
                                        onClick={handleDelete}
                                        style={{ 
                                            padding: '8px 16px', 
                                            borderRadius: '8px', 
                                            border: '1px solid #ef4444', 
                                            background: 'transparent', 
                                            color: '#ef4444', 
                                            fontSize: '13px', 
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Remove Reference
                                    </button>
                                </div>
                            </section>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', paddingBottom: '40px' }}>
                                <button className="action-btn" style={{ padding: '10px 24px' }} onClick={handleBack}>Cancel</button>
                                <button className="primary-btn" style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={handleSave}>
                                    <Save size={18} />
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <CustomPopup
                isOpen={deletePopupOpen}
                title="Remove Project"
                message="Remove this project from recents and pinned folders? Files on disk will NOT be deleted."
                confirmText="Remove"
                cancelText="Cancel"
                isDangerous={true}
                onConfirm={confirmDelete}
                onCancel={() => setDeletePopupOpen(false)}
            />
        </div>
    );
};

export default ProjectSettings;
