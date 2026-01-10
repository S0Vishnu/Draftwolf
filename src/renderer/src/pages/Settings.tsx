import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Sidebar from '../components/Sidebar';
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';
import { Bell, Moon, LogOut, RefreshCw, User, Clock, Shield, Edit2, X, Check } from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

interface UserSettings {
    bio: string;
    dndEnabled: boolean;
    dndStart: string;
    dndEnd: string;
    notificationsEnabled: boolean;
    avatarSeed: string;
}

const Settings = () => {
    const [user] = useAuthState(auth);
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Initial default settings
    const defaultSettings: UserSettings = {
        bio: '',
        dndEnabled: false,
        dndStart: '22:00',
        dndEnd: '08:00',
        notificationsEnabled: true,
        avatarSeed: ''
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
        if (!user) return;
        setLoading(true);
        try {
            // Update Firebase Profile (Display Name)
            if (displayName !== user.displayName) {
                await updateProfile(user, { displayName });
                setInitialDisplayName(displayName);
            }

            // Save Profile-specific settings (bio, avatarSeed) to Firestore
            const profileData = {
                bio: settings.bio,
                avatarSeed: settings.avatarSeed
            };

            await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });

            // Update local backup
            setInitialSettings(prev => ({ ...prev, ...profileData }));
            localStorage.setItem(`user_settings_${user.uid}`, JSON.stringify({ ...initialSettings, ...profileData }));

            setIsEditing(false);
            toast.success('Profile updated successfully!');
        } catch (error) {
            console.error(error);
            toast.error('Failed to update profile.');
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

    // Generate Avatar
    const avatar = createAvatar(lorelei, {
        seed: settings.avatarSeed || 'default',
        backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffdfbf'],
        radius: 50,
    });
    const avatarUrl = `data:image/svg+xml;utf8,${encodeURIComponent(avatar.toString())}`;

    return (
        <div className="app-shell" style={{ flexDirection: 'column', height: '100vh', display: 'flex' }}>
            <div className="app-inner" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
                <Sidebar
                    isOpen={isSidebarOpen}
                    user={user}
                />
                <main className="main-content" style={{
                    flex: 1,
                    padding: '3rem',
                    color: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2rem',
                    overflowY: 'auto'
                }}>
                    <header>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 600 }}>Settings & Profile</h1>
                    </header>

                    <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>

                        {/* Profile Section */}
                        <div className="glass-panel" style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '24px',
                            padding: '2rem',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                                    <User size={24} className="text-accent" style={{ color: '#3b82f6' }} />
                                    Profile Identity
                                </h2>
                                {!isEditing && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        style={{
                                            background: 'rgba(255,255,255,0.1)', border: 'none',
                                            padding: '8px 12px', borderRadius: '8px', color: '#fff',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        <Edit2 size={14} />
                                        <span style={{ fontSize: '0.9rem' }}>Edit Profile</span>
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                                <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '1rem' }}>
                                    <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.1)' }} />
                                    {isEditing && (
                                        <button
                                            onClick={regenerateAvatar}
                                            title="Regenerate Avatar"
                                            style={{
                                                position: 'absolute', bottom: 0, right: 0,
                                                background: '#3b82f6', border: 'none', borderRadius: '50%',
                                                width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                            }}
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isEditing ? (
                                <>
                                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7, fontSize: '0.9rem' }}>Username</label>
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={e => setDisplayName(e.target.value)}
                                            placeholder="Enter your display name"
                                            style={{
                                                width: '100%', padding: '12px', borderRadius: '12px',
                                                background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white', fontSize: '1rem', outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7, fontSize: '0.9rem' }}>Bio</label>
                                        <textarea
                                            value={settings.bio}
                                            onChange={e => setSettings({ ...settings, bio: e.target.value })}
                                            placeholder="Tell us a bit about yourself..."
                                            rows={4}
                                            style={{
                                                width: '100%', padding: '12px', borderRadius: '12px',
                                                background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white', fontSize: '1rem', outline: 'none', resize: 'vertical'
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                        <button
                                            onClick={cancelEdit}
                                            className="action-btn"
                                            style={{ flex: 1, padding: '10px', display: 'flex', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: 'none' }}
                                        >
                                            <X size={18} /> Cancel
                                        </button>
                                        <button
                                            onClick={saveProfile}
                                            disabled={loading}
                                            className="primary-btn"
                                            style={{ flex: 1, padding: '10px', display: 'flex', justifyContent: 'center', gap: '8px' }}
                                        >
                                            <Check size={18} /> {loading ? 'Saving...' : 'Save Profile'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                        <h3 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0' }}>{displayName || 'User'}</h3>
                                        <p style={{ opacity: 0.6, fontSize: '0.95rem', lineHeight: '1.5' }}>
                                            {settings.bio || 'No bio provided yet.'}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>0</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Projects</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>Free</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Plan</div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Preferences Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                            {/* Notifications & DnD */}
                            <div className="glass-panel" style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '24px',
                                padding: '2rem',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                                <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Bell size={24} style={{ color: '#eab308' }} />
                                    Notifications
                                </h2>

                                <div className="setting-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: 500 }}>Push Notifications</div>
                                        <div style={{ fontSize: '0.85rem', opacity: 0.5 }}>Receive updates about your activity</div>
                                    </div>
                                    <label className="toggle-switch" style={{ position: 'relative', width: '50px', height: '28px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={settings.notificationsEnabled}
                                            onChange={e => updatePreference('notificationsEnabled', e.target.checked)}
                                            style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <span style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                            backgroundColor: settings.notificationsEnabled ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                            borderRadius: '34px', transition: '0.4s'
                                        }}></span>
                                        <span style={{
                                            position: 'absolute', content: '""', height: '20px', width: '20px',
                                            left: settings.notificationsEnabled ? '26px' : '4px', bottom: '4px',
                                            backgroundColor: 'white', borderRadius: '50%', transition: '0.4s'
                                        }}></span>
                                    </label>
                                </div>

                                <div className="setting-block">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Moon size={18} style={{ opacity: 0.7 }} />
                                            <span style={{ fontSize: '1rem', fontWeight: 500 }}>Do Not Disturb</span>
                                        </div>
                                        <label className="toggle-switch" style={{ position: 'relative', width: '40px', height: '24px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={settings.dndEnabled}
                                                onChange={e => updatePreference('dndEnabled', e.target.checked)}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                backgroundColor: settings.dndEnabled ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                                borderRadius: '34px', transition: '0.4s'
                                            }}></span>
                                            <span style={{
                                                position: 'absolute', content: '""', height: '16px', width: '16px',
                                                left: settings.dndEnabled ? '20px' : '4px', bottom: '4px',
                                                backgroundColor: 'white', borderRadius: '50%', transition: '0.4s'
                                            }}></span>
                                        </label>
                                    </div>

                                    {settings.dndEnabled && (
                                        <div style={{
                                            background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px',
                                            display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem'
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.25rem' }}>From</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                                                    <Clock size={14} style={{ opacity: 0.5 }} />
                                                    <input
                                                        type="time"
                                                        value={settings.dndStart}
                                                        onChange={e => updatePreference('dndStart', e.target.value)}
                                                        style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ opacity: 0.3 }}>-</div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.25rem' }}>To</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                                                    <Clock size={14} style={{ opacity: 0.5 }} />
                                                    <input
                                                        type="time"
                                                        value={settings.dndEnd}
                                                        onChange={e => updatePreference('dndEnd', e.target.value)}
                                                        style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Privacy / Other */}
                            <div className="glass-panel" style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '24px',
                                padding: '2rem',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                                <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Shield size={24} style={{ color: '#10b981' }} />
                                    Privacy
                                </h2>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7, lineHeight: 1.6 }}>
                                    Your User ID is a unique identifier used for authentication and data sorting. It is kept private by default.
                                    <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', fontSize: '0.8rem' }}>
                                        {user?.uid}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <button
                            style={{
                                padding: '1rem 2rem',
                                background: 'rgba(255, 59, 48, 0.1)',
                                color: '#FF3B30',
                                border: '1px solid rgba(255, 59, 48, 0.2)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                fontWeight: 600,
                                fontSize: '1rem',
                                width: '100%'
                            }}
                            onClick={() => auth.signOut()}
                        >
                            <LogOut size={18} />
                            Sign Out of {user?.email}
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Settings;
