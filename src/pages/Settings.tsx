import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Session } from '@supabase/supabase-js';
import Sidebar from '../components/Sidebar';
import {
    LogOut, User, Clock, Shield,
    Edit2, X, Check, Coffee, Monitor, Bell
} from 'lucide-react';
import { toast } from 'react-toastify';

import '../styles/Settings.css';

interface UserSettings {
    bio: string;
    dndEnabled: boolean;
    dndStart: string;
    dndEnd: string;
    notificationsEnabled: boolean;
    checkUpdates: boolean;
    fileMonitoringEnabled: boolean;
    changeNotificationInterval: number;
}

const Settings = () => {
    const [session, setSession] = useState<Session | null>(null);
    const user = session?.user;
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('isSidebarOpen') !== 'false');
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [appVersion, setAppVersion] = useState("1.1.7"); // Default fallback

    // Initial default settings
    const defaultSettings: UserSettings = {
        bio: '',
        dndEnabled: false,
        dndStart: '22:00',
        dndEnd: '08:00',
        notificationsEnabled: true,
        checkUpdates: true,
        fileMonitoringEnabled: true,
        changeNotificationInterval: 30,
    };

    const [settings, setSettings] = useState<UserSettings>(defaultSettings);
    // Backup for reverting changes on Cancel
    const [initialSettings, setInitialSettings] = useState<UserSettings>(defaultSettings);

    // Display Name State
    const [displayName, setDisplayName] = useState('');
    const [initialDisplayName, setInitialDisplayName] = useState('');

    // Load initial data
    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
        setDisplayName(name);
        setInitialDisplayName(name);

        // Get App Version
        if ((globalThis as any)?.api?.getAppVersion) {
            (globalThis as any).api.getAppVersion().then((v: string) => setAppVersion(v));
        }

        // Load from LocalStorage for preferences
        const saved = localStorage.getItem(`user_settings_${user.id}`);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                setSettings({ ...defaultSettings, ...data });
                setInitialSettings({ ...defaultSettings, ...data });
            } catch (e) {
                console.error("Failed to parse cached settings:", e);
            }
        }
    }, [user]);

    // Handle Profile Save
    const saveProfile = async () => {
        if (!user) return;

        setLoading(true);
        try {
            // Update Supabase Auth Metadata (Simplified for now)
            const { error } = await supabase.auth.updateUser({
                data: { full_name: displayName }
            });

            if (error) throw error;

            setInitialDisplayName(displayName);

            // Update Local Storage for preferences (bio/seed)
            localStorage.setItem(`user_settings_${user.id}`, JSON.stringify(settings));
            setInitialSettings(settings);

            setIsEditing(false);
            toast.success('Profile updated successfully');

        } catch (error: any) {
            console.error("Save error:", error);
            toast.error(`Failed to save profile: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const cancelEdit = () => {
        setDisplayName(initialDisplayName);
        setSettings(prev => ({
            ...prev,
            bio: initialSettings.bio
        }));
        setIsEditing(false);
    };

    // Auto-save Preferences
    const updatePreference = async (key: keyof UserSettings, value: any) => {
        if (!user) return;

        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        setInitialSettings(prev => ({ ...prev, [key]: value }));

        try {
            // Since we're removing Firestore, we only cache locally for now.
            // In a real app, you'd save this to a Supabase table.
            localStorage.setItem(`user_settings_${user.id}`, JSON.stringify(newSettings));
        } catch (error) {
            console.error("Failed to save preference:", error);
        }
    };

    const handleSignOut = async () => {
        try {
            // Clear Electron Main Process Auth
            if ((globalThis as any)?.api?.auth) {
                await (globalThis as any).api.auth.logout();
            }
            await supabase.auth.signOut();
            navigate('/');
        } catch (error) {
            console.error("Error signing out:", error);
            toast.error("Failed to sign out");
        }
    };

    // Determine Avatar URL for display
    const avatarUrl = user?.user_metadata?.avatar_url || user?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.email || 'DW'}`;

    return (
        <div className="settings-container">
            <div className="app-inner" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
                <Sidebar
                    isOpen={isSidebarOpen}
                    toggleSidebar={() => {
                        const newState = !isSidebarOpen;
                        setIsSidebarOpen(newState);
                        localStorage.setItem('isSidebarOpen', String(newState));
                    }}
                    user={user as any}
                />

                <main className="settings-content">
                    <header className="settings-header">
                        <h1>Settings</h1>
                        <p>Manage your account preferences and application settings.</p>
                    </header>

                    <div className="settings-grid">

                        {/* LEFT COLUMN: Profile & Identity */}
                        <div className="glass-panel">
                            <div className="panel-header">
                                <h2 className="panel-title">
                                    <User size={20} className="text-accent" style={{ color: '#3b82f6' }} />
                                    Identity
                                </h2>
                            </div>

                            <div className="profile-section">
                                <div className="avatar-container">
                                    <div className="avatar-ring"></div>
                                    <img src={avatarUrl} alt="Avatar" className="avatar-img" referrerPolicy="no-referrer" />
                                </div>

                                {isEditing ? (
                                    <div style={{ width: '100%' }}>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="settings-display-name">Display Name</label>
                                            <input
                                                id="settings-display-name"
                                                type="text"
                                                value={displayName}
                                                onChange={e => setDisplayName(e.target.value)}
                                                className="input-styled"
                                                placeholder="Your Name"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="settings-bio">Bio</label>
                                            <textarea
                                                id="settings-bio"
                                                value={settings.bio}
                                                onChange={e => setSettings({ ...settings, bio: e.target.value })}
                                                className="input-styled"
                                                placeholder="Tell us about yourself..."
                                            />
                                        </div>

                                        <div className="edit-actions">
                                            <button onClick={cancelEdit} className="btn-cancel">
                                                <X size={18} /> Cancel
                                            </button>
                                            <button onClick={saveProfile} disabled={loading} className="btn-save">
                                                <Check size={18} /> {loading ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="user-info-display">
                                        <h3 className="user-name">{displayName || 'User'}</h3>
                                        <p className="user-bio">{settings.bio || 'Digital Artist & DraftWolf User'}</p>

                                        <button onClick={() => setIsEditing(true)} className="btn-edit-profile">
                                            <Edit2 size={16} /> Edit Profile
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="support-card">
                                <Coffee size={24} color="#FFDD00" style={{ marginBottom: '0.5rem' }} />
                                <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Support Development</h3>
                                <p style={{ fontSize: '0.85rem', margin: 0, opacity: 0.8 }}>Love using DraftWolf? Consider buying me a coffee to keep the updates coming!</p>
                                <a href="https://www.buymeacoffee.com/s0vishnu" target="_blank" rel="noopener noreferrer" className="btn-coffee">
                                    <Coffee size={16} fill="black" /> Buy Me a Coffee
                                </a>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Settings Lists */}
                        <div className="settings-list-container">

                            {/* Extensions */}


                            {/* App Preferences */}
                            <div className="glass-panel" style={{ marginBottom: '2rem' }}>
                                <div className="panel-header">
                                    <h2 className="panel-title">
                                        <Monitor size={20} className="text-accent" style={{ color: '#eab308' }} />
                                        App Preferences
                                    </h2>
                                </div>

                                <div className="settings-list">
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <h3>Push Notifications</h3>
                                            <p>Receive desktop notifications for important updates.</p>
                                        </div>
                                        <label className="toggle-switch" aria-label="Push Notifications">
                                            <input
                                                type="checkbox"
                                                checked={settings.notificationsEnabled}
                                                onChange={e => updatePreference('notificationsEnabled', e.target.checked)}
                                                className="toggle-input"
                                            />
                                            <span className="toggle-slider"><span className="toggle-knob"></span></span>
                                        </label>
                                    </div>

                                    <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div className="setting-info">
                                                <h3>Do Not Disturb</h3>
                                                <p>Suppress notifications during specific hours.</p>
                                            </div>
                                            <label className="toggle-switch" aria-label="Do Not Disturb">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.dndEnabled}
                                                    onChange={e => updatePreference('dndEnabled', e.target.checked)}
                                                    className="toggle-input"
                                                />
                                                <span className="toggle-slider"><span className="toggle-knob"></span></span>
                                            </label>
                                        </div>

                                        {settings.dndEnabled && (
                                            <div className="dnd-settings" style={{ width: '100%' }}>
                                                <div className="dnd-inputs">
                                                    <div className="time-wrapper">
                                                        <Clock size={14} className="text-muted" />
                                                        <input
                                                            aria-label="Do Not Disturb Start Time"
                                                            type="time"
                                                            value={settings.dndStart}
                                                            onChange={e => updatePreference('dndStart', e.target.value)}
                                                            className="time-input"
                                                        />
                                                    </div>
                                                    <span style={{ opacity: 0.5 }}>to</span>
                                                    <div className="time-wrapper">
                                                        <Clock size={14} className="text-muted" />
                                                        <input
                                                            aria-label="Do Not Disturb End Time"
                                                            type="time"
                                                            value={settings.dndEnd}
                                                            onChange={e => updatePreference('dndEnd', e.target.value)}
                                                            className="time-input"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <h3>Automatic Updates</h3>
                                            <p>Check for the latest version on launch.</p>
                                        </div>
                                        <label className="toggle-switch" aria-label="Automatic Updates">
                                            <input
                                                type="checkbox"
                                                checked={settings.checkUpdates ?? true}
                                                onChange={e => updatePreference('checkUpdates', e.target.checked)}
                                                className="toggle-input"
                                            />
                                            <span className="toggle-slider"><span className="toggle-knob"></span></span>
                                        </label>
                                    </div>


                                </div>
                            </div>

                            {/* File Monitoring */}
                            <div className="glass-panel" style={{ marginBottom: '2rem' }}>
                                <div className="panel-header">
                                    <h2 className="panel-title">
                                        <Bell size={20} className="text-accent" style={{ color: '#8b5cf6' }} />
                                        File Monitoring
                                    </h2>
                                </div>

                                <div className="settings-list">
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <h3>Background Monitoring</h3>
                                            <p>Watch workspace files for changes and send OS notifications periodically.</p>
                                        </div>
                                        <label className="toggle-switch" aria-label="Background File Monitoring">
                                            <input
                                                type="checkbox"
                                                checked={settings.fileMonitoringEnabled ?? true}
                                                onChange={e => {
                                                    updatePreference('fileMonitoringEnabled', e.target.checked);
                                                    // Sync to main process
                                                    if ((globalThis as any)?.api?.monitor) {
                                                        (globalThis as any).api.monitor.updateSettings(
                                                            settings.changeNotificationInterval || 30,
                                                            e.target.checked
                                                        );
                                                    }
                                                }}
                                                className="toggle-input"
                                            />
                                            <span className="toggle-slider"><span className="toggle-knob"></span></span>
                                        </label>
                                    </div>

                                    {(settings.fileMonitoringEnabled ?? true) && (() => {
                                        const interval = settings.changeNotificationInterval || 30;
                                        const formatTime = (mins: number) => {
                                            if (mins < 60) return `${mins} min`;
                                            const h = Math.floor(mins / 60);
                                            const m = mins % 60;
                                            return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
                                        };
                                        const presets = [
                                            { label: '15m', value: 15 },
                                            { label: '30m', value: 30 },
                                            { label: '1h', value: 60 },
                                            { label: '2h', value: 120 },
                                        ];
                                        const setInterval = (val: number) => {
                                            updatePreference('changeNotificationInterval', val);
                                            if ((globalThis as any)?.api?.monitor) {
                                                (globalThis as any).api.monitor.updateSettings(val, settings.fileMonitoringEnabled ?? true);
                                            }
                                        };
                                        return (
                                            <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                                <div className="setting-info" style={{ width: '100%', marginBottom: '0.75rem' }}>
                                                    <h3>Notification Interval</h3>
                                                    <p>How often to check for file changes and notify you.</p>
                                                </div>

                                                {/* Preset buttons */}
                                                <div style={{
                                                    display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', width: '100%'
                                                }}>
                                                    {presets.map(p => (
                                                        <button
                                                            key={p.value}
                                                            onClick={() => setInterval(p.value)}
                                                            style={{
                                                                flex: 1,
                                                                padding: '6px 0',
                                                                borderRadius: '8px',
                                                                border: interval === p.value
                                                                    ? '1.5px solid #8b5cf6'
                                                                    : '1.5px solid rgba(255,255,255,0.08)',
                                                                background: interval === p.value
                                                                    ? 'rgba(139, 92, 246, 0.15)'
                                                                    : 'rgba(255,255,255,0.04)',
                                                                color: interval === p.value ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease',
                                                                letterSpacing: '0.02em',
                                                            }}
                                                        >
                                                            {p.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Fine-tune slider */}
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%'
                                                }}>
                                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>5m</span>
                                                    <input
                                                        type="range"
                                                        min={5}
                                                        max={120}
                                                        step={5}
                                                        value={interval}
                                                        onChange={e => setInterval(Number.parseInt(e.target.value, 10))}
                                                        style={{
                                                            flex: 1,
                                                            accentColor: '#8b5cf6',
                                                            height: '4px',
                                                        }}
                                                        aria-label="Change Notification Interval"
                                                    />
                                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>2h</span>
                                                </div>

                                                {/* Current value badge */}
                                                <div style={{
                                                    marginTop: '0.5rem',
                                                    alignSelf: 'center',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    color: '#c4b5fd',
                                                    background: 'rgba(139, 92, 246, 0.1)',
                                                    border: '1px solid rgba(139, 92, 246, 0.2)',
                                                    borderRadius: '20px',
                                                    padding: '4px 16px',
                                                    letterSpacing: '0.02em',
                                                }}>
                                                    Every {formatTime(interval)}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Privacy & Danger Zone */}
                            <div className="glass-panel">
                                <div className="panel-header">
                                    <h2 className="panel-title">
                                        <Shield size={20} className="text-accent" style={{ color: '#10b981' }} />
                                        Privacy & Data
                                    </h2>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <h3>User Identity</h3>
                                        <p>Your unique account ID used for data synchronization.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="id-badge"
                                        onClick={() => {
                                            if (user?.id) {
                                                navigator.clipboard.writeText(user.id);
                                                toast.success("User ID copied!");
                                            }
                                        }}
                                        title="Copy User ID"
                                    >
                                        {user?.id || 'Not Connected'}
                                    </button>
                                </div>

                                <div className="danger-zone">
                                    <button onClick={handleSignOut} className="btn-signout">
                                        <LogOut size={16} /> Sign Out
                                    </button>
                                </div>
                            </div>

                            <div className="version-text">
                                DraftWolf v{appVersion}
                            </div>

                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Settings;
