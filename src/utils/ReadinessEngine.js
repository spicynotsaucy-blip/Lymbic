// ═══════════════════════════════════════════════════════════
//  READINESS ENGINE — Unified capture-readiness assessment
//  Computes a single "ready to capture" decision from 7 signals.
//  Runs every frame; provides blocking reasons + user guidance.
// ═══════════════════════════════════════════════════════════

export class ReadinessEngine {
    constructor(config = {}) {
        this.config = {
            thresholds: {
                quadConfidence: 0.7,
                stability: 0.85,
                qualityEstimate: 0.5,
                edgeDensity: 0.1,
                aspectRatio: { min: 0.5, max: 2.0 },
                coverage: 0.15,
                focusScore: 0.4,
            },
            stabilityDuration: 500, // ms of continuous stability required
            weights: {
                quadConfidence: 0.25,
                stability: 0.25,
                qualityEstimate: 0.20,
                edgeDensity: 0.15,
                coverage: 0.15,
            },
            ...config,
        };

        this.state = {
            stableSince: null,
            frameHistory: [],
        };
    }

    // ─── Main assessment — call every detection frame ─────────
    assess(input) {
        const { detected, quad, confidence, frameData, timestamp = Date.now() } = input;

        if (!detected || !quad || !this._isValidQuad(quad)) {
            return this._failedAssessment('NO_DOCUMENT', 'No document detected in frame');
        }

        const factors = {
            quadConfidence: confidence || 0,
            stability: this._calcStability(quad, timestamp),
            qualityEstimate: frameData ? this._estimateQuality(frameData) : 0.7,
            edgeDensity: frameData ? this._measureEdgeDensity(frameData, quad) : 0.5,
            aspectRatio: this._calcAspectRatio(quad),
            coverage: this._calcCoverage(quad, frameData),
            focusScore: frameData ? this._estimateFocus(frameData, quad) : 0.6,
        };

        const blocks = this._checkBlocks(factors);
        if (blocks.length > 0) return this._blockedAssessment(blocks, factors);

        const score = this._compositeScore(factors);
        const stabilityMet = this._stabilityDurationMet(timestamp);
        const guidance = this._generateGuidance(factors, stabilityMet);

        return {
            ready: score >= 0.7 && stabilityMet,
            score,
            factors,
            stabilityMet,
            stabilityProgress: this._stabilityProgress(timestamp),
            guidance,
            blockingReasons: [],
            timestamp,
            quad: [...quad],
        };
    }

    // ─── Quad validation ──────────────────────────────────────
    _isValidQuad(quad) {
        if (!Array.isArray(quad) || quad.length !== 4) return false;
        for (const p of quad) {
            if (typeof p.x !== 'number' || typeof p.y !== 'number') return false;
            if (!isFinite(p.x) || !isFinite(p.y)) return false;
        }
        const xs = quad.map(p => p.x);
        const ys = quad.map(p => p.y);
        if (Math.max(...xs) - Math.min(...xs) < 10) return false;
        if (Math.max(...ys) - Math.min(...ys) < 10) return false;
        return !this._isSelfIntersecting(quad);
    }

    _isSelfIntersecting(quad) {
        const [a, b, c, d] = quad;
        const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
        const intersects = (p1, p2, p3, p4) =>
            ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
        return intersects(a, b, c, d) || intersects(b, c, d, a);
    }

    // ─── Stability (quad jitter over last 10 frames) ─────────
    _calcStability(quad, timestamp) {
        this.state.frameHistory.push({ quad, timestamp });
        if (this.state.frameHistory.length > 10) this.state.frameHistory.shift();
        if (this.state.frameHistory.length < 3) return 0;

        let totalMovement = 0;
        let comparisons = 0;
        for (let i = 1; i < this.state.frameHistory.length; i++) {
            const prev = this.state.frameHistory[i - 1].quad;
            const curr = this.state.frameHistory[i].quad;
            let fm = 0;
            for (let c = 0; c < 4; c++) fm += Math.hypot(curr[c].x - prev[c].x, curr[c].y - prev[c].y);
            totalMovement += fm / 4;
            comparisons++;
        }

        const stability = Math.max(0, 1 - totalMovement / comparisons / 10);

        if (stability >= this.config.thresholds.stability) {
            if (!this.state.stableSince) this.state.stableSince = timestamp;
        } else {
            this.state.stableSince = null;
        }
        return stability;
    }

    // ─── Quick quality estimate (brightness + contrast) ───────
    _estimateQuality(frameData) {
        if (!frameData?.data) return 0.5;
        const { data } = frameData;
        let brightness = 0, min = 255, max = 0, samples = 0;
        for (let i = 0; i < data.length; i += 40) {
            const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
            brightness += g;
            if (g < min) min = g;
            if (g > max) max = g;
            samples++;
        }
        brightness /= samples;
        return ((1 - Math.abs(brightness - 128) / 128) + Math.min(1, (max - min) / 150)) / 2;
    }

    // ─── Edge density (blank-wall detector) ───────────────────
    _measureEdgeDensity(frameData, quad) {
        if (!frameData?.data) return 0.5;
        const { data, width } = frameData;
        const xs = quad.map(p => p.x);
        const ys = quad.map(p => p.y);
        const minX = Math.max(0, Math.floor(Math.min(...xs)));
        const maxX = Math.min(width - 2, Math.ceil(Math.max(...xs)));
        const minY = Math.max(0, Math.floor(Math.min(...ys)));
        const maxY = Math.min((data.length / (width * 4)) - 2, Math.ceil(Math.max(...ys)));

        let edges = 0, count = 0;
        for (let y = minY + 1; y < maxY; y += 4) {
            for (let x = minX + 1; x < maxX; x += 4) {
                const idx = (y * width + x) * 4;
                const g = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                const gR = (data[idx + 4] + data[idx + 5] + data[idx + 6]) / 3;
                const idxD = ((y + 1) * width + x) * 4;
                const gD = (data[idxD] + data[idxD + 1] + data[idxD + 2]) / 3;
                if (Math.sqrt((gR - g) ** 2 + (gD - g) ** 2) > 20) edges++;
                count++;
            }
        }
        return count > 0 ? edges / count : 0;
    }

    // ─── Aspect ratio from quad corners ───────────────────────
    _calcAspectRatio(quad) {
        const w = (Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y) +
            Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y)) / 2;
        const h = (Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y) +
            Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y)) / 2;
        return h > 0 ? w / h : 0;
    }

    // ─── Frame coverage ───────────────────────────────────────
    _calcCoverage(quad, frameData) {
        const quadArea = this._polygonArea(quad);
        const frameArea = frameData
            ? frameData.width * frameData.height
            : Math.max(...quad.map(p => p.x)) * Math.max(...quad.map(p => p.y)) * 1.5;
        return frameArea > 0 ? quadArea / frameArea : 0;
    }

    // ─── Focus / sharpness via Laplacian variance ─────────────
    _estimateFocus(frameData, quad) {
        if (!frameData?.data) return 0.6;
        const { data, width, height } = frameData;
        const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
        const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
        let variance = 0, count = 0;

        for (let dy = -15; dy <= 15; dy++) {
            for (let dx = -15; dx <= 15; dx++) {
                const x = Math.floor(cx + dx), y = Math.floor(cy + dy);
                if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) continue;
                const idx = (y * width + x) * 4;
                const g = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                const gL = (data[idx - 4] + data[idx - 3] + data[idx - 2]) / 3;
                const gR = (data[idx + 4] + data[idx + 5] + data[idx + 6]) / 3;
                const gU = (data[((y - 1) * width + x) * 4] + data[((y - 1) * width + x) * 4 + 1] + data[((y - 1) * width + x) * 4 + 2]) / 3;
                const gD = (data[((y + 1) * width + x) * 4] + data[((y + 1) * width + x) * 4 + 1] + data[((y + 1) * width + x) * 4 + 2]) / 3;
                const lap = Math.abs(gL + gR + gU + gD - 4 * g);
                variance += lap * lap;
                count++;
            }
        }
        return Math.min(1, (count > 0 ? variance / count : 0) / 2000);
    }

    // ─── Blocking conditions ──────────────────────────────────
    _checkBlocks(factors) {
        const blocks = [];
        const { thresholds } = this.config;

        if (factors.quadConfidence < 0.3)
            blocks.push({ code: 'LOW_CONFIDENCE', message: 'Document detection is uncertain', severity: 'critical' });
        if (factors.edgeDensity < thresholds.edgeDensity)
            blocks.push({ code: 'NO_CONTENT', message: 'No document content detected — might be a blank surface', severity: 'critical' });
        if (factors.aspectRatio < thresholds.aspectRatio.min || factors.aspectRatio > thresholds.aspectRatio.max)
            blocks.push({ code: 'INVALID_SHAPE', message: "Detected shape doesn't look like a document", severity: 'warning' });
        if (factors.coverage < thresholds.coverage)
            blocks.push({ code: 'TOO_FAR', message: 'Document is too small — move closer', severity: 'warning' });
        if (factors.coverage > 0.95)
            blocks.push({ code: 'TOO_CLOSE', message: 'Document edges may be cut off — move back', severity: 'warning' });
        if (factors.focusScore < thresholds.focusScore)
            blocks.push({ code: 'BLURRY', message: 'Image appears blurry — hold steady', severity: 'warning' });

        return blocks;
    }

    // ─── Composite readiness score ────────────────────────────
    _compositeScore(factors) {
        const { weights } = this.config;
        let score = 0, totalW = 0;
        for (const [k, w] of Object.entries(weights)) {
            if (factors[k] !== undefined) { score += factors[k] * w; totalW += w; }
        }
        return totalW > 0 ? score / totalW : 0;
    }

    // ─── Stability duration helpers ───────────────────────────
    _stabilityDurationMet(ts) {
        return this.state.stableSince ? (ts - this.state.stableSince) >= this.config.stabilityDuration : false;
    }

    _stabilityProgress(ts) {
        if (!this.state.stableSince) return 0;
        return Math.min(1, (ts - this.state.stableSince) / this.config.stabilityDuration);
    }

    // ─── User guidance generation ─────────────────────────────
    _generateGuidance(factors, stabilityMet) {
        const issues = [];
        const { thresholds } = this.config;

        if (factors.stability < thresholds.stability)
            issues.push({ priority: 1, message: 'Hold steady', icon: 'motion' });
        else if (!stabilityMet)
            issues.push({ priority: 1, message: 'Almost there…', icon: 'timer' });

        if (factors.quadConfidence < thresholds.quadConfidence)
            issues.push({ priority: 2, message: 'Center the document', icon: 'target' });
        if (factors.edgeDensity < thresholds.edgeDensity)
            issues.push({ priority: 3, message: 'Point at a document with writing', icon: 'document' });
        if (factors.focusScore < thresholds.focusScore)
            issues.push({ priority: 4, message: 'Tap to focus', icon: 'focus' });
        if (factors.coverage < thresholds.coverage)
            issues.push({ priority: 5, message: 'Move closer', icon: 'zoom-in' });

        issues.sort((a, b) => a.priority - b.priority);
        return {
            primary: issues[0] || { message: 'Ready to capture', icon: 'check' },
            all: issues,
            isReady: issues.length === 0,
        };
    }

    // ─── Assessment result factories ──────────────────────────
    _failedAssessment(code, message) {
        this.state.stableSince = null;
        this.state.frameHistory = [];
        return {
            ready: false, score: 0, factors: null, stabilityMet: false, stabilityProgress: 0,
            guidance: { primary: { message: 'Position document in frame', icon: 'scan' }, all: [], isReady: false },
            blockingReasons: [{ code, message, severity: 'critical' }],
            timestamp: Date.now(), quad: null,
        };
    }

    _blockedAssessment(blocks, factors) {
        const icons = { LOW_CONFIDENCE: 'help', NO_CONTENT: 'document-search', INVALID_SHAPE: 'resize', TOO_FAR: 'zoom-in', TOO_CLOSE: 'zoom-out', BLURRY: 'focus' };
        return {
            ready: false, score: this._compositeScore(factors), factors,
            stabilityMet: false, stabilityProgress: this._stabilityProgress(Date.now()),
            guidance: {
                primary: { message: blocks[0].message, icon: icons[blocks[0].code] || 'alert' },
                all: blocks.map(b => ({ priority: b.severity === 'critical' ? 0 : 1, message: b.message, icon: icons[b.code] || 'alert' })),
                isReady: false,
            },
            blockingReasons: blocks, timestamp: Date.now(), quad: null,
        };
    }

    // ─── Helpers ──────────────────────────────────────────────
    _polygonArea(v) {
        let a = 0;
        for (let i = 0; i < v.length; i++) {
            const j = (i + 1) % v.length;
            a += v[i].x * v[j].y - v[j].x * v[i].y;
        }
        return Math.abs(a) / 2;
    }

    reset() {
        this.state = { stableSince: null, frameHistory: [] };
    }
}
