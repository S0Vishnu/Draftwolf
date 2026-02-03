import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import Sidebar from '../components/Sidebar';
import {
    Download,
    Trash2,
    RefreshCw,
    Power,
    PowerOff,
    Check,
    AlertCircle,
    Package,
    ExternalLink,
    Search,
    Filter,
    Loader,
    Sparkles
} from 'lucide-react';
import { toast } from 'react-toastify';
import '../styles/Extensions.css';

interface Plugin {
    manifest: {
        id: string;
        name: string;
        version: string;
        description: string;
        author: string;
        homepage?: string;
        repository?: string;
        category?: string;
        tags?: string[];
    };
    enabled: boolean;
    installed: boolean;
    installedVersion?: string;
}

interface RegistryPlugin {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    homepage: string;
    repository: string;
    downloadUrl: string;
    category: string;
    tags: string[];
    icon?: string;
    verified: boolean;
}

interface PluginUpdateInfo {
    pluginId: string;
    currentVersion: string;
    latestVersion: string;
    downloadUrl: string;
}

const Extensions: React.FC = () => {
    const [user] = useAuthState(auth);
    const [installedPlugins, setInstalledPlugins] = useState<Plugin[]>([]);
    const [availablePlugins, setAvailablePlugins] = useState<RegistryPlugin[]>([]);
    const [updates, setUpdates] = useState<PluginUpdateInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'installed' | 'browse'>('browse');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [processingPlugins, setProcessingPlugins] = useState<Set<string>>(new Set());
    const [isSidebarOpen, setSidebarOpen] = useState(true);

    // Load installed plugins
    const loadInstalledPlugins = async () => {
        try {
            const result = await window.api.plugins.getAll();
            if (result.success && result.plugins) {
                setInstalledPlugins(result.plugins);
            }
        } catch (error) {
            console.error('Failed to load installed plugins:', error);
            toast.error('Failed to load installed plugins');
        }
    };

    // Load available plugins from registry
    const loadAvailablePlugins = async () => {
        try {
            const result = await window.api.plugins.fetchRegistry();
            if (result.success && result.registry) {
                setAvailablePlugins(result.registry.plugins || []);
            }
        } catch (error) {
            console.error('Failed to load plugin registry:', error);
            toast.error('Failed to load plugin registry');
        }
    };

    // Check for updates
    const checkForUpdates = async () => {
        try {
            const result = await window.api.plugins.checkUpdates();
            if (result.success && result.updates) {
                setUpdates(result.updates);
                if (result.updates.length > 0) {
                    toast.info(`${result.updates.length} plugin update(s) available`);
                }
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    };

    // Initial load
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                loadInstalledPlugins(),
                loadAvailablePlugins(),
                checkForUpdates()
            ]);
            setLoading(false);
        };
        loadData();
    }, []);

    // Install plugin
    const handleInstall = async (plugin: RegistryPlugin) => {
        setProcessingPlugins(prev => new Set(prev).add(plugin.id));

        try {
            const result = await window.api.plugins.install(
                { pluginId: plugin.id },
                plugin.downloadUrl
            );

            if (result.success) {
                toast.success(`${plugin.name} installed successfully!`);
                await loadInstalledPlugins();
            } else {
                toast.error(result.error || 'Installation failed');
            }
        } catch (error) {
            console.error('Installation error:', error);
            toast.error('Failed to install plugin');
        } finally {
            setProcessingPlugins(prev => {
                const next = new Set(prev);
                next.delete(plugin.id);
                return next;
            });
        }
    };

    // Uninstall plugin
    const handleUninstall = async (pluginId: string, pluginName: string) => {
        if (!confirm(`Are you sure you want to uninstall ${pluginName}?`)) {
            return;
        }

        setProcessingPlugins(prev => new Set(prev).add(pluginId));

        try {
            const result = await window.api.plugins.uninstall(pluginId);

            if (result.success) {
                toast.success(`${pluginName} uninstalled successfully`);
                await loadInstalledPlugins();
            } else {
                toast.error(result.error || 'Uninstall failed');
            }
        } catch (error) {
            console.error('Uninstall error:', error);
            toast.error('Failed to uninstall plugin');
        } finally {
            setProcessingPlugins(prev => {
                const next = new Set(prev);
                next.delete(pluginId);
                return next;
            });
        }
    };

    // Toggle plugin enabled/disabled
    const handleToggle = async (plugin: Plugin) => {
        setProcessingPlugins(prev => new Set(prev).add(plugin.manifest.id));

        try {
            const result = plugin.enabled
                ? await window.api.plugins.disable(plugin.manifest.id)
                : await window.api.plugins.enable(plugin.manifest.id);

            if (result.success) {
                toast.success(`${plugin.manifest.name} ${plugin.enabled ? 'disabled' : 'enabled'}`);
                await loadInstalledPlugins();
            } else {
                toast.error(result.error || 'Toggle failed');
            }
        } catch (error) {
            console.error('Toggle error:', error);
            toast.error('Failed to toggle plugin');
        } finally {
            setProcessingPlugins(prev => {
                const next = new Set(prev);
                next.delete(plugin.manifest.id);
                return next;
            });
        }
    };

    // Update plugin
    const handleUpdate = async (update: PluginUpdateInfo) => {
        setProcessingPlugins(prev => new Set(prev).add(update.pluginId));

        try {
            const result = await window.api.plugins.update(update.pluginId, update.downloadUrl);

            if (result.success) {
                toast.success('Plugin updated successfully!');
                await loadInstalledPlugins();
                await checkForUpdates();
            } else {
                toast.error(result.error || 'Update failed');
            }
        } catch (error) {
            console.error('Update error:', error);
            toast.error('Failed to update plugin');
        } finally {
            setProcessingPlugins(prev => {
                const next = new Set(prev);
                next.delete(update.pluginId);
                return next;
            });
        }
    };

    // Check if plugin is installed
    const isInstalled = (pluginId: string) => {
        return installedPlugins.some(p => p.manifest.id === pluginId);
    };

    // Get update for plugin
    const getUpdate = (pluginId: string) => {
        return updates.find(u => u.pluginId === pluginId);
    };

    // Filter plugins
    const filteredAvailablePlugins = availablePlugins.filter(plugin => {
        const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const categories = ['all', ...new Set(availablePlugins.map(p => p.category))];

    if (loading) {
        return (
            <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--ev-c-black)' }}>
                <Sidebar isOpen={isSidebarOpen} user={user} />
                <div className="extensions-page">
                    <div className="extensions-loading">
                        <Loader className="spinner" size={48} />
                        <p>Loading extensions...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--ev-c-black)' }}>
            <Sidebar isOpen={isSidebarOpen} user={user} />
            <div className="extensions-page">
                <div className="extensions-header">
                    <div className="header-content">
                        <Package size={32} />
                        <div>
                            <h1>Extensions</h1>
                            <p>Enhance Draftflow with powerful plugins</p>
                        </div>
                    </div>

                    <button
                        className="refresh-btn"
                        onClick={async () => {
                            setLoading(true);
                            await Promise.all([loadAvailablePlugins(), checkForUpdates()]);
                            setLoading(false);
                            toast.success('Refreshed plugin list');
                        }}
                    >
                        <RefreshCw size={18} />
                        Refresh
                    </button>
                </div>

                {updates.length > 0 && (
                    <div className="updates-banner">
                        <AlertCircle size={20} />
                        <span>{updates.length} plugin update(s) available</span>
                        <button onClick={() => setActiveTab('installed')}>View Updates</button>
                    </div>
                )}

                <div className="extensions-tabs">
                    <button
                        className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
                        onClick={() => setActiveTab('browse')}
                    >
                        Browse Plugins
                        <span className="badge">{availablePlugins.length}</span>
                    </button>
                    <button
                        className={`tab ${activeTab === 'installed' ? 'active' : ''}`}
                        onClick={() => setActiveTab('installed')}
                    >
                        Installed
                        <span className="badge">{installedPlugins.length}</span>
                    </button>
                </div>

                {activeTab === 'browse' && (
                    <div className="browse-section">
                        <div className="browse-controls">
                            <div className="search-box">
                                <Search size={18} />
                                <input
                                    type="text"
                                    placeholder="Search plugins..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="category-filter">
                                <Filter size={18} />
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>
                                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="plugins-grid">
                            {filteredAvailablePlugins.length === 0 ? (
                                <div className="empty-state">
                                    <Package size={64} />
                                    <h3>No plugins found</h3>
                                    <p>Try adjusting your search or filters</p>
                                </div>
                            ) : (
                                filteredAvailablePlugins.map(plugin => {
                                    const installed = isInstalled(plugin.id);
                                    const processing = processingPlugins.has(plugin.id);

                                    return (
                                        <div key={plugin.id} className="plugin-card">
                                            {plugin.verified && (
                                                <div className="verified-badge">
                                                    <Check size={14} />
                                                    Verified
                                                </div>
                                            )}

                                            <div className="plugin-icon">
                                                {plugin.icon ? (
                                                    <img src={plugin.icon} alt={plugin.name} />
                                                ) : (
                                                    <Package size={32} />
                                                )}
                                            </div>

                                            <div className="plugin-info">
                                                <h3>{plugin.name}</h3>
                                                <p className="plugin-description">{plugin.description}</p>

                                                <div className="plugin-meta">
                                                    <span className="author">by {plugin.author}</span>
                                                    <span className="version">v{plugin.version}</span>
                                                    <span className="category">{plugin.category}</span>
                                                </div>

                                                {plugin.tags && plugin.tags.length > 0 && (
                                                    <div className="plugin-tags">
                                                        {plugin.tags.map(tag => (
                                                            <span key={tag} className="tag">{tag}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="plugin-actions">
                                                {plugin.homepage && (
                                                    <a
                                                        href={plugin.homepage}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="link-btn"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </a>
                                                )}

                                                <button
                                                    className={`install-btn ${installed ? 'installed' : ''}`}
                                                    onClick={() => !installed && handleInstall(plugin)}
                                                    disabled={installed || processing}
                                                >
                                                    {processing ? (
                                                        <>
                                                            <Loader className="spinner" size={16} />
                                                            Installing...
                                                        </>
                                                    ) : installed ? (
                                                        <>
                                                            <Check size={16} />
                                                            Installed
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download size={16} />
                                                            Install
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'installed' && (
                    <div className="installed-section">
                        {installedPlugins.length === 0 ? (
                            <div className="empty-state">
                                <Package size={64} />
                                <h3>No plugins installed</h3>
                                <p>Browse available plugins to get started</p>
                                <button onClick={() => setActiveTab('browse')}>
                                    Browse Plugins
                                </button>
                            </div>
                        ) : (
                            <div className="installed-list">
                                {installedPlugins.map(plugin => {
                                    const update = getUpdate(plugin.manifest.id);
                                    const processing = processingPlugins.has(plugin.manifest.id);

                                    return (
                                        <div key={plugin.manifest.id} className="installed-plugin">
                                            <div className="plugin-main">
                                                <div className="plugin-icon">
                                                    <Package size={24} />
                                                </div>

                                                <div className="plugin-details">
                                                    <div className="plugin-header">
                                                        <h3>{plugin.manifest.name}</h3>
                                                        <span className="version">v{plugin.installedVersion}</span>
                                                        {plugin.enabled ? (
                                                            <span className="status enabled">Enabled</span>
                                                        ) : (
                                                            <span className="status disabled">Disabled</span>
                                                        )}
                                                    </div>

                                                    <p>{plugin.manifest.description}</p>

                                                    {plugin.manifest.author && (
                                                        <span className="author">by {plugin.manifest.author}</span>
                                                    )}

                                                    {update && (
                                                        <div className="update-notice">
                                                            <AlertCircle size={16} />
                                                            Update available: v{update.latestVersion}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="plugin-controls">
                                                {update && (
                                                    <button
                                                        className="update-btn"
                                                        onClick={() => handleUpdate(update)}
                                                        disabled={processing}
                                                    >
                                                        {processing ? (
                                                            <Loader className="spinner" size={16} />
                                                        ) : (
                                                            <>
                                                                <Download size={16} />
                                                                Update
                                                            </>
                                                        )}
                                                    </button>
                                                )}

                                                <button
                                                    className={`toggle-btn ${plugin.enabled ? 'enabled' : 'disabled'}`}
                                                    onClick={() => handleToggle(plugin)}
                                                    disabled={processing}
                                                    title={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
                                                >
                                                    {plugin.enabled ? (
                                                        <Power size={16} />
                                                    ) : (
                                                        <PowerOff size={16} />
                                                    )}
                                                </button>

                                                <button
                                                    className="uninstall-btn"
                                                    onClick={() => handleUninstall(plugin.manifest.id, plugin.manifest.name)}
                                                    disabled={processing}
                                                    title="Uninstall plugin"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Extensions;
