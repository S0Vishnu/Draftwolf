import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/Toastify.css';
import './styles/AppLayout.css';
import Login from './pages/Login';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebase';

import OTPVerification from './pages/OTPVerification';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Cleanup from './pages/Cleanup';
import Community from './pages/Community';
import Extensions from './pages/Extensions';

import UpdateModal from './components/UpdateModal';

function TrayListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const api = globalThis.api;
    if (!api?.onTrayOpenFolder || !api?.onTrayNavigate) return;
    const unsubFolder = api.onTrayOpenFolder((path: string) => {
      sessionStorage.setItem('trayOpenPath', path);
      navigate('/home');
    });
    const unsubNav = api.onTrayNavigate((route: string) => {
      navigate(route);
    });
    return () => {
      unsubFolder();
      unsubNav();
    };
  }, [navigate]);
  return null;
}

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
          if (key?.startsWith('user_settings_')) {
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

      if (shouldCheck && globalThis.api?.updater) {
        globalThis.api.updater.check();
      }
    };

    checkForUpdates();

    // Event Listeners
    if (globalThis.api?.updater) {
      // ... existing handlers ...
      const cleanupAvailable = globalThis.api.updater.onAvailable((info: any) => {
        setUpdateState({
          isOpen: false,
          version: info.version,
          status: 'downloading',
          progress: 0
        });
      });

      const cleanupProgress = globalThis.api.updater.onProgress((info: any) => {
        setUpdateState((prev: any) => ({
          ...prev,
          status: 'downloading',
          progress: info.percent
        }));
      });

      const cleanupDownloaded = globalThis.api.updater.onDownloaded((info: any) => {
        setUpdateState({
          isOpen: true,
          version: info.version,
          status: 'ready',
          progress: 100
        });
      });

      if (globalThis.api.updater.onError) {
        const cleanupError = globalThis.api.updater.onError((error: string) => {
          toast.error(`Update Failed: ${error}`);
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

  const handleIgnore = () => {
    setUpdateState((prev: any) => ({ ...prev, isOpen: false }));
  };

  const handleRestart = () => {
    if (globalThis.api?.updater) {
      globalThis.api.updater.install();
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
        <TrayListener />
        <Routes>
          <Route path="/" element={user ? <Navigate to="/home" replace /> : <Login />} />
          <Route path="/verify" element={<OTPVerification />} />
          <Route path="/home" element={user ? <Home /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={user ? <Settings /> : <Navigate to="/" replace />} />
          <Route path="/cleanup" element={user ? <Cleanup /> : <Navigate to="/" replace />} />
          <Route path="/community" element={user ? <Community /> : <Navigate to="/" replace />} />
          <Route path="/extensions" element={user ? <Extensions /> : <Navigate to="/" replace />} />

        </Routes>
      </Router>
      <UpdateModal
        isOpen={updateState.isOpen}
        version={updateState.version}
        onIgnore={handleIgnore}
        onRestart={handleRestart}
      />
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar
        closeOnClick
        draggable
        pauseOnHover
        theme="dark"
      />
    </>
  )
}

export default App
