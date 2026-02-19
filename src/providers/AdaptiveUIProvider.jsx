/**
 * AdaptiveUIProvider — React context provider that injects dynamic CSS custom properties
 * @module AdaptiveUIProvider
 */
import { useEffect, createContext, useContext } from 'react';
import { useAdaptiveUI } from '../hooks/useAdaptiveUI';
import { cognitiveState } from '../intelligence/cognitiveState';

const AdaptiveUIContext = createContext(null);

/**
 * Wraps the app tree and applies dynamic CSS custom properties to :root
 * on every emotional/context change.
 */
export function AdaptiveUIProvider({ children }) {
    const adaptive = useAdaptiveUI();

    // Start cognitive estimator on mount
    useEffect(() => {
        cognitiveState.start();
        return () => cognitiveState.stop();
    }, []);

    // Apply CSS custom properties to document root
    useEffect(() => {
        const root = document.documentElement;
        for (const [prop, value] of Object.entries(adaptive.cssProperties)) {
            root.style.setProperty(prop, value);
        }
    }, [adaptive.cssProperties]);

    return (
        <AdaptiveUIContext.Provider value={adaptive}>
            {children}
        </AdaptiveUIContext.Provider>
    );
}

/**
 * Hook to access the adaptive UI context from any component
 * @returns {ReturnType<typeof useAdaptiveUI>}
 */
export function useAdaptiveContext() {
    const ctx = useContext(AdaptiveUIContext);
    if (!ctx) {
        throw new Error('useAdaptiveContext must be used within <AdaptiveUIProvider>');
    }
    return ctx;
}
