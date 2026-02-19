/**
 * Probabilistic Renderer — pre-compute likely next UI states
 * @module probabilisticRenderer
 */
import { cognitiveState } from './cognitiveState';
import { emotionalState } from '../lib/emotionalState';

const MAX_CACHED = 5;

/**
 * @typedef {Object} PredictedState
 * @property {string} id
 * @property {number} probability — 0 to 1
 * @property {Object} props — pre-computed component props
 * @property {number} computedAt
 * @property {boolean} isStale
 */

class ProbabilisticRenderer {
    constructor() {
        /** @type {PredictedState[]} */
        this._cache = [];
        /** @type {Map<string, (cognitive: Object, emotion: string) => PredictedState[]>} */
        this._predictors = new Map();
        this._staleDuration = 5000; // 5s before stale
        this._intervalId = null;
    }

    /**
     * Register a predictor function for a component
     * @param {string} componentId
     * @param {(cognitive: Object, emotion: string) => PredictedState[]} predictFn
     * @returns {() => void} unregister
     */
    register(componentId, predictFn) {
        this._predictors.set(componentId, predictFn);
        return () => this._predictors.delete(componentId);
    }

    /** Start prediction loop */
    start() {
        this._intervalId = setInterval(() => this._computePredictions(), 1000);
    }

    stop() {
        clearInterval(this._intervalId);
    }

    _computePredictions() {
        const cognitive = cognitiveState.getProfile();
        const emotion = emotionalState.getState();
        const now = Date.now();

        const allPredictions = [];
        for (const [, predictFn] of this._predictors) {
            try {
                const states = predictFn(cognitive, emotion);
                allPredictions.push(...states);
            } catch (_) { /* swallow predictor errors */ }
        }

        // Sort by probability, keep top N
        allPredictions.sort((a, b) => b.probability - a.probability);
        this._cache = allPredictions.slice(0, MAX_CACHED).map((s) => ({
            ...s,
            computedAt: now,
            isStale: false,
        }));
    }

    /**
     * Get pre-computed state for a component
     * @param {string} id
     * @returns {PredictedState | null}
     */
    getState(id) {
        const s = this._cache.find((c) => c.id === id);
        if (!s) return null;
        if (Date.now() - s.computedAt > this._staleDuration) s.isStale = true;
        return s;
    }

    /**
     * Get the most likely next state regardless of component
     * @returns {PredictedState | null}
     */
    getMostLikely() {
        return this._cache[0] || null;
    }

    /** Get all cached predictions */
    getAll() {
        const now = Date.now();
        return this._cache.map((s) => ({
            ...s,
            isStale: now - s.computedAt > this._staleDuration,
        }));
    }

    /** Invalidate a specific prediction */
    invalidate(id) {
        this._cache = this._cache.filter((s) => s.id !== id);
    }

    /** Clear all predictions */
    clear() {
        this._cache = [];
    }
}

export const probabilisticRenderer = new ProbabilisticRenderer();
