// ═══════════════════════════════════════════════════════════
//  ADAPTIVE PROMPT ENGINE — Context-aware prompt generation
// ═══════════════════════════════════════════════════════════

export class AdaptivePromptEngine {
    constructor() {
        this.profiles = {
            WORKSHEET: {
                focus: ['numbered questions', 'fill-in-the-blank', 'multiple choice'],
                extractionPriority: ['questionId', 'studentAnswer', 'workShown'],
                commonErrors: ['skipped questions', 'partial answers', 'erasure marks'],
            },
            ESSAY: {
                focus: ['paragraph structure', 'thesis statement', 'supporting evidence'],
                extractionPriority: ['paragraphs', 'mainIdea', 'vocabulary'],
                commonErrors: ['run-on sentences', 'spelling', 'organization'],
            },
            TEST: {
                focus: ['answer bubbles', 'short answer', 'matching sections'],
                extractionPriority: ['questionId', 'selectedOption', 'confidence'],
                commonErrors: ['multiple selections', 'erasures', 'blank answers'],
            },
            MATH: {
                focus: ['equations', 'work shown', 'final answers', 'graphs'],
                extractionPriority: ['problem', 'steps', 'answer', 'method'],
                commonErrors: ['calculation errors', 'unit omission', 'sign errors'],
            },
            DRAWING: {
                focus: ['labeled parts', 'arrows', 'color usage', 'proportions'],
                extractionPriority: ['labels', 'completeness', 'accuracy'],
                commonErrors: ['missing labels', 'incorrect proportions'],
            },
        };

        this.learningHistory = new Map();
    }

    async generate(options = {}) {
        const {
            imageAnalysis = null,
            detectedType = null,
            previousPages = [],
            rubric = null,
            knownAnswers = null,
            feedbackStyle = 'constructive',
        } = options;

        const docType = detectedType || 'WORKSHEET';
        const profile = this.profiles[docType] || this.profiles.WORKSHEET;
        const sections = [];

        sections.push(this._roleSection(docType, feedbackStyle));
        if (previousPages.length > 0) sections.push(this._contextSection(previousPages));
        sections.push(this._qualitySection(imageAnalysis));
        sections.push(this._extractionSection(profile, knownAnswers));
        if (rubric) sections.push(this._rubricSection(rubric));
        sections.push(this._outputSection(docType));
        sections.push(this._reasoningSection());

        const learned = this._learningSection(docType);
        if (learned) sections.push(learned);

        const prompt = sections.join('\n\n');
        return { prompt, documentType: docType, profile, estimatedTokens: Math.ceil(prompt.length / 4) };
    }

    recordCorrection(docType, original, corrected, description) {
        if (!this.learningHistory.has(docType)) this.learningHistory.set(docType, []);
        const list = this.learningHistory.get(docType);
        list.push({ timestamp: Date.now(), original, corrected, description });
        if (list.length > 20) this.learningHistory.set(docType, list.slice(-20));
    }

    // ─── Prompt sections ─────────────────────────────────────
    _roleSection(docType, style) {
        const guides = {
            constructive: 'balanced, noting both strengths and areas for improvement',
            strict: 'thorough and precise, focusing on accuracy',
            encouraging: 'supportive and growth-focused, emphasizing effort and progress',
        };
        return `# Role
You are an expert educational assessment specialist with deep experience in K-12 education. Your feedback style is ${guides[style] || guides.constructive}.

You are analyzing a ${docType.toLowerCase()} submitted by a student. Your goal is to:
1. Accurately extract all student responses
2. Evaluate correctness with nuance (partial credit where appropriate)
3. Provide specific, actionable feedback
4. Identify patterns that might indicate conceptual misunderstandings`;
    }

    _contextSection(previousPages) {
        const summaries = previousPages
            .filter(p => p.analysisResult)
            .map((p, i) => `Page ${i + 1}: ${p.analysisResult.summary || 'No summary'}`)
            .join('\n');

        const pattern = this._detectPatterns(previousPages);

        return `# Multi-Page Context
Previous pages:\n${summaries}
${pattern ? `\nObserved pattern: ${pattern}` : ''}

Use this context to reference earlier answers and note improvement or consistency.`;
    }

    _qualitySection(analysis) {
        if (!analysis) return `# Image Quality\nNo quality data. Proceed with standard analysis and mark illegible text as "[ILLEGIBLE]".`;
        const issues = analysis.issues?.map(i => i.message).join(', ') || 'None';
        return `# Image Quality Notice
Quality Score: ${(analysis.overallScore * 100).toFixed(0)}%
Issues: ${issues}
Expected Confidence: ${(analysis.confidence * 100).toFixed(0)}%

If text is illegible, mark as "[ILLEGIBLE]" — do NOT guess. Lower per-question confidence accordingly.`;
    }

    _extractionSection(profile, knownAnswers) {
        let s = `# Extraction Instructions
Focus on: ${profile.focus.join(', ')}
Extract: ${profile.extractionPriority.map((p, i) => `${i + 1}. ${p}`).join('\n')}
Watch for: ${profile.commonErrors.join(', ')}`;

        if (knownAnswers) {
            s += `\n\n## Answer Reference\n${JSON.stringify(knownAnswers, null, 2)}\nCompare student responses against these.`;
        }
        return s;
    }

    _rubricSection(rubric) {
        return `# Grading Rubric\n${typeof rubric === 'string' ? rubric : JSON.stringify(rubric, null, 2)}\nCite specific rubric points in your feedback.`;
    }

    _outputSection(docType) {
        return `# Required Output Format
Respond with valid JSON only.

{
  "documentType": "${docType}",
  "pageAnalysis": { "contentSummary": "string", "estimatedCompleteness": 0.0, "readabilityScore": 0.0 },
  "studentInfo": { "name": null, "date": null, "period": null },
  "responses": [{
    "questionId": "string",
    "questionText": "string",
    "studentAnswer": "string",
    "workShown": "string",
    "isCorrect": true,
    "score": { "earned": 0, "possible": 10, "percentage": 0.0 },
    "feedback": "string",
    "conceptsAssessed": [],
    "errorType": null
  }],
  "overallAssessment": {
    "score": 0,
    "grade": "A",
    "strengths": [],
    "areasForImprovement": [],
    "suggestedNextSteps": []
  },
  "confidence": { "overall": 0.0, "perQuestion": {} },
  "flags": []
}`;
    }

    _reasoningSection() {
        return `# Reasoning Process
Before outputting JSON, work through:
1. SCAN: Identify all visible questions and responses
2. READ: Carefully transcribe each student answer
3. EVALUATE: Compare against correct answers or rubric
4. PARTIAL CREDIT: Consider if incorrect answers show understanding
5. PATTERN: Look for systematic errors indicating misconceptions
6. FEEDBACK: Craft specific, actionable suggestions`;
    }

    _learningSection(docType) {
        const patterns = this.learningHistory.get(docType);
        if (!patterns?.length) return null;
        return `# Learned Patterns
Based on past corrections:\n${patterns.slice(-5).map(p => `- ${p.description}`).join('\n')}\nAdjust accordingly.`;
    }

    _detectPatterns(pages) {
        if (pages.length < 2) return null;
        const results = pages.filter(p => p.analysisResult).map(p => p.analysisResult);
        const errorCounts = {};
        for (const r of results) {
            for (const resp of r.responses || []) {
                if (resp.errorType) errorCounts[resp.errorType] = (errorCounts[resp.errorType] || 0) + 1;
            }
        }
        const top = Object.entries(errorCounts).sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] >= 2) return `Recurring ${top[0]} errors detected`;

        const scores = results.map(r => r.overallAssessment?.score).filter(s => s != null);
        if (scores.length >= 2) {
            const d = scores[scores.length - 1] - scores[0];
            if (d > 15) return 'Student showing improvement across pages';
            if (d < -15) return 'Difficulty may be increasing — check for fatigue';
        }
        return null;
    }
}
