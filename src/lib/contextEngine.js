/**
 * Context Engine — Device, environment, and user context detection
 * @module contextEngine
 */

/**
 * @typedef {'high' | 'medium' | 'low' | 'minimal'} PerformanceTier
 * @typedef {'p3' | 'srgb' | 'limited'} ColorGamut
 * @typedef {'full' | 'reduced' | 'none'} MotionPreference
 *
 * @typedef {Object} UIContext
 * @property {PerformanceTier} performanceTier
 * @property {ColorGamut} colorGamut
 * @property {MotionPreference} motionPreference
 * @property {boolean} hasHaptics
 * @property {boolean} hasSoundOutput
 * @property {'mobile'|'tablet'|'desktop'|'large'} screenSize
 * @property {'touch'|'pointer'|'keyboard'|'mixed'} inputMethod
 * @property {'morning'|'day'|'evening'|'night'} timeOfDay
 * @property {boolean} isLowPower
 * @property {'fast'|'slow'|'offline'} connectionQuality
 * @property {boolean} hasCompletedOnboarding
 * @property {number} sessionDuration
 * @property {'fast'|'normal'|'slow'} interactionVelocity
 * @property {boolean} prefersDarkMode
 * @property {boolean} prefersHighContrast
 * @property {boolean} prefersLargeText
 * @property {boolean} screenReaderActive
 */

class ContextEngine {
    constructor() {
        /** @type {Set<(ctx: UIContext) => void>} */
        this._listeners = new Set();
        /** @type {number[]} */
        this._interactionTimestamps = [];
        this._sessionStart = Date.now();
        /** @type {UIContext} */
        this._context = this._detectInitialContext();
        this._setupListeners();
    }

    /** @returns {UIContext} */
    _detectInitialContext() {
        return {
            performanceTier: this._detectPerformanceTier(),
            colorGamut: this._detectColorGamut(),
            motionPreference: this._detectMotionPreference(),
            hasHaptics: 'vibrate' in navigator,
            hasSoundOutput: 'AudioContext' in window || 'webkitAudioContext' in window,
            screenSize: this._detectScreenSize(),
            inputMethod: this._detectInputMethod(),
            timeOfDay: this._detectTimeOfDay(),
            isLowPower: this._detectLowPower(),
            connectionQuality: this._detectConnectionQuality(),
            hasCompletedOnboarding: this._load('onboarding_complete', false),
            sessionDuration: 0,
            interactionVelocity: 'normal',
            prefersDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
            prefersHighContrast: window.matchMedia('(prefers-contrast: more)').matches,
            prefersLargeText: parseFloat(getComputedStyle(document.documentElement).fontSize) > 16,
            screenReaderActive: window.matchMedia('(forced-colors: active)').matches,
        };
    }

    /** @returns {PerformanceTier} */
    _detectPerformanceTier() {
        const memory = navigator.deviceMemory || 4;
        const cores = navigator.hardwareConcurrency || 2;

        let score = 0;
        if (memory >= 8) score += 3;
        else if (memory >= 4) score += 2;
        else if (memory >= 2) score += 1;

        if (cores >= 8) score += 3;
        else if (cores >= 4) score += 2;
        else if (cores >= 2) score += 1;

        // GPU check via WebGL
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
            const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
            if (/nvidia|radeon|intel.*(iris|uhd)/i.test(renderer)) score += 2;
        } catch (_) { /* ignore */ }

        if (this._detectLowPower()) score -= 2;

        if (score >= 6) return 'high';
        if (score >= 4) return 'medium';
        if (score >= 2) return 'low';
        return 'minimal';
    }

    /** @returns {ColorGamut} */
    _detectColorGamut() {
        if (window.matchMedia('(color-gamut: p3)').matches) return 'p3';
        if (window.matchMedia('(color-gamut: srgb)').matches) return 'srgb';
        return 'limited';
    }

    /** @returns {MotionPreference} */
    _detectMotionPreference() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
        if (this._detectLowPower()) return 'reduced';
        return 'full';
    }

    _detectScreenSize() {
        const w = window.innerWidth;
        if (w < 640) return 'mobile';
        if (w < 1024) return 'tablet';
        if (w < 1536) return 'desktop';
        return 'large';
    }

    _detectInputMethod() {
        const fine = window.matchMedia('(pointer: fine)').matches;
        const coarse = window.matchMedia('(pointer: coarse)').matches;
        if (fine && !coarse) return 'pointer';
        if (coarse && !fine) return 'touch';
        if (coarse && fine) return 'mixed';
        return 'keyboard';
    }

    _detectTimeOfDay() {
        const h = new Date().getHours();
        if (h >= 5 && h < 12) return 'morning';
        if (h >= 12 && h < 17) return 'day';
        if (h >= 17 && h < 21) return 'evening';
        return 'night';
    }

    _detectLowPower() {
        const conn = navigator.connection;
        if (conn?.saveData) return true;
        return false;
    }

    _detectConnectionQuality() {
        if (!navigator.onLine) return 'offline';
        const c = navigator.connection;
        if (c) {
            if (c.effectiveType === '4g') return 'fast';
            if (c.effectiveType === '3g' || c.effectiveType === '2g') return 'slow';
        }
        return 'fast';
    }

    _load(key, fallback) {
        try {
            const v = localStorage.getItem(`lymbic_${key}`);
            return v ? JSON.parse(v) : fallback;
        } catch { return fallback; }
    }

    _setupListeners() {
        window.addEventListener('resize', () => {
            this.updateContext({ screenSize: this._detectScreenSize() });
        });

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            this.updateContext({ prefersDarkMode: e.matches });
        });

        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            this.updateContext({ motionPreference: e.matches ? 'reduced' : 'full' });
        });

        window.addEventListener('online', () => {
            this.updateContext({ connectionQuality: this._detectConnectionQuality() });
        });
        window.addEventListener('offline', () => {
            this.updateContext({ connectionQuality: 'offline' });
        });

        // Track interaction velocity
        const recordInteraction = () => {
            const now = Date.now();
            this._interactionTimestamps.push(now);
            if (this._interactionTimestamps.length > 10) this._interactionTimestamps.shift();
            if (this._interactionTimestamps.length >= 3) {
                const intervals = [];
                for (let i = 1; i < this._interactionTimestamps.length; i++) {
                    intervals.push(this._interactionTimestamps[i] - this._interactionTimestamps[i - 1]);
                }
                const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const v = avg < 500 ? 'fast' : avg > 2000 ? 'slow' : 'normal';
                if (this._context.interactionVelocity !== v) this.updateContext({ interactionVelocity: v });
            }
        };
        document.addEventListener('click', recordInteraction);
        document.addEventListener('touchstart', recordInteraction);

        // Session duration + time of day refresh
        setInterval(() => {
            this.updateContext({
                sessionDuration: Math.floor((Date.now() - this._sessionStart) / 1000),
                timeOfDay: this._detectTimeOfDay(),
            });
        }, 60000);

        // Battery API (async)
        if ('getBattery' in navigator) {
            navigator.getBattery().then((battery) => {
                const check = () => {
                    if (battery.level < 0.2 && !battery.charging) {
                        this.updateContext({ isLowPower: true, motionPreference: 'reduced' });
                    }
                };
                check();
                battery.addEventListener('levelchange', check);
                battery.addEventListener('chargingchange', check);
            });
        }
    }

    /** @param {Partial<UIContext>} partial */
    updateContext(partial) {
        this._context = { ...this._context, ...partial };
        this._listeners.forEach((fn) => fn(this._context));
    }

    /** @returns {UIContext} */
    getContext() { return { ...this._context }; }

    /** @param {(ctx: UIContext) => void} fn  @returns {() => void} */
    subscribe(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    completeOnboarding() {
        localStorage.setItem('lymbic_onboarding_complete', 'true');
        this.updateContext({ hasCompletedOnboarding: true });
    }
}

export const contextEngine = new ContextEngine();
