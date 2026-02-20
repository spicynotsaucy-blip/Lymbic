import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdaptiveUIProvider } from './providers/AdaptiveUIProvider';
import { OnboardingProvider } from './context/OnboardingContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AdaptiveUIProvider>
          <OnboardingProvider>
            <App />
          </OnboardingProvider>
        </AdaptiveUIProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
