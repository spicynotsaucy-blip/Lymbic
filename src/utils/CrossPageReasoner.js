// ═══════════════════════════════════════════════════════════
//  CROSS-PAGE REASONER — Multi-page synthesis engine
// ═══════════════════════════════════════════════════════════

export class CrossPageReasoner {
    constructor() {
        this.conceptGraph = new Map();
    }

    synthesize(analyzedPages) {
        if (!analyzedPages?.length) return null;

        const synthesis = {
            pageCount: analyzedPages.length,
            unifiedResponses: this._mergeResponses(analyzedPages),
            progressionAnalysis: this._progression(analyzedPages),
            conceptMastery: this._conceptMastery(analyzedPages),
            overallAssessment: this._overallAssessment(analyzedPages),
            patterns: this._patterns(analyzedPages),
            recommendations: [],
        };

        synthesis.recommendations = this._recommendations(synthesis);
        return synthesis;
    }

    // ─── Response merging ────────────────────────────────────
    _mergeResponses(pages) {
        const merged = [];
        const seen = new Set();

        for (const page of pages) {
            for (const r of page.analysisResult?.responses || []) {
                const key = `${r.questionId}_${(r.questionText || '').slice(0, 30)}`;
                if (seen.has(key)) {
                    const existing = merged.find(m => m.questionId === r.questionId);
                    if (existing) {
                        existing.continuedFrom = existing.continuedFrom || [];
                        existing.continuedFrom.push({ pageId: page.id, additionalAnswer: r.studentAnswer });
                    }
                } else {
                    seen.add(key);
                    merged.push({ ...r, sourcePageId: page.id, pageNumber: pages.indexOf(page) + 1 });
                }
            }
        }

        return merged.sort((a, b) => {
            const na = parseInt((a.questionId || '').replace(/\D/g, '')) || 0;
            const nb = parseInt((b.questionId || '').replace(/\D/g, '')) || 0;
            return na - nb;
        });
    }

    // ─── Progression analysis ────────────────────────────────
    _progression(pages) {
        const scores = pages
            .filter(p => p.analysisResult?.overallAssessment?.score != null)
            .map((p, i) => ({ page: i + 1, score: p.analysisResult.overallAssessment.score }));

        if (scores.length < 2) return { trend: 'insufficient_data', scores };

        const mid = Math.ceil(scores.length / 2);
        const firstAvg = scores.slice(0, mid).reduce((s, p) => s + p.score, 0) / mid;
        const secondAvg = scores.slice(mid).reduce((s, p) => s + p.score, 0) / (scores.length - mid);
        const diff = secondAvg - firstAvg;

        const trend = diff > 10 ? 'improving' : diff < -10 ? 'declining' : 'stable';
        const peak = scores.reduce((m, p) => p.score > m.score ? p : m, scores[0]);
        const valley = scores.reduce((m, p) => p.score < m.score ? p : m, scores[0]);

        const interpretations = {
            improving: 'Student demonstrates growth. Later sections show stronger understanding.',
            declining: 'Performance decreased on later pages — could indicate fatigue or difficulty.',
            stable: 'Consistent performance throughout.',
        };

        return {
            trend, scores,
            firstHalfAverage: firstAvg.toFixed(1),
            secondHalfAverage: secondAvg.toFixed(1),
            peakPerformance: { page: peak.page, score: peak.score },
            lowestPerformance: { page: valley.page, score: valley.score },
            interpretation: interpretations[trend],
        };
    }

    // ─── Concept mastery ─────────────────────────────────────
    _conceptMastery(pages) {
        const concepts = new Map();

        for (const page of pages) {
            for (const r of page.analysisResult?.responses || []) {
                const score = r.score?.percentage ?? (r.isCorrect === true ? 1 : r.isCorrect === 'partial' ? 0.5 : 0);
                for (const c of r.conceptsAssessed || []) {
                    if (!concepts.has(c)) concepts.set(c, { total: 0, count: 0, responses: [] });
                    const entry = concepts.get(c);
                    entry.total += score;
                    entry.count++;
                    entry.responses.push({ questionId: r.questionId, score });
                }
            }
        }

        const mastery = [];
        for (const [concept, data] of concepts) {
            const avg = data.total / data.count;
            const level = avg >= 0.9 ? 'mastered' : avg >= 0.7 ? 'proficient' : avg >= 0.5 ? 'developing' : 'needs_work';
            mastery.push({ concept, averageScore: avg, level, questionCount: data.count });
        }

        return mastery.sort((a, b) => a.averageScore - b.averageScore);
    }

    // ─── Overall assessment ──────────────────────────────────
    _overallAssessment(pages) {
        const responses = pages
            .flatMap(p => p.analysisResult?.responses || [])
            .filter(r => r.score?.earned != null && r.score?.possible != null);

        if (!responses.length) return { score: null, grade: null, message: 'Unable to calculate' };

        const earned = responses.reduce((s, r) => s + r.score.earned, 0);
        const possible = responses.reduce((s, r) => s + r.score.possible, 0);
        const pct = (earned / possible) * 100;
        const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';

        return {
            score: pct.toFixed(1), earned, possible, grade,
            questionCount: responses.length,
            correctCount: responses.filter(r => r.isCorrect === true).length,
            partialCount: responses.filter(r => r.isCorrect === 'partial').length,
            incorrectCount: responses.filter(r => r.isCorrect === false).length,
        };
    }

    // ─── Pattern detection ───────────────────────────────────
    _patterns(pages) {
        const patterns = [];

        // Error type patterns
        const errors = {};
        for (const page of pages)
            for (const r of page.analysisResult?.responses || [])
                if (r.errorType) errors[r.errorType] = (errors[r.errorType] || 0) + 1;

        for (const [type, count] of Object.entries(errors).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1])) {
            patterns.push({
                type: 'recurring_error',
                description: `${type} errors appeared ${count} times`,
                severity: count >= 4 ? 'high' : 'medium',
                errorType: type, count,
            });
        }

        // Skipped questions
        const skipped = {};
        for (const page of pages)
            for (const r of page.analysisResult?.responses || [])
                if (!r.studentAnswer?.trim()) {
                    const section = (r.questionId || '').replace(/\d/g, '') || 'general';
                    skipped[section] = (skipped[section] || 0) + 1;
                }

        for (const [section, count] of Object.entries(skipped).filter(([, c]) => c >= 2)) {
            patterns.push({ type: 'skipped_questions', description: `Multiple questions skipped in ${section}`, severity: 'medium', section, count });
        }

        // Consistent strengths
        const strengths = {};
        for (const page of pages)
            for (const s of page.analysisResult?.overallAssessment?.strengths || [])
                strengths[s.toLowerCase().trim()] = (strengths[s.toLowerCase().trim()] || 0) + 1;

        for (const [s, count] of Object.entries(strengths).filter(([, c]) => c >= 2)) {
            patterns.push({ type: 'consistent_strength', description: s, severity: 'positive', count });
        }

        return patterns;
    }

    // ─── Recommendations ─────────────────────────────────────
    _recommendations(synthesis) {
        const recs = [];

        for (const c of synthesis.conceptMastery.filter(c => c.level === 'needs_work').slice(0, 3)) {
            recs.push({
                priority: 'high', category: 'concept_review',
                message: `Focus on ${c.concept} — ${(c.averageScore * 100).toFixed(0)}% mastery`,
                suggestedActions: [`Review ${c.concept} fundamentals`, `Practice more problems`, `Consider one-on-one help`],
            });
        }

        if (synthesis.progressionAnalysis.trend === 'declining') {
            recs.push({
                priority: 'medium', category: 'study_habits',
                message: 'Performance decreased on later pages',
                suggestedActions: ['Take short breaks', 'Tackle difficult sections first', 'Practice time management'],
            });
        }

        for (const e of synthesis.patterns.filter(p => p.type === 'recurring_error' && p.severity === 'high')) {
            recs.push({
                priority: 'high', category: 'error_correction',
                message: `Recurring ${e.errorType} errors need attention`,
                suggestedActions: [`Review common causes of ${e.errorType} errors`, 'Practice checking work', 'Create a checklist'],
            });
        }

        const strengths = synthesis.patterns.filter(p => p.type === 'consistent_strength');
        if (strengths.length) {
            recs.push({
                priority: 'positive', category: 'reinforcement',
                message: `Strengths: ${strengths.map(s => s.description).join(', ')}`,
                suggestedActions: ['Continue applying these skills', 'Help peers in these areas'],
            });
        }

        const order = { high: 0, medium: 1, positive: 2, low: 3 };
        return recs.sort((a, b) => order[a.priority] - order[b.priority]);
    }
}
