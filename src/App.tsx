import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/AppLayout.css';
import Login from './pages/Login';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebase';

import OTPVerification from './pages/OTPVerification';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Cleanup from './pages/Cleanup';
import Community from './pages/Community';
import UpdateModal from './components/UpdateModal';


function App() {
  const [user, loading] = useAuthState(auth);
  const [updateState, setUpdateState] = useState({
    isOpen: false,
    version: '',
    status: 'available' as 'available' | 'downloading' | 'ready',
    progress: 0
  });

  useEffect(() => {
    // Check for updates on mount
    const checkForUpdates = async () => {
      // Logic to check setting:
      // We iterate local storage to see if any user has explicitly disabled updates.
      // If we find a "false", we respect it (conservative).
      // Otherwise default to true.
      let shouldCheck = true;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('user_settings_')) {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data.checkUpdates === false) {
              shouldCheck = false;
              break;
            }
          }
        }
      } catch (e) {
        console.error("Error reading settings", e);
      }

      if (shouldCheck && window.api?.updater) {
        window.api.updater.check();
      }
    };

    checkForUpdates();

    // Event Listeners

    // Event Listeners
    if (window.api?.updater) {
      // ... existing handlers ...
      const cleanupAvailable = window.api.updater.onAvailable((info: any) => {
        setUpdateState({
          isOpen: true,
          version: info.version,
          status: 'available',
          progress: 0
        });
      });

      const cleanupProgress = window.api.updater.onProgress((info: any) => {
        setUpdateState((prev: any) => ({
          ...prev,
          status: 'downloading',
          progress: info.percent
        }));
      });

      const cleanupDownloaded = window.api.updater.onDownloaded((info: any) => {
        setUpdateState((prev: any) => ({
          ...prev,
          version: info.version,
          status: 'ready',
          progress: 100
        }));
      });

      if (window.api.updater.onError) {
        const cleanupError = window.api.updater.onError((error: string) => {
          alert(`Update Failed: ${error}`);
          setUpdateState((prev: any) => ({ ...prev, isOpen: false, status: 'available' }));
        });

        // Add to cleanup chain
        const originalCleanup = cleanupDownloaded;
        return () => {
          cleanupAvailable();
          cleanupProgress();
          originalCleanup(); // which was pointing to cleanDownloaded
          cleanupError();
        };
      }

      return () => {
        cleanupAvailable();
        cleanupProgress();
        cleanupDownloaded();
      };
    }
  }, []);

  const handleUpdate = async () => {
    try {
      setUpdateState((prev: any) => ({ ...prev, status: 'downloading' }));
      if (window.api?.updater) {
        await window.api.updater.download();
      }
    } catch (e: any) {
      console.error("Download failed to start:", e);
      alert(`Download Error: ${e.message}`);
      setUpdateState((prev: any) => ({ ...prev, isOpen: false, status: 'available' }));
    }
  };

  const handleIgnore = () => {
    setUpdateState((prev: any) => ({ ...prev, isOpen: false }));
  };

  const handleRestart = () => {
    if (window.api?.updater) {
      window.api.updater.install();
    }
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#09090b',
        color: 'white'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(255,255,255,0.1)',
          borderTop: '4px solid #fff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
      </div>
    );
  }

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/home" replace /> : <Login />} />
          <Route path="/verify" element={<OTPVerification />} />
          <Route path="/home" element={user ? <Home /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={user ? <Settings /> : <Navigate to="/" replace />} />
          <Route path="/cleanup" element={user ? <Cleanup /> : <Navigate to="/" replace />} />
          <Route path="/community" element={user ? <Community /> : <Navigate to="/" replace />} />
        </Routes>
      </Router>
      <UpdateModal
        isOpen={updateState.isOpen}
        version={updateState.version}
        status={updateState.status}
        progress={updateState.progress}
        onUpdate={handleUpdate}
        onIgnore={handleIgnore}
        onRestart={handleRestart}
      />
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </>
  )
}

export default App
