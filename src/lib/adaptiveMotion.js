/**
 * Adaptive Motion System — framer-motion transitions adapted to device + emotion
 * @module adaptiveMotion
 */
import { contextEngine } from './contextEngine';
import { emotionalState } from './emotionalState';

class AdaptiveMotion {
    constructor() {
        this._ctx = contextEngine.getContext();
        this._exp = emotionalState.getExpression();
        /** @type {'full'|'moderate'|'subtle'|'none'} */
        this._intensity = 'full';

        contextEngine.subscribe((ctx) => { this._ctx = ctx; this._updateIntensity(); });
        emotionalState.subscribe((exp) => { this._exp = exp; });
        this._updateIntensity();
    }

    _updateIntensity() {
        if (this._ctx.motionPreference === 'none') { this._intensity = 'none'; return; }
        if (this._ctx.motionPreference === 'reduced') { this._intensity = 'subtle'; return; }
        if (this._ctx.performanceTier === 'minimal' || this._ctx.isLowPower) { this._intensity = 'subtle'; return; }
        if (this._ctx.performanceTier === 'low') { this._intensity = 'moderate'; return; }
        this._intensity = 'full';
    }

    /**
     * Get a spring transition adapted to current state
     * @param {Object} [base] - override stiffness/damping/mass
     * @returns {import('framer-motion').Transition}
     */
    spring(base = {}) {
        if (this._intensity === 'none') return { duration: 0 };
        const stiffness = base.stiffness ?? this._exp.springStiffness;
        const damping = base.damping ?? this._exp.springDamping;
        const scale = this._intensity === 'subtle' ? 2 : this._intensity === 'moderate' ? 1.3 : 1;
        return { type: 'spring', stiffness: stiffness * scale, damping: damping * scale, mass: base.mass ?? 1, ...base };
    }

    /**
     * Get a tween transition adapted to current state
     * @param {number} [duration=0.3]
     * @param {string} [ease='easeOut']
     */
    tween(duration = 0.3, ease = 'easeOut') {
        if (this._intensity === 'none') return { duration: 0 };
        const scale = this._intensity === 'subtle' ? 0.5 : this._intensity === 'moderate' ? 0.7 : 1;
        return { type: 'tween', duration: duration * scale, ease };
    }

    /** Get all 16 named animation presets */
    getPresets() {
        if (this._intensity === 'none') return this._instant();
        return {
            buttonPress: this.spring({ stiffness: 600, damping: 30 }),
            buttonHover: this.spring({ stiffness: 400, damping: 25 }),
            cardHover: this.spring({ stiffness: 300, damping: 30 }),
            cardPress: this.spring({ stiffness: 500, damping: 35 }),
            toggle: this.spring({ stiffness: 500, damping: 30 }),
            layoutShift: this.spring({ stiffness: 250, damping: 35 }),
            pageTransition: this.tween(0.4, 'easeInOut'),
            modalEnter: this.spring({ stiffness: 300, damping: 28 }),
            modalExit: this.tween(0.2, 'easeIn'),
            success: this.spring({ stiffness: 400, damping: 20 }),
            error: this.spring({ stiffness: 600, damping: 15 }),
            shake: { type: 'spring', stiffness: 800, damping: 10, mass: 0.5 },
            pulse: { type: 'tween', duration: this._exp.pulseRate || 1, repeat: Infinity, ease: 'easeInOut' },
            listItem: this.spring({ stiffness: 300, damping: 30 }),
            fadeIn: this.tween(0.3, 'easeOut'),
            scaleIn: this.spring({ stiffness: 350, damping: 28 }),
            slideIn: this.spring({ stiffness: 280, damping: 32 }),
        };
    }

    _instant() {
        const d = { duration: 0 };
        return {
            buttonPress: d, buttonHover: d, cardHover: d, cardPress: d, toggle: d,
            layoutShift: d, pageTransition: d, modalEnter: d, modalExit: d,
            success: d, error: d, shake: d, pulse: d,
            listItem: d, fadeIn: d, scaleIn: d, slideIn: d,
        };
    }

    /** Stagger configuration for list animations */
    stagger(itemCount) {
        if (this._intensity === 'none') return { staggerChildren: 0, delayChildren: 0 };
        const base = 0.05;
        const adjusted = Math.min(base, 0.5 / itemCount);
        const scale = this._intensity === 'subtle' ? 0.5 : this._intensity === 'moderate' ? 0.7 : 1;
        return { staggerChildren: adjusted * scale, delayChildren: 0.1 * scale };
    }

    getIntensity() { return this._intensity; }
    isEnabled() { return this._intensity !== 'none'; }
}

export const adaptiveMotion = new AdaptiveMotion();
