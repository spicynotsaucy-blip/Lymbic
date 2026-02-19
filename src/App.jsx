import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import SplashScreen from './screens/SplashScreen';
import OnboardingWizard from './screens/OnboardingWizard';
import GradeToday from './screens/GradeToday';
import ScanScreen from './screens/ScanScreen';
import ResultsDashboard from './screens/ResultsDashboard';

export default function App() {
  const location = useLocation();

  return (
    <div className="app-shell">
      {/* Ambient background orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />
      <div className="bg-gradient-radial" />
      <div className="bg-gradient-bottom" />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/onboarding" element={<OnboardingWizard />} />
          <Route path="/grade" element={<GradeToday />} />
          <Route path="/scan" element={<ScanScreen />} />
          <Route path="/results" element={<ResultsDashboard />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}
