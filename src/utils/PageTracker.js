// ═══════════════════════════════════════════════════════════
//  PAGE TRACKER — Quad-based page lifecycle manager
// ═══════════════════════════════════════════════════════════

/**
 * Tracks detected document quads across frames, manages
 * per-page lifecycle (detected → captured → analyzing → complete),
 * and provides stability analysis for auto-capture.
 */
export class PageTracker {
    constructor() {
        this.pages = new Map();       // id → page object
        this.nextId = 1;
        this.historyBuffer = [];      // last N quads for smoothing
        this.bufferSize = 10;
        this.iouThreshold = 0.45;     // min IoU to consider same page
    }

    /**
     * Process a detected quad. Returns matched/new page entries.
     * @param {Array<{x,y}>} quad - 4 corner points
     * @returns {Array<{id, page, isNew}>}
     */
    update(quad) {
        if (!quad || quad.length !== 4) return [];

        this.historyBuffer.push({ quad, timestamp: Date.now() });
        if (this.historyBuffer.length > this.bufferSize) this.historyBuffer.shift();

        // Try to match to an existing page by IoU
        let bestMatch = null;
        let bestIou = 0;

        for (const [id, page] of this.pages) {
            if (page.status === 'complete' || page.status === 'failed') continue;
            const iou = this._quadIoU(quad, page.lastQuad);
            if (iou > this.iouThreshold && iou > bestIou) {
                bestMatch = id;
                bestIou = iou;
            }
        }

        if (bestMatch) {
            const page = this.pages.get(bestMatch);
            page.lastQuad = quad;
            page.lastSeen = Date.now();
            page.frameCount++;
            page.quadHistory.push(quad);
            if (page.quadHistory.length > this.bufferSize) page.quadHistory.shift();
            return [{ id: bestMatch, page, isNew: false }];
        }

        // New page
        const id = this.nextId++;
        const page = {
            id,
            status: 'detected',     // detected | captured | analyzing | complete | failed
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            lastQuad: quad,
            quadHistory: [quad],
            frameCount: 1,
            capturedImage: null,
            semanticFingerprint: null,
            analysisResult: null,
            error: null,
        };
        this.pages.set(id, page);
        return [{ id, page, isNew: true }];
    }

    /**
     * Assess stability of a page's detection (quad jitter).
     */
    getStability(pageId) {
        const page = this.pages.get(pageId);
        if (!page || page.quadHistory.length < 3) {
            return { stable: false, jitter: Infinity, frameCount: page?.frameCount || 0 };
        }

        const history = page.quadHistory;
        let totalJitter = 0;
        for (let i = 1; i < history.length; i++) {
            for (let c = 0; c < 4; c++) {
                const dx = history[i][c].x - history[i - 1][c].x;
                const dy = history[i][c].y - history[i - 1][c].y;
                totalJitter += Math.sqrt(dx * dx + dy * dy);
            }
        }

        const avgJitter = totalJitter / ((history.length - 1) * 4);
        return {
            stable: avgJitter < 8 && page.frameCount >= 4,
            jitter: avgJitter,
            frameCount: page.frameCount,
        };
    }

    // ─── Lifecycle methods ───────────────────────────────────
    setCapture(pageId, imageDataUrl) {
        const page = this.pages.get(pageId);
        if (page) { page.capturedImage = imageDataUrl; page.status = 'captured'; }
    }

    markAnalyzing(pageId) {
        const page = this.pages.get(pageId);
        if (page) page.status = 'analyzing';
    }

    markComplete(pageId, result) {
        const page = this.pages.get(pageId);
        if (page) { page.status = 'complete'; page.analysisResult = result; }
    }

    markFailed(pageId, error) {
        const page = this.pages.get(pageId);
        if (page) { page.status = 'failed'; page.error = error; }
    }

    // ─── Queries ─────────────────────────────────────────────
    getAllPages() { return [...this.pages.values()]; }

    getAnalyzedPages() {
        return [...this.pages.values()].filter(p => p.status === 'complete' && p.analysisResult);
    }

    getPage(id) { return this.pages.get(id) || null; }

    reset() {
        this.pages.clear();
        this.nextId = 1;
        this.historyBuffer = [];
    }

    // ─── IoU between two quads ───────────────────────────────
    _quadIoU(a, b) {
        const boxA = this._quadToBBox(a);
        const boxB = this._quadToBBox(b);

        const x1 = Math.max(boxA.x1, boxB.x1);
        const y1 = Math.max(boxA.y1, boxB.y1);
        const x2 = Math.min(boxA.x2, boxB.x2);
        const y2 = Math.min(boxA.y2, boxB.y2);

        if (x2 <= x1 || y2 <= y1) return 0;

        const intersection = (x2 - x1) * (y2 - y1);
        const areaA = (boxA.x2 - boxA.x1) * (boxA.y2 - boxA.y1);
        const areaB = (boxB.x2 - boxB.x1) * (boxB.y2 - boxB.y1);
        return intersection / (areaA + areaB - intersection);
    }

    _quadToBBox(quad) {
        const xs = quad.map(p => p.x);
        const ys = quad.map(p => p.y);
        return {
            x1: Math.min(...xs), y1: Math.min(...ys),
            x2: Math.max(...xs), y2: Math.max(...ys),
        };
    }
}
