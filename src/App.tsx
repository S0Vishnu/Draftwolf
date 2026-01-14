import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/AppLayout.css';
import Login from './pages/Login';
import OTPVerification from './pages/OTPVerification';
import Home from './pages/Home';
import Settings from './pages/Settings';
import UpdateModal from './components/UpdateModal';


function App() {
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

      if (shouldCheck && (window as any).api?.updater) {
        (window as any).api.updater.check();
      }
    };

    checkForUpdates();

    // Event Listeners
    if ((window as any).api?.updater) {
      const cleanupAvailable = (window as any).api.updater.onAvailable((info: any) => {
        setUpdateState({
          isOpen: true,
          version: info.version,
          status: 'available',
          progress: 0
        });
      });

      const cleanupProgress = (window as any).api.updater.onProgress((info: any) => {
        setUpdateState((prev: any) => ({
          ...prev,
          status: 'downloading',
          progress: info.percent
        }));
      });

      const cleanupDownloaded = (window as any).api.updater.onDownloaded((info: any) => {
        setUpdateState((prev: any) => ({
          ...prev,
          version: info.version,
          status: 'ready',
          progress: 100
        }));
      });

      return () => {
        cleanupAvailable();
        cleanupProgress();
        cleanupDownloaded();
      };
    }
  }, []);

  const handleUpdate = () => {
    (window as any).api.updater.download();
    setUpdateState((prev: any) => ({ ...prev, status: 'downloading' }));
  };

  const handleIgnore = () => {
    setUpdateState((prev: any) => ({ ...prev, isOpen: false }));
  };

  const handleRestart = () => {
    (window as any).api.updater.install();
  };

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/verify" element={<OTPVerification />} />
          <Route path="/home" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
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
