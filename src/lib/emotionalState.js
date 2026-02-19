/**
 * Emotional State Machine — UI mood management with adaptive expression
 * @module emotionalState
 */
import { contextEngine } from './contextEngine';

/**
 * @typedef {'neutral'|'success'|'error'|'warning'|'learning'|'focus'|'celebration'|'encouragement'|'urgency'} EmotionalState
 *
 * @typedef {Object} EmotionalExpression
 * @property {number} primaryHue
 * @property {number} accentHue
 * @property {number} saturation
 * @property {number} luminanceShift
 * @property {number} springStiffness
 * @property {number} springDamping
 * @property {number} animationScale
 * @property {number} pulseRate
 * @property {number} glowIntensity
 * @property {number} blurAmount
 * @property {number} particleDensity
 * @property {'bright'|'warm'|'sharp'|'soft'|'none'} soundProfile
 * @property {number[]} hapticPattern
 */

/** @type {Record<EmotionalState, EmotionalExpression>} */
const PRESETS = {
    neutral: { primaryHue: 270, accentHue: 280, saturation: 60, luminanceShift: 0, springStiffness: 300, springDamping: 30, animationScale: 1, pulseRate: 0, glowIntensity: 0.3, blurAmount: 20, particleDensity: 0, soundProfile: 'none', hapticPattern: [] },
    success: { primaryHue: 150, accentHue: 270, saturation: 75, luminanceShift: 5, springStiffness: 400, springDamping: 25, animationScale: 1.1, pulseRate: 0, glowIntensity: 0.6, blurAmount: 25, particleDensity: 30, soundProfile: 'bright', hapticPattern: [10, 50, 10] },
    error: { primaryHue: 0, accentHue: 270, saturation: 80, luminanceShift: -5, springStiffness: 600, springDamping: 15, animationScale: 1.05, pulseRate: 2, glowIntensity: 0.5, blurAmount: 15, particleDensity: 0, soundProfile: 'sharp', hapticPattern: [50, 100, 50, 100, 50] },
    warning: { primaryHue: 45, accentHue: 270, saturation: 85, luminanceShift: 0, springStiffness: 350, springDamping: 28, animationScale: 1, pulseRate: 1, glowIntensity: 0.4, blurAmount: 18, particleDensity: 0, soundProfile: 'warm', hapticPattern: [30, 80, 30] },
    learning: { primaryHue: 200, accentHue: 270, saturation: 70, luminanceShift: 3, springStiffness: 250, springDamping: 35, animationScale: 1, pulseRate: 0.5, glowIntensity: 0.45, blurAmount: 22, particleDensity: 10, soundProfile: 'soft', hapticPattern: [5, 30] },
    focus: { primaryHue: 270, accentHue: 290, saturation: 50, luminanceShift: -3, springStiffness: 200, springDamping: 40, animationScale: 0.98, pulseRate: 0, glowIntensity: 0.2, blurAmount: 30, particleDensity: 0, soundProfile: 'none', hapticPattern: [] },
    celebration: { primaryHue: 280, accentHue: 45, saturation: 90, luminanceShift: 10, springStiffness: 500, springDamping: 20, animationScale: 1.2, pulseRate: 0, glowIntensity: 0.8, blurAmount: 25, particleDensity: 100, soundProfile: 'bright', hapticPattern: [10, 30, 10, 30, 10, 100, 10] },
    encouragement: { primaryHue: 260, accentHue: 170, saturation: 65, luminanceShift: 5, springStiffness: 280, springDamping: 32, animationScale: 1.05, pulseRate: 0.3, glowIntensity: 0.5, blurAmount: 20, particleDensity: 15, soundProfile: 'warm', hapticPattern: [5, 20, 5] },
    urgency: { primaryHue: 15, accentHue: 270, saturation: 85, luminanceShift: 0, springStiffness: 550, springDamping: 18, animationScale: 1, pulseRate: 3, glowIntensity: 0.6, blurAmount: 12, particleDensity: 0, soundProfile: 'sharp', hapticPattern: [100, 50, 100] },
};

class EmotionalStateMachine {
    constructor() {
        /** @type {EmotionalState} */
        this._currentState = 'neutral';
        /** @type {EmotionalExpression} */
        this._currentExpression = { ...PRESETS.neutral };
        /** @type {EmotionalExpression} */
        this._targetExpression = { ...PRESETS.neutral };
        this._transitionProgress = 1;
        /** @type {Set<(exp: EmotionalExpression, state: EmotionalState) => void>} */
        this._listeners = new Set();
        this._animationFrame = null;
        this._ctx = contextEngine.getContext();

        contextEngine.subscribe((ctx) => {
            this._ctx = ctx;
            this._adaptToContext();
        });
    }

    /**
     * Transition to a new emotional state
     * @param {EmotionalState} state
     * @param {{ duration?: number, immediate?: boolean }} [options]
     */
    transitionTo(state, options = {}) {
        const { duration = 400, immediate = false } = options;
        if (this._currentState === state && this._transitionProgress === 1) return;

        this._currentState = state;
        this._targetExpression = this._computeAdapted(state);

        if (immediate) {
            this._currentExpression = { ...this._targetExpression };
            this._transitionProgress = 1;
            this._notify();
            return;
        }

        this._transitionProgress = 0;
        this._animateTransition(duration);
        this._triggerHaptic(state);
    }

    /** @param {EmotionalState} state  @returns {EmotionalExpression} */
    _computeAdapted(state) {
        const base = { ...PRESETS[state] };

        // Performance scaling
        if (this._ctx.performanceTier === 'low' || this._ctx.performanceTier === 'minimal') {
            base.particleDensity = Math.floor(base.particleDensity * 0.3);
            base.blurAmount = Math.min(base.blurAmount, 10);
            base.glowIntensity *= 0.7;
        }

        // Motion preference
        if (this._ctx.motionPreference === 'reduced') {
            base.animationScale = 1;
            base.pulseRate = 0;
            base.springStiffness = 1000;
            base.springDamping = 100;
            base.particleDensity = 0;
        } else if (this._ctx.motionPreference === 'none') {
            base.animationScale = 1;
            base.pulseRate = 0;
            base.particleDensity = 0;
        }

        // High contrast
        if (this._ctx.prefersHighContrast) {
            base.saturation = Math.min(100, base.saturation * 1.3);
            base.luminanceShift = base.luminanceShift > 0 ? 15 : -15;
            base.glowIntensity = 0;
        }

        // Night mode
        if (this._ctx.timeOfDay === 'night' || this._ctx.timeOfDay === 'evening') {
            base.luminanceShift -= 3;
            base.saturation *= 0.9;
        }

        if (!this._ctx.hasSoundOutput || this._ctx.isLowPower) base.soundProfile = 'none';
        return base;
    }

    _adaptToContext() {
        this._targetExpression = this._computeAdapted(this._currentState);
        if (this._transitionProgress === 1) {
            this._currentExpression = { ...this._targetExpression };
            this._notify();
        }
    }

    /** @param {number} duration */
    _animateTransition(duration) {
        if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
        const start = { ...this._currentExpression };
        const t0 = performance.now();

        const tick = (now) => {
            const elapsed = now - t0;
            this._transitionProgress = Math.min(1, elapsed / duration);
            const eased = 1 - Math.pow(1 - this._transitionProgress, 3);
            this._currentExpression = this._interpolate(start, this._targetExpression, eased);
            this._notify();
            if (this._transitionProgress < 1) this._animationFrame = requestAnimationFrame(tick);
        };
        this._animationFrame = requestAnimationFrame(tick);
    }

    _interpolate(from, to, t) {
        const lerp = (a, b) => a + (b - a) * t;
        const lerpHue = (a, b) => {
            let diff = b - a;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            return (a + diff * t + 360) % 360;
        };
        return {
            primaryHue: lerpHue(from.primaryHue, to.primaryHue),
            accentHue: lerpHue(from.accentHue, to.accentHue),
            saturation: lerp(from.saturation, to.saturation),
            luminanceShift: lerp(from.luminanceShift, to.luminanceShift),
            springStiffness: lerp(from.springStiffness, to.springStiffness),
            springDamping: lerp(from.springDamping, to.springDamping),
            animationScale: lerp(from.animationScale, to.animationScale),
            pulseRate: lerp(from.pulseRate, to.pulseRate),
            glowIntensity: lerp(from.glowIntensity, to.glowIntensity),
            blurAmount: lerp(from.blurAmount, to.blurAmount),
            particleDensity: Math.round(lerp(from.particleDensity, to.particleDensity)),
            soundProfile: t > 0.5 ? to.soundProfile : from.soundProfile,
            hapticPattern: to.hapticPattern,
        };
    }

    _triggerHaptic(state) {
        if (!this._ctx.hasHaptics || this._ctx.motionPreference !== 'full') return;
        const pattern = PRESETS[state].hapticPattern;
        if (pattern.length > 0 && 'vibrate' in navigator) navigator.vibrate(pattern);
    }

    /** @returns {EmotionalExpression} */
    getExpression() { return { ...this._currentExpression }; }

    /** @returns {EmotionalState} */
    getState() { return this._currentState; }

    /** @param {(exp: EmotionalExpression, state: EmotionalState) => void} fn  @returns {() => void} */
    subscribe(fn) {
        this._listeners.add(fn);
        fn(this._currentExpression, this._currentState);
        return () => this._listeners.delete(fn);
    }

    _notify() {
        this._listeners.forEach((fn) => fn(this._currentExpression, this._currentState));
    }

    /** Generate CSS custom properties from current expression */
    toCSSProperties() {
        const e = this._currentExpression;
        return {
            '--emotion-primary-h': `${e.primaryHue}`,
            '--emotion-primary-s': `${e.saturation}%`,
            '--emotion-primary-l': `${50 + e.luminanceShift}%`,
            '--emotion-accent-h': `${e.accentHue}`,
            '--emotion-glow-intensity': `${e.glowIntensity}`,
            '--emotion-blur': `${e.blurAmount}px`,
            '--emotion-scale': `${e.animationScale}`,
            '--emotion-pulse-rate': `${e.pulseRate}s`,
            '--emotion-spring-stiffness': `${e.springStiffness}`,
            '--emotion-spring-damping': `${e.springDamping}`,
        };
    }
}

export const emotionalState = new EmotionalStateMachine();

// Expose globally for console debugging
if (typeof window !== 'undefined') window.__emotionalState = emotionalState;
