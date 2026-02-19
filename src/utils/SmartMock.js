// ═══════════════════════════════════════════════════════════
//  SMART MOCK — Quality-aware probabilistic mock system
//  Simulates realistic API behaviour including failures, partial
//  results, timeouts, and quality-dependent responses.
// ═══════════════════════════════════════════════════════════

export class SmartMock {
    constructor(config = {}) {
        this.config = {
            successRate: 0.85,
            partialSuccessRate: 0.10,
            networkErrorRate: 0.03,
            timeoutRate: 0.02,
            minLatency: 500,
            maxLatency: 2000,
            qualityThresholds: { excellent: 0.8, good: 0.6, poor: 0.4, reject: 0.2 },
            ...config,
        };
        this.callCount = 0;
    }

    // ─── Main entry — simulate an analysis call ───────────────
    async analyze(capture, options = {}) {
        this.callCount++;
        const t0 = Date.now();

        await this._delay(this._rand(this.config.minLatency, this.config.maxLatency));

        const quality = this._assessQuality(capture);
        const outcome = this._determineOutcome(quality);

        return { ...outcome, meta: { mockGenerated: true, callNumber: this.callCount, latencyMs: Date.now() - t0, qualityScore: quality, timestamp: Date.now() } };
    }

    // ─── Quality assessment from capture ──────────────────────
    _assessQuality(capture) {
        let score = 0.5;
        if (!capture) return 0;
        if (!capture.image) return 0.1;

        const sz = capture.image.length;
        if (sz > 100000) score += 0.2;
        else if (sz > 50000) score += 0.1;
        else if (sz < 10000) score -= 0.2;

        if (capture.quad && Array.isArray(capture.quad) && capture.quad.length === 4) {
            score += 0.15;
            const area = this._quadArea(capture.quad);
            if (area > 50000) score += 0.1; else if (area < 10000) score -= 0.1;
        } else {
            score -= 0.3;
        }

        if (capture.readiness) {
            if (capture.readiness.ready) score += 0.15;
            if (capture.readiness.stabilityMet) score += 0.1;
            if (capture.readiness.factors?.edgeDensity > 0.1) score += 0.1;
        }
        return Math.max(0, Math.min(1, score));
    }

    // ─── Outcome determination ────────────────────────────────
    _determineOutcome(quality) {
        const { qualityThresholds: qt } = this.config;

        if (quality < qt.reject) return this._error('NO_DOCUMENT_FOUND', 'Could not detect a document');
        if (quality < qt.poor) return Math.random() < 0.5 ? this._error('LOW_QUALITY', 'Image quality too low') : this._partial(quality);

        const roll = Math.random();
        if (roll < this.config.networkErrorRate) return this._error('NETWORK_ERROR', 'Failed to connect');
        if (roll < this.config.networkErrorRate + this.config.timeoutRate) return this._error('TIMEOUT', 'Request timed out', true);

        if (quality >= qt.good) {
            const sr = Math.random();
            if (sr < this.config.successRate) return this._success(quality);
            if (sr < this.config.successRate + this.config.partialSuccessRate) return this._partial(quality);
        }
        return Math.random() < 0.6 ? this._success(quality) : this._partial(quality);
    }

    // ─── Response factories ───────────────────────────────────
    _success(quality) {
        const n = this._rand(3, 8);
        const responses = [];
        for (let i = 1; i <= n; i++) {
            const correct = Math.random() < 0.6 + quality * 0.2;
            const partial = !correct && Math.random() < 0.3;
            responses.push({
                questionId: `Q${i}`,
                questionText: this._questions[i % this._questions.length],
                studentAnswer: this._answers[Math.floor(Math.random() * this._answers.length)],
                isCorrect: partial ? 'partial' : correct,
                score: { earned: correct ? 10 : partial ? 5 : 0, possible: 10, percentage: correct ? 1 : partial ? 0.5 : 0 },
                feedback: correct ? 'Correct! Great work.' : partial ? 'Partially correct. Check your final step.' : 'Not quite. Review the concept.',
                confidence: { individual: 0.7 + Math.random() * 0.25 },
            });
        }
        const earned = responses.reduce((s, r) => s + r.score.earned, 0);
        const possible = responses.reduce((s, r) => s + r.score.possible, 0);
        const pct = (earned / possible) * 100;

        return {
            success: true,
            analysis: {
                documentType: 'WORKSHEET',
                pageAnalysis: { contentSummary: 'Math worksheet with multiple question types', estimatedCompleteness: 0.85 + Math.random() * 0.15, readabilityScore: quality },
                studentInfo: { name: Math.random() > 0.3 ? 'Sample Student' : null, date: Math.random() > 0.5 ? '2024-01-15' : null },
                responses,
                overallAssessment: {
                    score: pct,
                    grade: pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F',
                    strengths: ['Clear handwriting', 'Shows work'], areasForImprovement: ['Double-check arithmetic'], suggestedNextSteps: ['Practice similar problems'],
                },
                confidence: { overall: 0.75 + quality * 0.2 },
            },
        };
    }

    _partial(quality) {
        const resp = this._success(quality);
        const bad = this._rand(1, Math.min(3, resp.analysis.responses.length));
        for (let i = 0; i < bad; i++) {
            const idx = this._rand(0, resp.analysis.responses.length - 1);
            resp.analysis.responses[idx] = { ...resp.analysis.responses[idx], studentAnswer: '[ILLEGIBLE]', isCorrect: null, score: { earned: 0, possible: 10, percentage: 0 }, feedback: 'Could not read student response', confidence: { individual: 0.2 } };
        }
        resp.analysis.confidence.overall *= 0.7;
        resp.warnings = ['Some responses could not be read clearly', 'Consider rescanning with better lighting'];
        return resp;
    }

    _error(code, message, retryable = false) {
        return { success: false, error: { code, message, retryable }, analysis: null };
    }

    // ─── Data ─────────────────────────────────────────────────
    _questions = [
        'Solve for x: 2x + 5 = 13', 'What is the capital of France?', 'Calculate the area (length 8, width 5)',
        'Name three primary colors', 'What year did WWII end?', 'Simplify: 3/4 + 1/2', 'Define photosynthesis', 'What is 15% of 80?',
    ];
    _answers = ['x = 4', 'Paris', '40 sq units', 'red, blue, yellow', '1945', '5/4', 'Plants convert sunlight to energy', '12'];

    // ─── Helpers ──────────────────────────────────────────────
    _quadArea(q) { let a = 0; for (let i = 0; i < q.length; i++) { const j = (i + 1) % q.length; a += q[i].x * q[j].y - q[j].x * q[i].y; } return Math.abs(a) / 2; }
    _rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}
