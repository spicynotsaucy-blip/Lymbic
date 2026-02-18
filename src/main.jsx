import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { OnboardingProvider } from './context/OnboardingContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <OnboardingProvider>
        <App />
      </OnboardingProvider>
    </BrowserRouter>
  </StrictMode>
);
