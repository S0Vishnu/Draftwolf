import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Sidebar from '../components/Sidebar';
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';
import { Bell, Moon, LogOut, RefreshCw, User, Clock, Shield, Edit2, X, Check, Download } from 'lucide-react';
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

    // Initial default settings
    const defaultSettings: UserSettings = {
        bio: '',
        dndEnabled: false,
        dndStart: '22:00',
        dndEnd: '08:00',
        notificationsEnabled: true,
        avatarSeed: '',
        checkUpdates: true
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

        const loadSettings = async () => {
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as UserSettings;
                    setSettings(data);
                    setInitialSettings(data);
                } else {
                    const newSettings = { ...defaultSettings, avatarSeed: user.email || 'user' };
                    setSettings(newSettings);
                    setInitialSettings(newSettings);
                }
            } catch (err) {
                console.error("Failed to load settings from Firestore:", err);
                const saved = localStorage.getItem(`user_settings_${user.uid}`);
                if (saved) {
                    const data = JSON.parse(saved);
                    setSettings(data);
                    setInitialSettings(data);
                } else {
                    const newSettings = { ...defaultSettings, avatarSeed: user.email || 'user' };
                    setSettings(newSettings);
                    setInitialSettings(newSettings);
                }
            }
        };
        loadSettings();
    }, [user]);

    // Handle Profile Save
    const saveProfile = async () => {
        console.log("Attempting to save profile...");
        if (!user) {
            console.error("No user found during save.");
            toast.error("User not verified. Please login again.");
            return;
        }
        if (!db) {
            console.error("Firestore DB instance is missing.");
            toast.error("Service unavailable (DB missing).");
            return;
        }

        setLoading(true);
        try {
            // 1. Generate Avatar
            // We use the hosted DiceBear API for the URL to avoid Firebase's 2048 byte limit on photoURL.
            // Local SVG generation produces Data URIs that are too long.
            const seed = encodeURIComponent(settings.avatarSeed || 'default');
            const newPhotoURL = `https://api.dicebear.com/9.x/lorelei/svg?seed=${seed}&radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf`;

            // 2. Update Firebase Auth Profile (Display Name and PhotoURL)
            console.log("Updating Auth Profile:", { displayName, newPhotoURL });
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
                uid: user.uid, // Redundant but useful for queries
                email: user.email // Useful for admin debugging
            };

            // 4. Write to Firestore
            console.log("Writing to Firestore (files/users/" + user.uid + "):", profileData);
            await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });

            // 5. Update Local State
            localStorage.setItem(`user_settings_${user.uid}`, JSON.stringify(settings));
            setInitialSettings(settings);

            console.log("Save complete.");
            setIsEditing(false);
            toast.success('Profile saved successfully!');

        } catch (error: any) {
            console.error("CRITICAL SAVE ERROR:", error);
            console.error("Error Code:", error.code);
            console.error("Error Message:", error.message);

            if (error.code === 'permission-denied') {
                toast.error("Permission denied. Check Firestore rules.");
            } else if (error.code === 'unavailable') {
                toast.error("Network offline or Firestore unreachable.");
            } else {
                toast.error(`Save failed: ${error.message}`);
                // Fallback alert if toast misses
                alert(`Save failed: ${error.message}`);
            }
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
        setInitialSettings(prev => ({ ...prev, [key]: value })); // Update backup so change detection logic implies "saved"

        try {
            await setDoc(doc(db, 'users', user.uid), { [key]: value }, { merge: true });
            localStorage.setItem(`user_settings_${user.uid}`, JSON.stringify(newSettings));
        } catch (error) {
            console.error("Failed to save preference:", error);
            // toast.error('Failed to save preference.'); // Optional: suppress to avoid noise
        }
    };

    const regenerateAvatar = () => {
        const newSeed = Math.random().toString(36).substring(7);
        setSettings({ ...settings, avatarSeed: newSeed });
    };

    const handleSignOut = async () => {
        try {
            localStorage.clear();

            // Clear Electron Main Process Auth
            if (window.api && window.api.auth) {
                await window.api.auth.logout();
            }

            await auth.signOut();
            navigate('/');
        } catch (error) {
            console.error("Error signing out:", error);
            toast.error("Failed to sign out");
        }
    };

    const handleDownloadAddon = async () => {
        const api = (window as any).api;
        if (!api || !api.downloadAddon) {
            toast.error("Feature not available in web mode.");
            return;
        }
        try {
            const result = await api.downloadAddon();
            if (result.success) {
                toast.success('Addon downloaded successfully!');
            } else if (result.error) {
                toast.error(`Download failed: ${result.error}`);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to initiate download.');
        }
    };

    // Generate Avatar
    const avatar = createAvatar(lorelei, {
        seed: settings.avatarSeed || 'default',
        backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffdfbf'],
        radius: 50,
    });
    const avatarUrl = `data:image/svg+xml;utf8,${encodeURIComponent(avatar.toString())}`;

    return (
        <div className="settings-container">
            <div className="app-inner" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
                <Sidebar
                    isOpen={true}
                    user={user}
                />
                <main className="settings-content">
                    <header className="settings-header">
                        <h1>Settings & Profile</h1>
                    </header>

                    <div className="settings-grid">

                        {/* Left Column: Profile */}
                        <div className="glass-panel">
                            <div className="panel-header">
                                <h2 className="panel-title">
                                    <User size={24} className="text-accent" style={{ color: '#3b82f6' }} />
                                    Profile Identity
                                </h2>
                                {!isEditing && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="btn-edit"
                                    >
                                        <Edit2 size={14} />
                                        <span>Edit Profile</span>
                                    </button>
                                )}
                            </div>

                            <div className="profile-avatar-wrapper">
                                <div className="avatar-ring">
                                    <img src={avatarUrl} alt="Avatar" className="avatar-img" />
                                    {isEditing && (
                                        <button
                                            onClick={regenerateAvatar}
                                            title="Regenerate Avatar"
                                            className="btn-regenerate"
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isEditing ? (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Username</label>
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={e => setDisplayName(e.target.value)}
                                            placeholder="Enter your display name"
                                            className="input-styled"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Bio</label>
                                        <textarea
                                            value={settings.bio}
                                            onChange={e => setSettings({ ...settings, bio: e.target.value })}
                                            placeholder="Tell us a bit about yourself..."
                                            rows={4}
                                            className="input-styled"
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                        <button
                                            onClick={cancelEdit}
                                            className="btn-cancel"
                                        >
                                            <X size={18} /> Cancel
                                        </button>
                                        <button
                                            onClick={saveProfile}
                                            disabled={loading}
                                            className="btn-save"
                                        >
                                            <Check size={18} /> {loading ? 'Saving...' : 'Save Profile'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                        <h3 className="profile-name">{displayName || 'User'}</h3>
                                        <p className="profile-bio">
                                            {settings.bio || 'No bio provided yet.'}
                                        </p>
                                    </div>
                                    <div className="profile-stats">
                                        <div className="stat-box">
                                            <div className="stat-num">0</div>
                                            <div className="stat-label">Projects</div>
                                        </div>
                                        <div className="stat-box">
                                            <div className="stat-num">Free</div>
                                            <div className="stat-label">Plan</div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right Column: Settings Stack */}
                        <div className="settings-column">

                            {/* Notifications & DnD */}
                            <div className="glass-panel">
                                <h2 className="panel-title" style={{ marginBottom: '1.5rem' }}>
                                    <Bell size={24} style={{ color: '#eab308' }} />
                                    Notifications
                                </h2>

                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h3>Push Notifications</h3>
                                        <p>Receive updates about your activity</p>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={settings.notificationsEnabled}
                                            onChange={e => updatePreference('notificationsEnabled', e.target.checked)}
                                            className="toggle-input"
                                        />
                                        <span className="toggle-slider">
                                            <span className="toggle-knob"></span>
                                        </span>
                                    </label>
                                </div>

                                <div className="setting-block">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Moon size={18} style={{ opacity: 0.7 }} />
                                            <span style={{ fontSize: '1rem', fontWeight: 500 }}>Do Not Disturb</span>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={settings.dndEnabled}
                                                onChange={e => updatePreference('dndEnabled', e.target.checked)}
                                                className="toggle-input"
                                            />
                                            <span className="toggle-slider">
                                                <span className="toggle-knob"></span>
                                            </span>
                                        </label>
                                    </div>

                                    {settings.dndEnabled && (
                                        <div className="time-inputs">
                                            <div className="time-box">
                                                <label>From</label>
                                                <div className="time-wrapper">
                                                    <Clock size={14} style={{ opacity: 0.5 }} />
                                                    <input
                                                        type="time"
                                                        value={settings.dndStart}
                                                        onChange={e => updatePreference('dndStart', e.target.value)}
                                                        className="time-input"
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ opacity: 0.3 }}>-</div>
                                            <div className="time-box">
                                                <label>To</label>
                                                <div className="time-wrapper">
                                                    <Clock size={14} style={{ opacity: 0.5 }} />
                                                    <input
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
                            </div>

                            {/* Blender Plugin */}
                            <div className="glass-panel">
                                <h2 className="panel-title" style={{ marginBottom: '1rem' }}>
                                    <Download size={24} style={{ color: '#f97316' }} />
                                    Blender Integration
                                </h2>
                                <p className="info-text" style={{ marginBottom: '1.5rem' }}>
                                    Download the optional Blender addon to version your projects directly from Blender.
                                </p>
                                <button
                                    onClick={handleDownloadAddon}
                                    className="btn-download-addon"
                                >
                                    <Download size={18} />
                                    Download Addon (.zip)
                                </button>
                            </div>



                            {/* System / Updates */}
                            <div className="glass-panel">
                                <h2 className="panel-title" style={{ marginBottom: '1.5rem' }}>
                                    <RefreshCw size={24} style={{ color: '#ec4899' }} />
                                    Updates
                                </h2>

                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h3>Automatic Updates</h3>
                                        <p>Check for updates on launch</p>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={settings.checkUpdates ?? true}
                                            onChange={e => updatePreference('checkUpdates', e.target.checked)}
                                            className="toggle-input"
                                        />
                                        <span className="toggle-slider">
                                            <span className="toggle-knob"></span>
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Privacy / Other */}
                            <div className="glass-panel">
                                <h2 className="panel-title" style={{ marginBottom: '1rem' }}>
                                    <Shield size={24} style={{ color: '#10b981' }} />
                                    Privacy
                                </h2>
                                <div className="info-text">
                                    Your User ID is a unique identifier used for authentication and data sorting. It is kept private by default.
                                    <div className="uid-badge">
                                        {user?.uid}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>


                    <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <button
                            className="btn-signout"
                            onClick={handleSignOut}
                        >
                            <LogOut size={18} />
                            Sign Out of Draftflow as {user?.email}
                        </button>
                    </div>
                </main >
            </div >
        </div >
    );
};

export default Settings;
