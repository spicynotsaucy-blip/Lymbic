/**
 * Predictive Interaction Engine — anticipate user actions before they happen
 * @module predictiveInteraction
 */

class PredictiveInteractionEngine {
    constructor() {
        /** @type {Map<string, {element: HTMLElement, probability: number, preloadFn?: Function, preAnimateFn?: Function}>} */
        this._predictions = new Map();
        /** @type {Array<{x: number, y: number, t: number}>} */
        this._mouseHistory = [];
        this._setupTracking();
    }

    _setupTracking() {
        document.addEventListener('mousemove', this._handleMouseMove.bind(this), { passive: true });
        document.addEventListener('touchmove', this._handleTouchMove.bind(this), { passive: true });
    }

    /** @param {MouseEvent} e */
    _handleMouseMove(e) {
        this._mouseHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (this._mouseHistory.length > 10) this._mouseHistory.shift();
        this._checkHoverIntent(e.clientX, e.clientY);
    }

    /** @param {TouchEvent} e */
    _handleTouchMove(e) {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        this._mouseHistory.push({ x: t.clientX, y: t.clientY, t: performance.now() });
        if (this._mouseHistory.length > 10) this._mouseHistory.shift();
    }

    /**
     * Register an element for prediction tracking
     * @param {string} id
     * @param {HTMLElement} element
     * @param {{onPreload?: Function, onPreAnimate?: Function}} [opts]
     * @returns {() => void} unregister function
     */
    track(id, element, opts = {}) {
        this._predictions.set(id, {
            element,
            probability: 0,
            preloadFn: opts.onPreload,
            preAnimateFn: opts.onPreAnimate,
        });
        return () => this._predictions.delete(id);
    }

    _checkHoverIntent(x, y) {
        const velocity = this._calcVelocity();

        for (const [, pred] of this._predictions) {
            const rect = pred.element.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

            const angleToEl = Math.atan2(cy - y, cx - x);
            const moveAngle = Math.atan2(velocity.y, velocity.x);
            const angleDiff = Math.abs(angleToEl - moveAngle);
            const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
            const isToward = angleDiff < Math.PI / 4;

            let prob = 0;
            if (isToward && speed > 0.5) {
                prob = Math.max(0, 1 - dist / 300) * Math.min(1, speed / 2) * (1 - angleDiff / (Math.PI / 4));
            }
            pred.probability = prob;

            if (prob > 0.7) this._triggerPre(pred);
        }
    }

    _calcVelocity() {
        if (this._mouseHistory.length < 2) return { x: 0, y: 0 };
        const recent = this._mouseHistory.slice(-5);
        const first = recent[0], last = recent[recent.length - 1];
        const dt = (last.t - first.t) / 1000;
        if (dt === 0) return { x: 0, y: 0 };
        return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
    }

    _triggerPre(pred) {
        const key = '_predicted';
        if (pred.element[key]) return;
        pred.element[key] = true;
        setTimeout(() => { pred.element[key] = false; }, 500);
        pred.preloadFn?.();
        pred.preAnimateFn?.();
    }

    /** @returns {'up'|'down'|'none'} */
    predictScrollIntent() {
        const v = this._calcVelocity();
        if (Math.abs(v.y) < 50) return 'none';
        return v.y > 0 ? 'down' : 'up';
    }

    getProbability(id) { return this._predictions.get(id)?.probability ?? 0; }
}

export const predictiveInteraction = new PredictiveInteractionEngine();
