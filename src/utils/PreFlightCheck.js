// ═══════════════════════════════════════════════════════════
//  PRE-FLIGHT CHECK — Final validation before committing to analysis
//  Last line of defense against ghost scans.
// ═══════════════════════════════════════════════════════════

export class PreFlightCheck {
    constructor() {
        this.checks = [
            this._validateCapture,
            this._validateGeometry,
            this._validateContent,
            this._validateTiming,
        ];
    }

    /** Run all pre-flight checks. */
    async run(capture, readinessState) {
        const results = { passed: true, failures: [], warnings: [], checks: {}, timestamp: Date.now() };

        for (const check of this.checks) {
            const r = await check.call(this, capture, readinessState);
            results.checks[r.name] = r;
            if (r.status === 'FAIL') { results.passed = false; results.failures.push(r); }
            else if (r.status === 'WARN') { results.warnings.push(r); }
        }
        return results;
    }

    // ─── Check 1: Capture object structure ────────────────────
    _validateCapture(capture) {
        const r = { name: 'CAPTURE_VALIDATION', status: 'PASS', details: {} };

        if (!capture) { r.status = 'FAIL'; r.reason = 'No capture data provided'; return r; }
        if (typeof capture.image !== 'string') { r.status = 'FAIL'; r.reason = 'Invalid image data type'; return r; }
        if (!capture.image.startsWith('data:image/')) { r.status = 'FAIL'; r.reason = 'Image is not a valid data URL'; return r; }

        const b64Len = capture.image.split(',')[1]?.length || 0;
        if (b64Len * 0.75 < 1000) { r.status = 'FAIL'; r.reason = 'Image data too small — likely corrupt'; r.details.estimatedBytes = Math.round(b64Len * 0.75); return r; }

        if (capture.timestamp && Date.now() - capture.timestamp > 5000) {
            r.status = 'WARN'; r.reason = 'Capture is stale (>5s old)'; r.details.ageMs = Date.now() - capture.timestamp;
        }
        return r;
    }

    // ─── Check 2: Document geometry ───────────────────────────
    _validateGeometry(capture, readiness) {
        const r = { name: 'GEOMETRY_VALIDATION', status: 'PASS', details: {} };
        const quad = capture?.quad || readiness?.quad;

        if (!quad) { r.status = 'FAIL'; r.reason = 'No document geometry detected'; return r; }
        if (!Array.isArray(quad) || quad.length !== 4) { r.status = 'FAIL'; r.reason = 'Invalid quad structure'; return r; }

        for (let i = 0; i < 4; i++) {
            const p = quad[i];
            if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || isNaN(p.x) || isNaN(p.y)) {
                r.status = 'FAIL'; r.reason = `Invalid/NaN coordinate at point ${i}`; return r;
            }
        }

        const area = this._quadArea(quad);
        r.details.area = area;
        if (area < 1000) { r.status = 'FAIL'; r.reason = 'Detected document area is too small'; return r; }

        const minEdge = this._minEdge(quad);
        r.details.minEdgeLength = minEdge;
        if (minEdge < 20) { r.status = 'FAIL'; r.reason = 'Document edges are too short'; return r; }

        if (!this._isConvex(quad)) { r.status = 'WARN'; r.reason = 'Document outline is not convex'; }
        return r;
    }

    // ─── Check 3: Content existence ───────────────────────────
    async _validateContent(capture, readiness) {
        const r = { name: 'CONTENT_VALIDATION', status: 'PASS', details: {} };

        if (readiness?.factors?.edgeDensity !== undefined) {
            r.details.edgeDensity = readiness.factors.edgeDensity;
            if (readiness.factors.edgeDensity < 0.05) { r.status = 'FAIL'; r.reason = 'No visible content — appears blank'; return r; }
            if (readiness.factors.edgeDensity < 0.1) { r.status = 'WARN'; r.reason = 'Very little content detected'; }
        }

        if (capture?.image) {
            const score = await this._quickContentCheck(capture.image);
            r.details.contentScore = score;
            if (score < 0.1) { r.status = 'FAIL'; r.reason = 'Image analysis found no document content'; return r; }
        }
        return r;
    }

    // ─── Check 4: Timing & state consistency ──────────────────
    _validateTiming(capture, readiness) {
        const r = { name: 'TIMING_VALIDATION', status: 'PASS', details: {} };

        if (readiness?.timestamp) {
            const age = Date.now() - readiness.timestamp;
            r.details.readinessAgeMs = age;
            if (age > 1000) { r.status = 'WARN'; r.reason = 'Readiness state may be outdated'; }
        }

        if (readiness && !readiness.stabilityMet) {
            r.status = 'WARN'; r.reason = 'Capture triggered before stability confirmed';
        }

        if (readiness?.score !== undefined && readiness.score < 0.6) {
            r.status = 'WARN'; r.reason = `Low readiness score at capture: ${readiness.score.toFixed(2)}`;
        }
        return r;
    }

    // ─── Helpers ──────────────────────────────────────────────
    _quadArea(q) {
        let a = 0;
        for (let i = 0; i < q.length; i++) { const j = (i + 1) % q.length; a += q[i].x * q[j].y - q[j].x * q[i].y; }
        return Math.abs(a) / 2;
    }

    _minEdge(q) {
        let m = Infinity;
        for (let i = 0; i < q.length; i++) { const j = (i + 1) % q.length; m = Math.min(m, Math.hypot(q[j].x - q[i].x, q[j].y - q[i].y)); }
        return m;
    }

    _isConvex(q) {
        let sign = null;
        for (let i = 0; i < q.length; i++) {
            const a = q[i], b = q[(i + 1) % q.length], c = q[(i + 2) % q.length];
            const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
            const s = cross >= 0;
            if (sign === null) sign = s; else if (sign !== s) return false;
        }
        return true;
    }

    _quickContentCheck(imageDataUrl) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const sz = 64;
                canvas.width = sz; canvas.height = sz;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, sz, sz);
                const data = ctx.getImageData(0, 0, sz, sz).data;

                let edges = 0;
                for (let y = 1; y < sz - 1; y++) {
                    for (let x = 1; x < sz - 1; x++) {
                        const idx = (y * sz + x) * 4;
                        const g = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                        const gR = (data[(y * sz + x + 1) * 4] + data[(y * sz + x + 1) * 4 + 1] + data[(y * sz + x + 1) * 4 + 2]) / 3;
                        if (Math.abs(g - gR) > 30) edges++;
                    }
                }
                resolve(edges / ((sz - 2) * (sz - 2)));
            };
            img.onerror = () => resolve(0.5);
            img.src = imageDataUrl;
        });
    }
}
