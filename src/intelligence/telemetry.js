/**
 * Behavioral Telemetry — capture user interaction patterns
 * @module telemetry
 */

const MAX_BUFFER = 500;

/**
 * @typedef {Object} TelemetryEvent
 * @property {'pointer'|'keyboard'|'scroll'|'focus'|'idle'} type
 * @property {number} timestamp
 * @property {Object} data
 */

class BehavioralTelemetry {
    constructor() {
        /** @type {TelemetryEvent[]} */
        this._buffer = [];
        this._isActive = false;
        this._lastActivity = Date.now();
        this._idleTimeout = null;
        /** @type {Set<(summary: Object) => void>} */
        this._listeners = new Set();
        this._pointerState = { x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, lastMove: 0, isMoving: false };
        this._keyboardState = { keys: [], dwellTimes: [], flightTimes: [], lastKeyDown: 0, lastKeyUp: 0, burstLength: 0, errorRate: 0, totalKeys: 0, backspaceCount: 0 };
        this._scrollState = { position: 0, velocity: 0, direction: 'none', lastScroll: 0 };
    }

    /** Start telemetry collection */
    start() {
        if (this._isActive) return;
        this._isActive = true;
        document.addEventListener('mousemove', this._onPointer, { passive: true });
        document.addEventListener('touchmove', this._onTouch, { passive: true });
        document.addEventListener('keydown', this._onKeyDown, { passive: true });
        document.addEventListener('keyup', this._onKeyUp, { passive: true });
        document.addEventListener('scroll', this._onScroll, { passive: true, capture: true });
        document.addEventListener('focusin', this._onFocus, { passive: true });
        this._idleCheckInterval = setInterval(() => this._checkIdle(), 2000);
    }

    /** Stop telemetry collection */
    stop() {
        this._isActive = false;
        document.removeEventListener('mousemove', this._onPointer);
        document.removeEventListener('touchmove', this._onTouch);
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('scroll', this._onScroll, { capture: true });
        document.removeEventListener('focusin', this._onFocus);
        clearInterval(this._idleCheckInterval);
    }

    _push(event) {
        this._buffer.push(event);
        if (this._buffer.length > MAX_BUFFER) this._buffer.shift();
        this._lastActivity = Date.now();
    }

    /** @type {(e: MouseEvent) => void} */
    _onPointer = (e) => {
        const now = performance.now();
        const dt = (now - this._pointerState.lastMove) / 1000;
        if (dt > 0) {
            const nvx = (e.clientX - this._pointerState.x) / dt;
            const nvy = (e.clientY - this._pointerState.y) / dt;
            this._pointerState.ax = (nvx - this._pointerState.vx) / dt;
            this._pointerState.ay = (nvy - this._pointerState.vy) / dt;
            this._pointerState.vx = nvx;
            this._pointerState.vy = nvy;
        }
        this._pointerState.x = e.clientX;
        this._pointerState.y = e.clientY;
        this._pointerState.lastMove = now;
        this._pointerState.isMoving = true;
        this._push({ type: 'pointer', timestamp: now, data: { x: e.clientX, y: e.clientY, vx: this._pointerState.vx, vy: this._pointerState.vy } });
    };

    /** @type {(e: TouchEvent) => void} */
    _onTouch = (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        const now = performance.now();
        this._push({ type: 'pointer', timestamp: now, data: { x: t.clientX, y: t.clientY, vx: 0, vy: 0 } });
    };

    /** @type {(e: KeyboardEvent) => void} */
    _onKeyDown = (e) => {
        const now = performance.now();
        const ks = this._keyboardState;
        if (ks.lastKeyUp > 0) {
            ks.flightTimes.push(now - ks.lastKeyUp);
            if (ks.flightTimes.length > 20) ks.flightTimes.shift();
        }
        ks.lastKeyDown = now;
        ks.totalKeys++;
        if (e.key === 'Backspace' || e.key === 'Delete') ks.backspaceCount++;
        ks.errorRate = ks.totalKeys > 5 ? ks.backspaceCount / ks.totalKeys : 0;

        // Burst detection — rapid consecutive keys
        if (ks.flightTimes.length > 0 && ks.flightTimes[ks.flightTimes.length - 1] < 200) {
            ks.burstLength++;
        } else {
            ks.burstLength = 1;
        }

        this._push({ type: 'keyboard', timestamp: now, data: { key: e.key, dwellTimes: [...ks.dwellTimes.slice(-10)], flightTimes: [...ks.flightTimes.slice(-10)], burstLength: ks.burstLength, errorRate: ks.errorRate } });
    };

    /** @type {(e: KeyboardEvent) => void} */
    _onKeyUp = (e) => {
        const now = performance.now();
        const ks = this._keyboardState;
        if (ks.lastKeyDown > 0) {
            ks.dwellTimes.push(now - ks.lastKeyDown);
            if (ks.dwellTimes.length > 20) ks.dwellTimes.shift();
        }
        ks.lastKeyUp = now;
    };

    /** @type {() => void} */
    _onScroll = () => {
        const now = performance.now();
        const newPos = window.scrollY;
        const dt = (now - this._scrollState.lastScroll) / 1000;
        if (dt > 0) this._scrollState.velocity = (newPos - this._scrollState.position) / dt;
        this._scrollState.direction = newPos > this._scrollState.position ? 'down' : newPos < this._scrollState.position ? 'up' : 'none';
        this._scrollState.position = newPos;
        this._scrollState.lastScroll = now;
        this._push({ type: 'scroll', timestamp: now, data: { position: newPos, velocity: this._scrollState.velocity, direction: this._scrollState.direction } });
    };

    /** @type {(e: FocusEvent) => void} */
    _onFocus = (e) => {
        const el = e.target;
        this._push({ type: 'focus', timestamp: performance.now(), data: { tag: el?.tagName, id: el?.id, className: el?.className?.split?.(' ')?.[0] } });
    };

    _checkIdle() {
        const idle = Date.now() - this._lastActivity;
        if (idle > 5000) {
            this._push({ type: 'idle', timestamp: performance.now(), data: { duration: idle } });
        }
    }

    /** Get recent events of a specific type */
    getRecent(type, count = 20) {
        return this._buffer.filter((e) => e.type === type).slice(-count);
    }

    /** Get behavioral summary */
    getSummary() {
        const pointerEvents = this._buffer.filter((e) => e.type === 'pointer');
        const kbEvents = this._buffer.filter((e) => e.type === 'keyboard');
        const scrollEvents = this._buffer.filter((e) => e.type === 'scroll');
        const idleEvents = this._buffer.filter((e) => e.type === 'idle');
        const avgSpeed = pointerEvents.length > 0
            ? pointerEvents.reduce((s, e) => s + Math.sqrt((e.data.vx || 0) ** 2 + (e.data.vy || 0) ** 2), 0) / pointerEvents.length
            : 0;

        return {
            pointer: {
                ...this._pointerState,
                avgSpeed,
                eventCount: pointerEvents.length,
            },
            keyboard: {
                avgDwell: avg(this._keyboardState.dwellTimes),
                avgFlight: avg(this._keyboardState.flightTimes),
                burstLength: this._keyboardState.burstLength,
                errorRate: this._keyboardState.errorRate,
                eventCount: kbEvents.length,
            },
            scroll: {
                ...this._scrollState,
                eventCount: scrollEvents.length,
            },
            idle: {
                totalIdleMs: idleEvents.reduce((s, e) => s + (e.data.duration || 0), 0),
                idleCount: idleEvents.length,
            },
            bufferSize: this._buffer.length,
        };
    }

    subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
}

function avg(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export const telemetry = new BehavioralTelemetry();
