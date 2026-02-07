import React, { useState, useMemo } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import Sidebar from '../components/Sidebar';
import { Download, DownloadCloud, Palette, LayoutGrid, ExternalLink, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { extensions, type Extension } from '../data/extensions';
import '../styles/Extensions.css';

function KindIcon({ kind }: Readonly<{ kind: Extension['kind'] }>) {
  if (kind === 'download') return <Download size={20} />;
  if (kind === 'install') return <LayoutGrid size={20} />;
  return <Palette size={20} />;
}

const Extensions = () => {
  const [user] = useAuthState(auth);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExtensions = useMemo(() => {
    if (!searchQuery.trim()) return extensions;
    const q = searchQuery.trim().toLowerCase();
    return extensions.filter(
      (ext) =>
        ext.name.toLowerCase().includes(q) ||
        ext.description.toLowerCase().includes(q) ||
        ext.kindLabel.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadZip = async (ext: Extension) => {
    if (ext.kind !== 'download') return;
    const url = ext.downloadUrl || ext.repositoryUrl;
    if (!url) return;

    const downloadInApp = typeof globalThis.api?.downloadFile === 'function';
    if (!downloadInApp) {
      window.open(url, '_blank');
      toast.success('Download started. Check your downloads folder.');
      return;
    }

    const suggestedName = url.split('/').pop() || `${ext.name.replaceAll(/\s+/g, '_')}.zip`;
    setDownloadingId(ext.id);
    try {
      const result = await globalThis.api.downloadFile(url, suggestedName);
      if (result.success && result.path) {
        toast.success(`Saved to ${result.path}`);
      } else if (result.error && result.error !== 'Canceled') {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleInstall = (ext: Extension) => {
    window.open(ext.repositoryUrl, '_blank');
    toast.info(`Open the repository to install ${ext.name}.`);
  };

  const handleTheme = (ext: Extension) => {
    window.open(ext.repositoryUrl, '_blank');
    toast.info(`Open the theme repository to install ${ext.name}.`);
  };

  const getActionButton = (ext: Extension) => {
    if (ext.kind === 'download') {
      const isDownloading = downloadingId === ext.id;
      return (
        <button
          onClick={() => handleDownloadZip(ext)}
          className="ext-btn ext-btn-primary"
          disabled={isDownloading}
        >
          <Download size={16} /> {isDownloading ? 'Downloading…' : 'Download .zip'}
        </button>
      );
    }
    if (ext.kind === 'install') {
      return (
        <button onClick={() => handleInstall(ext)} className="ext-btn ext-btn-primary">
          <DownloadCloud size={16} /> Install
        </button>
      );
    }
    if (ext.kind === 'theme') {
      return (
        <button onClick={() => handleTheme(ext)} className="ext-btn ext-btn-primary">
          <Palette size={16} /> Get theme
        </button>
      );
    }
    return null;
  };

  return (
    <div className="extensions-container">
      <div className="app-inner ext-app-inner">
        <Sidebar isOpen={true} user={user} />

        <main className="extensions-content">
          <header className="extensions-header">
            <div className="extensions-header-text">
              <h1>Extensions</h1>
              <p>Plugins, moodboards, and themes from the DraftWolf ecosystem. Each comes from its own repository.</p>
            </div>
            <div className="extensions-search-wrap">
              <Search size={20} className="extensions-search-icon" />
              <input
                type="search"
                placeholder="Search extensions…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="extensions-search-input"
                aria-label="Search extensions"
              />
            </div>
          </header>

          <div className="extensions-list">
            {filteredExtensions.length === 0 ? (
              <p className="extensions-empty">No extensions match your search.</p>
            ) : (
              filteredExtensions.map((ext) => (
                <article
                  key={ext.id}
                  className="ext-card"
                  style={{ '--ext-accent': ext.accentColor } as React.CSSProperties}
                >
                  <div className="ext-card-accent" />
                  <div
                    className="ext-card-icon"
                    style={{ background: `${ext.accentColor}22`, color: ext.accentColor }}
                  >
                    <KindIcon kind={ext.kind} />
                  </div>
                  <div className="ext-card-body">
                    <div className="ext-card-head">
                      <h2 className="ext-card-title">{ext.name}</h2>
                      <span
                        className="ext-kind-badge"
                        style={{ borderColor: ext.accentColor, color: ext.accentColor }}
                      >
                        {ext.kindLabel}
                      </span>
                    </div>
                    <p className="ext-card-desc">{ext.description}</p>
                    <div className="ext-card-actions">
                      {getActionButton(ext)}
                      <a
                        href={ext.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ext-btn ext-btn-ghost"
                        title="View repository"
                      >
                        <ExternalLink size={16} /> Visit
                      </a>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Extensions;
