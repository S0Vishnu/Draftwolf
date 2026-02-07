import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Sidebar from '../components/Sidebar';
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';
import {
    LogOut, RefreshCw, User, Clock, Shield,
    Edit2, X, Check, Coffee, Trash2,
    Monitor
} from 'lucide-react';
import { toast } from 'react-toastify';
import '../styles/Settings.css';

interface UserSettings {
    bio: string;
    dndEnabled: boolean;
    dndStart: string;
    dndEnd: string;
    notificationsEnabled: boolean;
    avatarSeed: string;
    checkUpdates: boolean;

}

const Settings = () => {
    const [user] = useAuthState(auth);
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
        avatarSeed: '',
        checkUpdates: true,

    };

    const [settings, setSettings] = useState<UserSettings>(defaultSettings);
    // Backup for reverting changes on Cancel
    const [initialSettings, setInitialSettings] = useState<UserSettings>(defaultSettings);

    // Display Name State
    const [displayName, setDisplayName] = useState('');
    const [initialDisplayName, setInitialDisplayName] = useState('');

    // Load initial data
    useEffect(() => {
        if (!user) return;
        const name = user.displayName || '';
        setDisplayName(name);
        setInitialDisplayName(name);

        // Get App Version
        if ((globalThis as any)?.api?.getAppVersion) {
            (globalThis as any).api.getAppVersion().then((v: string) => setAppVersion(v));
        }

        // 1. Load from LocalStorage immediately for instant UI
        const saved = localStorage.getItem(`user_settings_${user.uid}`);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                setSettings({ ...defaultSettings, ...data });
                setInitialSettings({ ...defaultSettings, ...data });
            } catch (e) {
                console.error("Failed to parse cached settings:", e);
            }
        }

        const loadSettings = async () => {
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as UserSettings;
                    setSettings(data);
                    setInitialSettings(data);
                    // Update cache
                    localStorage.setItem(`user_settings_${user.uid}`, JSON.stringify(data));
                } else if (!saved) {
                    // Only set defaults if we didn't populate from cache
                    const newSettings = { ...defaultSettings, avatarSeed: '' };
                    setSettings(newSettings);
                    setInitialSettings(newSettings);
                }
            } catch (err) {
                console.error("Failed to load settings from Firestore:", err);
            }
        };
        loadSettings();
    }, [user]);

    // Handle Profile Save
    const saveProfile = async () => {
        if (!user) return;

        setLoading(true);
        try {
            // 1. Generate Avatar URL OR Use Existing
            let newPhotoURL = user.photoURL;

            if (settings.avatarSeed) {
                const seed = encodeURIComponent(settings.avatarSeed);
                newPhotoURL = `https://api.dicebear.com/9.x/lorelei/svg?seed=${seed}&radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf`;
            }

            // 2. Update Firebase Auth Profile
            if (displayName !== user.displayName || newPhotoURL !== user.photoURL) {
                await updateProfile(user, {
                    displayName: displayName || undefined,
                    photoURL: newPhotoURL || undefined
                });
                setInitialDisplayName(displayName);
            }

            // 3. Prepare Firestore Data
            const profileData = {
                bio: settings.bio || '',
                avatarSeed: settings.avatarSeed || '',
                photoURL: newPhotoURL || '',
                updatedAt: new Date().toISOString(),
                uid: user.uid,
                email: user.email
            };

            // 4. Write to Firestore
            await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });

            // 5. Update Local State
            localStorage.setItem(`user_settings_${user.uid}`, JSON.stringify(settings));
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
            bio: initialSettings.bio,
            avatarSeed: initialSettings.avatarSeed
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
            await setDoc(doc(db, 'users', user.uid), { [key]: value }, { merge: true });
            localStorage.setItem(`user_settings_${user.uid}`, JSON.stringify(newSettings));
        } catch (error) {
            console.error("Failed to save preference:", error);
        }
    };

    const regenerateAvatar = () => {
        const newSeed = Math.random().toString(36).substring(7);
        setSettings({ ...settings, avatarSeed: newSeed });
    };

    const handleSignOut = async () => {
        try {
            // Clear Electron Main Process Auth
            if ((globalThis as any)?.api?.auth) {
                await (globalThis as any).api.auth.logout();
            }
            await auth.signOut();
            navigate('/');
        } catch (error) {
            console.error("Error signing out:", error);
            toast.error("Failed to sign out");
        }
    };

    const handleClearCache = async () => {
        localStorage.clear();
        toast.info("Local cache cleared. Reloading...");
        setTimeout(() => globalThis.location.reload(), 1000);
    };

    // Determine Avatar URL for display
    let avatarUrl = user?.photoURL || '';

    // If explicit seed is set (e.g. user regenerated), use that
    if (settings.avatarSeed) {
        const avatar = createAvatar(lorelei, {
            seed: settings.avatarSeed,
            backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffdfbf'],
            radius: 50,
        });
        avatarUrl = `data:image/svg+xml;utf8,${encodeURIComponent(avatar.toString())}`;
    } else if (!avatarUrl) {
        // Fallback if no photoURL and no seed
        const avatar = createAvatar(lorelei, {
            seed: user?.email || 'default',
            backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffdfbf'],
            radius: 50,
        });
        avatarUrl = `data:image/svg+xml;utf8,${encodeURIComponent(avatar.toString())}`;
    }

    return (
        <div className="settings-container">
            <div className="app-inner" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
                <Sidebar isOpen={true} user={user} />

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
                                    {isEditing && (
                                        <button onClick={regenerateAvatar} className="btn-regenerate" aria-label="Regenerate Avatar" title="Regenerate Avatar">
                                            <RefreshCw size={20} />
                                        </button>
                                    )}
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
                                            if (user?.uid) {
                                                navigator.clipboard.writeText(user.uid);
                                                toast.success("User ID copied!");
                                            }
                                        }}
                                        title="Copy User ID"
                                    >
                                        {user?.uid || 'Not Connected'}
                                    </button>
                                </div>

                                <div className="danger-zone">
                                    <button onClick={handleClearCache} className="btn-clear-cache">
                                        <Trash2 size={16} /> Clear Cache
                                    </button>
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
