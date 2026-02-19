/**
 * Cognitive State Estimator — infer user cognitive state from telemetry
 * @module cognitiveState
 */
import { telemetry } from './telemetry';

/**
 * @typedef {Object} CognitiveProfile
 * @property {number} focus        — 0-1, how focused the user appears
 * @property {number} cognitiveLoad — 0-1, mental effort estimate
 * @property {number} confidence   — 0-1, how confident user actions appear
 * @property {number} fatigue      — 0-1, fatigue estimate
 * @property {number} intentClarity — 0-1, how purposeful navigation seems
 * @property {number} engagement   — 0-1, overall engagement level
 * @property {boolean} isInFlowState
 * @property {Object} recommendations
 */

class CognitiveStateEstimator {
    constructor() {
        /** @type {CognitiveProfile} */
        this._profile = this._defaultProfile();
        /** @type {Set<(p: CognitiveProfile) => void>} */
        this._listeners = new Set();
        this._intervalId = null;
        this._sessionStart = Date.now();
    }

    /** Start periodic estimation (every 500ms) */
    start() {
        telemetry.start();
        this._intervalId = setInterval(() => this._estimate(), 500);
    }

    stop() {
        clearInterval(this._intervalId);
        telemetry.stop();
    }

    _defaultProfile() {
        return {
            focus: 0.5,
            cognitiveLoad: 0.3,
            confidence: 0.5,
            fatigue: 0,
            intentClarity: 0.5,
            engagement: 0.5,
            isInFlowState: false,
            recommendations: { uiComplexity: 'standard', pacing: 'normal', feedbackVerbosity: 'normal' },
        };
    }

    _estimate() {
        const s = telemetry.getSummary();
        const session = (Date.now() - this._sessionStart) / 1000; // seconds

        // — Focus: low idle + steady pointer + consistent keyboard = high focus —
        const idleRatio = s.idle.totalIdleMs / Math.max(1, session * 1000);
        const pointerSteady = s.pointer.avgSpeed < 800 ? 1 : Math.max(0, 1 - (s.pointer.avgSpeed - 800) / 1000);
        const focus = clamp(1 - idleRatio * 2) * 0.4 + pointerSteady * 0.3 + (s.keyboard.eventCount > 0 ? 0.3 : 0);

        // — Cognitive load: high error rate + slow typing + erratic pointer —
        const errorSignal = Math.min(1, s.keyboard.errorRate * 3);
        const slowTyping = s.keyboard.avgDwell > 200 ? Math.min(1, (s.keyboard.avgDwell - 200) / 300) : 0;
        const erraticPointer = s.pointer.avgSpeed > 1200 ? Math.min(1, (s.pointer.avgSpeed - 1200) / 800) : 0;
        const cognitiveLoad = clamp(errorSignal * 0.4 + slowTyping * 0.3 + erraticPointer * 0.3);

        // — Confidence: fast flight times + low error rate + purposeful scrolling —
        const fastKeys = s.keyboard.avgFlight > 0 && s.keyboard.avgFlight < 150 ? 1 : s.keyboard.avgFlight < 300 ? 0.5 : 0;
        const lowErrors = 1 - Math.min(1, s.keyboard.errorRate * 4);
        const confidence = clamp(fastKeys * 0.35 + lowErrors * 0.35 + (1 - cognitiveLoad) * 0.3);

        // — Fatigue: increases with session duration + idle frequency —
        const sessionFatigue = Math.min(1, session / 3600); // ramps over 1 hour
        const idleFatigue = Math.min(1, s.idle.idleCount / 10);
        const fatigue = clamp(sessionFatigue * 0.6 + idleFatigue * 0.4);

        // — Intent clarity: burst length + scroll purposefulness —
        const typingIntent = s.keyboard.burstLength > 5 ? 1 : s.keyboard.burstLength / 5;
        const scrollIntent = Math.abs(s.scroll.velocity) > 100 && Math.abs(s.scroll.velocity) < 2000 ? 1 : 0.3;
        const intentClarity = clamp(typingIntent * 0.5 + scrollIntent * 0.3 + confidence * 0.2);

        // — Engagement: composite —
        const engagement = clamp(focus * 0.3 + intentClarity * 0.25 + confidence * 0.25 + (1 - fatigue) * 0.2);

        // — Flow state: high focus + high engagement + moderate load —
        const isInFlowState = focus > 0.7 && engagement > 0.7 && cognitiveLoad > 0.2 && cognitiveLoad < 0.7 && fatigue < 0.5;

        // — Recommendations —
        const uiComplexity = cognitiveLoad > 0.7 ? 'simplified' : cognitiveLoad < 0.3 ? 'enhanced' : 'standard';
        const pacing = fatigue > 0.6 ? 'relaxed' : isInFlowState ? 'flow' : 'normal';
        const feedbackVerbosity = confidence > 0.7 ? 'minimal' : confidence < 0.3 ? 'detailed' : 'normal';

        this._profile = {
            focus: smooth(this._profile.focus, focus),
            cognitiveLoad: smooth(this._profile.cognitiveLoad, cognitiveLoad),
            confidence: smooth(this._profile.confidence, confidence),
            fatigue: smooth(this._profile.fatigue, fatigue),
            intentClarity: smooth(this._profile.intentClarity, intentClarity),
            engagement: smooth(this._profile.engagement, engagement),
            isInFlowState,
            recommendations: { uiComplexity, pacing, feedbackVerbosity },
        };

        this._listeners.forEach((fn) => fn(this._profile));
    }

    /** @returns {CognitiveProfile} */
    getProfile() { return { ...this._profile }; }

    /** @param {(p: CognitiveProfile) => void} fn  @returns {() => void} */
    subscribe(fn) {
        this._listeners.add(fn);
        fn(this._profile);
        return () => this._listeners.delete(fn);
    }
}

function clamp(v) { return Math.max(0, Math.min(1, v)); }
function smooth(prev, next, factor = 0.3) { return prev + (next - prev) * factor; }

export const cognitiveState = new CognitiveStateEstimator();
