/**
 * Physics Orchestrator — unified spring physics with force fields
 * @module physicsOrchestrator
 */
import { cognitiveState } from './cognitiveState';
import { contextEngine } from '../lib/contextEngine';

/**
 * @typedef {Object} SpringBody
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} mass
 * @property {number} stiffness
 * @property {number} damping
 * @property {number} targetX
 * @property {number} targetY
 */

/**
 * @typedef {Object} ForceField
 * @property {string} id
 * @property {'attractor'|'repeller'|'vortex'|'noise'} type
 * @property {number} x
 * @property {number} y
 * @property {number} strength
 * @property {number} radius
 */

class PhysicsOrchestrator {
    constructor() {
        /** @type {Map<string, SpringBody>} */
        this._bodies = new Map();
        /** @type {Map<string, ForceField>} */
        this._fields = new Map();
        this._timeScale = 1;
        this._isRunning = false;
        this._animFrame = null;
        this._lastTick = 0;
        /** @type {Set<(bodies: Map<string, SpringBody>) => void>} */
        this._listeners = new Set();

        cognitiveState.subscribe((profile) => {
            this._timeScale = profile.isInFlowState ? 1.2 : profile.fatigue > 0.7 ? 0.7 : 1;
        });
    }

    /**
     * Add a spring body
     * @param {SpringBody} body
     */
    addBody(body) {
        this._bodies.set(body.id, {
            x: body.x ?? 0,
            y: body.y ?? 0,
            vx: body.vx ?? 0,
            vy: body.vy ?? 0,
            mass: body.mass ?? 1,
            stiffness: body.stiffness ?? 300,
            damping: body.damping ?? 20,
            targetX: body.targetX ?? body.x ?? 0,
            targetY: body.targetY ?? body.y ?? 0,
            ...body,
        });
        if (!this._isRunning && this._bodies.size > 0) this.start();
    }

    removeBody(id) {
        this._bodies.delete(id);
        if (this._bodies.size === 0) this.stop();
    }

    /**
     * Add a force field
     * @param {ForceField} field
     */
    addField(field) {
        this._fields.set(field.id, field);
    }

    removeField(id) {
        this._fields.delete(id);
    }

    start() {
        if (this._isRunning) return;
        this._isRunning = true;
        this._lastTick = performance.now();
        this._tick();
    }

    stop() {
        this._isRunning = false;
        if (this._animFrame) cancelAnimationFrame(this._animFrame);
    }

    _tick() {
        if (!this._isRunning) return;
        const now = performance.now();
        const rawDt = Math.min((now - this._lastTick) / 1000, 0.033); // cap at 30fps
        const dt = rawDt * this._timeScale;
        this._lastTick = now;

        // Skip physics on minimal-tier devices
        const ctx = contextEngine.getContext();
        if (ctx.performanceTier === 'minimal') {
            this._snapToTargets();
            this._notify();
            this._animFrame = requestAnimationFrame(() => this._tick());
            return;
        }

        for (const [, body] of this._bodies) {
            // Spring force toward target
            const dx = body.targetX - body.x;
            const dy = body.targetY - body.y;
            let fx = dx * body.stiffness - body.vx * body.damping;
            let fy = dy * body.stiffness - body.vy * body.damping;

            // External force fields
            for (const [, field] of this._fields) {
                const fdx = field.x - body.x;
                const fdy = field.y - body.y;
                const dist = Math.sqrt(fdx * fdx + fdy * fdy);
                if (dist > field.radius || dist < 0.01) continue;
                const falloff = 1 - dist / field.radius;

                switch (field.type) {
                    case 'attractor':
                        fx += (fdx / dist) * field.strength * falloff;
                        fy += (fdy / dist) * field.strength * falloff;
                        break;
                    case 'repeller':
                        fx -= (fdx / dist) * field.strength * falloff;
                        fy -= (fdy / dist) * field.strength * falloff;
                        break;
                    case 'vortex':
                        fx += (-fdy / dist) * field.strength * falloff * 0.5;
                        fy += (fdx / dist) * field.strength * falloff * 0.5;
                        break;
                    case 'noise':
                        fx += (Math.random() - 0.5) * field.strength * falloff;
                        fy += (Math.random() - 0.5) * field.strength * falloff;
                        break;
                }
            }

            // Integration (semi-implicit Euler)
            const ax = fx / body.mass;
            const ay = fy / body.mass;
            body.vx += ax * dt;
            body.vy += ay * dt;
            body.x += body.vx * dt;
            body.y += body.vy * dt;

            // Rest detection
            if (Math.abs(body.vx) < 0.01 && Math.abs(body.vy) < 0.01 &&
                Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
                body.x = body.targetX;
                body.y = body.targetY;
                body.vx = 0;
                body.vy = 0;
            }
        }

        this._notify();
        this._animFrame = requestAnimationFrame(() => this._tick());
    }

    _snapToTargets() {
        for (const [, body] of this._bodies) {
            body.x = body.targetX;
            body.y = body.targetY;
            body.vx = 0;
            body.vy = 0;
        }
    }

    _notify() {
        this._listeners.forEach((fn) => fn(this._bodies));
    }

    getBody(id) {
        const b = this._bodies.get(id);
        return b ? { ...b } : null;
    }

    setTarget(id, x, y) {
        const b = this._bodies.get(id);
        if (b) { b.targetX = x; b.targetY = y; }
    }

    /**
     * Create a spring config adapted to cognitive state
     * @param {'default'|'gentle'|'snappy'|'bouncy'} preset
     */
    createSpringConfig(preset = 'default') {
        const profile = cognitiveState.getProfile();
        const base = {
            default: { stiffness: 300, damping: 20 },
            gentle: { stiffness: 150, damping: 30 },
            snappy: { stiffness: 600, damping: 35 },
            bouncy: { stiffness: 400, damping: 12 },
        }[preset] || { stiffness: 300, damping: 20 };

        // Adapt to cognitive state
        const focusScale = 0.8 + profile.focus * 0.4;         // more focused = snappier
        const fatigueScale = 1 + profile.fatigue * 0.3;       // fatigued = slower, gentler
        const confidenceScale = 0.9 + profile.confidence * 0.2; // confident = slightly snappier

        return {
            stiffness: base.stiffness * focusScale * confidenceScale / fatigueScale,
            damping: base.damping * fatigueScale,
            mass: 1,
        };
    }

    subscribe(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }
}

export const physicsOrchestrator = new PhysicsOrchestrator();
