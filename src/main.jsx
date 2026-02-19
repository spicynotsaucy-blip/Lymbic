import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdaptiveUIProvider } from './providers/AdaptiveUIProvider';
import { OnboardingProvider } from './context/OnboardingContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AdaptiveUIProvider>
        <OnboardingProvider>
          <App />
        </OnboardingProvider>
      </AdaptiveUIProvider>
    </BrowserRouter>
  </StrictMode>
);
