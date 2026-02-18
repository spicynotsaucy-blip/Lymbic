// ═══════════════════════════════════════════════════════════
//  CONFIDENCE CALIBRATOR — Post-hoc AI confidence adjustment
// ═══════════════════════════════════════════════════════════

export class ConfidenceCalibrator {
    constructor() {
        this.accuracyHistory = [];
        this.weights = {
            imageQuality: 0.25,
            responseConsistency: 0.20,
            historicalAccuracy: 0.25,
            contentComplexity: 0.15,
            aiConfidence: 0.15,
        };
    }

    calibrate({ rawAIConfidence, imageQuality, responses, documentType, previousResults = [] }) {
        const factors = {
            imageQuality: imageQuality?.overallScore ?? 0.7,
            responseConsistency: this._consistency(responses),
            historicalAccuracy: this._historicalAccuracy(documentType),
            contentComplexity: this._complexity(responses),
            aiConfidence: this._adjustRaw(rawAIConfidence),
        };

        let calibrated = 0;
        for (const [k, w] of Object.entries(this.weights)) calibrated += (factors[k] || 0.5) * w;
        calibrated = Math.max(0.1, Math.min(0.95, calibrated));

        return {
            overall: calibrated,
            perQuestion: this._perQuestion(responses, factors),
            factors,
            explanation: this._explain(factors, calibrated),
        };
    }

    recordOutcome(result, wasCorrect, documentType) {
        this.accuracyHistory.push({
            timestamp: Date.now(), wasCorrect, documentType,
            originalConfidence: result.confidence?.overall,
        });
        if (this.accuracyHistory.length > 100) this.accuracyHistory = this.accuracyHistory.slice(-100);
    }

    getStats() {
        const total = this.accuracyHistory.length;
        if (!total) return null;
        const correct = this.accuracyHistory.filter(h => h.wasCorrect).length;
        return {
            totalAssessments: total,
            accuracyRate: correct / total,
            averageConfidence: this.accuracyHistory.reduce((s, h) => s + (h.originalConfidence || 0.7), 0) / total,
        };
    }

    // ─── Internal ────────────────────────────────────────────
    _consistency(responses) {
        if (!responses?.length) return 0.5;
        const confs = responses.map(r => r.confidence?.individual ?? r.score?.percentage).filter(c => c != null);
        if (confs.length < 2) return 0.7;
        const mean = confs.reduce((a, b) => a + b, 0) / confs.length;
        const stdDev = Math.sqrt(confs.reduce((s, c) => s + (c - mean) ** 2, 0) / confs.length);
        return Math.max(0.4, 1 - stdDev);
    }

    _historicalAccuracy(docType) {
        const relevant = this.accuracyHistory
            .filter(h => !docType || h.documentType === docType)
            .slice(-20);
        if (!relevant.length) return 0.7;
        return relevant.filter(h => h.wasCorrect).length / relevant.length;
    }

    _complexity(responses) {
        if (!responses?.length) return 0.5;
        let score = 0, n = 0;
        for (const r of responses) {
            const len = r.studentAnswer?.length || 0;
            score += len > 200 ? 0.3 : len > 50 ? 0.6 : 0.9;
            n++;
            if (r.workShown?.length > 20) { score += 0.5; n++; }
            if (r.isCorrect === 'partial') { score += 0.4; n++; }
        }
        return n > 0 ? score / n : 0.7;
    }

    _adjustRaw(raw) {
        if (raw == null) return 0.5;
        if (raw > 0.9) return 0.85 + (raw - 0.9) * 0.5;
        if (raw > 0.7) return raw * 0.95;
        return raw;
    }

    _perQuestion(responses, globalFactors) {
        const pq = {};
        for (const r of responses || []) {
            let c = r.confidence?.individual ?? 0.7;
            if (r.studentAnswer === '[ILLEGIBLE]') c = 0.1;
            else if (r.isCorrect === 'partial') c *= 0.85;
            c *= globalFactors.imageQuality;
            pq[r.questionId || 'unknown'] = Math.max(0.1, Math.min(0.95, c));
        }
        return pq;
    }

    _explain(factors, final) {
        const notes = [];
        if (factors.imageQuality < 0.5) notes.push('Low image quality reduces confidence');
        if (factors.responseConsistency < 0.5) notes.push('Inconsistent response confidence');
        if (factors.historicalAccuracy < 0.6) notes.push('Past corrections suggest this type is challenging');
        if (factors.contentComplexity < 0.5) notes.push('Complex content adds uncertainty');
        if (!notes.length) notes.push('All factors within normal ranges');
        return { summary: `Calibrated: ${(final * 100).toFixed(0)}%`, factors: notes };
    }
}
