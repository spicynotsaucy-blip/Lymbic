import { createContext, useContext, useState } from 'react';

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
    const [data, setData] = useState({
        teacherName: '',
        subject: '',
        gradeLevel: '',
        intent: '',
        studentCount: 30,
    });

    // Holds the real pipeline result after a scan (single-scan flow)
    const [scanResult, setScanResult] = useState(null);

    // Holds multiple scan results from batch mode
    const [scanHistory, setScanHistory] = useState([]);

    const updateData = (updates) => {
        setData(prev => ({ ...prev, ...updates }));
    };

    const addScanResult = (result) => {
        setScanHistory(prev => [result, ...prev]);
    };

    const clearScanHistory = () => {
        setScanHistory([]);
        setScanResult(null);
    };

    return (
        <OnboardingContext.Provider value={{
            data, updateData,
            scanResult, setScanResult,
            scanHistory, addScanResult, clearScanHistory,
        }}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
    return ctx;
}
