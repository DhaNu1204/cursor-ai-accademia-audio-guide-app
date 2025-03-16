import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, useParams, useNavigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { OfflineDownloadProvider } from './contexts/OfflineDownloadContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { ValidationProvider } from './contexts/ValidationContext';
import './App.css';
import AudioTestPage from './pages/AudioTestPage';
import ExhibitList from './pages/ExhibitList';
import LanguageSelection from './pages/LanguageSelection';
import ValidationPage from './pages/ValidationPage';
import DownloadPage from './pages/DownloadPage';
import ExhibitDetails from './pages/ExhibitDetails';
import CacheInspector from './pages/CacheInspector';

// Debug component to log route changes
const RouteLogger = () => {
  const location = useLocation();
  
  useEffect(() => {
    console.log('Route changed:', {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state,
    });
    
    // Debug language info
    console.log('Language at route change:', {
      storedLanguage: localStorage.getItem('selectedLanguage'),
      documentLang: document.documentElement.lang,
      dataLangAttr: document.documentElement.getAttribute('data-language')
    });
  }, [location]);
  
  return null;
};

// Wrapper for ExhibitDetails to get URL parameters
const ExhibitDetailsWrapper = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const handleBack = () => {
    navigate('/exhibits');
  };
  
  return <ExhibitDetails exhibitId={id || ''} onBack={handleBack} />;
};

const App: React.FC = () => {
  // Handler for exhibit selection
  const handleExhibitSelect = (id: string) => {
    console.log(`Selected exhibit: ${id}`);
    // Navigate to the exhibit detail page using window.location for full page refresh
    window.location.href = `/exhibit/${id}`;
  };

  return (
    <OfflineDownloadProvider>
      <LanguageProvider>
        <ValidationProvider>
          <AudioPlayerProvider>
            <Router>
              <RouteLogger />
              <main>
                <Suspense fallback={<div className="loading-container">Loading...</div>}>
                  <Routes>
                    {/* Main application flow */}
                    <Route path="/" element={<Navigate to="/language" replace />} />
                    <Route path="/language" element={<LanguageSelection />} />
                    <Route path="/validation" element={<ValidationPage />} />
                    <Route path="/download" element={<DownloadPage />} />
                    <Route path="/exhibits" element={<ExhibitList onExhibitSelect={handleExhibitSelect} />} />
                    <Route path="/exhibit/:id" element={<ExhibitDetailsWrapper />} />
                    
                    {/* Developer tools */}
                    <Route path="/audio-test" element={<AudioTestPage />} />
                    <Route path="/cache-inspector" element={<CacheInspector />} />
                    
                    {/* Default route redirects to language selection */}
                    <Route path="*" element={<Navigate to="/language" replace />} />
                  </Routes>
                </Suspense>
              </main>
            </Router>
          </AudioPlayerProvider>
        </ValidationProvider>
      </LanguageProvider>
    </OfflineDownloadProvider>
  );
};

export default App;
