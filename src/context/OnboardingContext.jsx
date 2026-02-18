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

    // Holds the real pipeline result after a scan
    const [scanResult, setScanResult] = useState(null);

    const updateData = (updates) => {
        setData(prev => ({ ...prev, ...updates }));
    };

    return (
        <OnboardingContext.Provider value={{ data, updateData, scanResult, setScanResult }}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
    return ctx;
}
