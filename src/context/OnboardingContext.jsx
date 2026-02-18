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

    const updateData = (updates) => {
        setData(prev => ({ ...prev, ...updates }));
    };

    return (
        <OnboardingContext.Provider value={{ data, updateData }}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
    return ctx;
}
