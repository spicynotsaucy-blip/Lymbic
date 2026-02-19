// ═══════════════════════════════════════════════════════════
//  LAYER 2: ANALYSIS ENGINE — Multi-Pass Gemini w/ Adaptive Intelligence
//  + Defense-in-Depth Validation Pipeline (Phase 10)
// ═══════════════════════════════════════════════════════════

import { AdaptivePromptEngine } from '../utils/AdaptivePromptEngine';
import { ConfidenceCalibrator } from '../utils/ConfidenceCalibrator';
import { PreFlightCheck } from '../utils/PreFlightCheck';
import { SmartMock } from '../utils/SmartMock';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

const promptEngine = new AdaptivePromptEngine();
const calibrator = new ConfidenceCalibrator();
const preFlightCheck = new PreFlightCheck();
const smartMock = new SmartMock();

// ─── Mock data for dev / no-API fallback ───────────────────
const MOCK_RESULT = {
    score: 78,
    isCorrect: false,
    logicTrace: [
        { step: 1, content: 'Correct equation selected (kinematic)', isValid: true, note: null },
        { step: 2, content: 'Correct substitution of known values', isValid: true, note: null },
        { step: 3, content: 'Arithmetic error: 9.8 × 2 computed as 18.6', isValid: false, note: 'Should be 19.6' },
        { step: 4, content: 'Conclusion carried forward from error', isValid: false, note: null },
    ],
    divergencePoint: {
        step: 3,
        errorType: 'COMPUTATIONAL',
        explanation: 'Student multiplied 9.8 × 2 = 18.6 instead of 19.6. Correct method, arithmetic slip.',
    },
    remediation: 'Strong conceptual understanding. Practice mental arithmetic with decimal multiplication.',
    confidence: 0.91,
};

/**
 * Call Gemini vision API with a base64 image and a text prompt.
 */
async function callGemini(imageBase64, prompt) {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const body = {
        contents: [{
            parts: [
                { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
                { text: prompt },
            ],
        }],
        generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
        },
    };

    const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');

    return parseJSON(text);
}

/**
 * Safely extract JSON from model output.
 */
function parseJSON(text) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in response');
    return JSON.parse(match[0]);
}

// ═══════════════════════════════════════════════════════════
//  PASS 1 — Structure: Detect document type
// ═══════════════════════════════════════════════════════════
async function detectStructure(imageBase64) {
    const prompt = `Analyze this document image and describe its structure in JSON:
{
  "documentType": "WORKSHEET|ESSAY|TEST|MATH|DRAWING",
  "sections": [{"type": "header|questions|answers|work", "location": "top|middle|bottom", "count": 0}],
  "estimatedQuestionCount": 0,
  "hasHandwriting": false,
  "overallReadability": 0.0
}`;
    return callGemini(imageBase64, prompt);
}

// ═══════════════════════════════════════════════════════════
//  PASS 2 — Extraction: Full analysis with adaptive prompt
// ═══════════════════════════════════════════════════════════
async function adaptiveExtraction(imageBase64, options = {}) {
    const { prompt } = await promptEngine.generate({
        detectedType: options.documentType,
        imageAnalysis: options.imageQuality,
        previousPages: options.previousPages || [],
        rubric: options.rubric,
        feedbackStyle: options.feedbackStyle || 'constructive',
    });
    return callGemini(imageBase64, prompt);
}

// ═══════════════════════════════════════════════════════════
//  PASS 3 — Verification: Re-examine low-confidence items
// ═══════════════════════════════════════════════════════════
async function verifyLowConfidence(imageBase64, lowItems) {
    if (!lowItems.length) return null;

    const prompt = `Re-examine these specific questions and provide your best interpretation:
${lowItems.map(r => `- Question ${r.questionId}: Current reading: "${r.studentAnswer}"`).join('\n')}

Respond with JSON:
{
  "verifications": [
    {"questionId": "...", "revisedAnswer": "...", "confidence": 0.0, "notes": "..."}
  ]
}`;

    return callGemini(imageBase64, prompt);
}

// ═══════════════════════════════════════════════════════════
//  PUBLIC API — analyzeWithLogicEngine (backward-compatible)
// ═══════════════════════════════════════════════════════════

/**
 * Multi-pass analysis pipeline.
 *
 * @param {string} imageBase64
 * @param {object} problemContext  — { subject, grade, ... }
 * @param {object} [options]       — { mode, imageQuality, previousPages, rubric, feedbackStyle }
 * @returns {Promise<object>}
 */
export async function analyzeWithLogicEngine(imageBase64, problemContext = {}, options = {}) {
    const { mode = 'full', imageQuality = null, previousPages = [], rubric = null, feedbackStyle } = options;

    // No API key AND not using smart mock → static fallback
    if (!GEMINI_API_KEY && !USE_MOCK) {
        console.warn('[Lymbic] No VITE_GEMINI_API_KEY — using mock analysis');
        await new Promise(r => setTimeout(r, 2200));
        return { ...MOCK_RESULT, _mock: true, timestamp: Date.now() };
    }

    // Smart mock mode — quality-aware probabilistic responses
    if (USE_MOCK && !GEMINI_API_KEY) {
        console.log('[Lymbic] Smart mock mode');
        const mockResult = await smartMock.analyze({ image: imageBase64 });
        if (!mockResult.success) {
            return { ...MOCK_RESULT, _mock: true, _smartMockError: mockResult.error, timestamp: Date.now() };
        }
        return { ...MOCK_RESULT, ...mockResult.analysis, _mock: true, _smartMock: true, timestamp: Date.now() };
    }

    try {
        // ── Quick mode: legacy 2-pass ──────────────────────
        if (mode === 'quick') {
            return await _legacyAnalysis(imageBase64, problemContext);
        }

        // ── Full mode: 3-pass adaptive ─────────────────────
        // Pass 1: Structure detection
        const structure = await detectStructure(imageBase64);
        const docType = structure.documentType || 'WORKSHEET';

        // Pass 2: Adaptive extraction
        const extraction = await adaptiveExtraction(imageBase64, {
            documentType: docType,
            imageQuality,
            previousPages,
            rubric,
            feedbackStyle,
        });

        // Pass 3: Verify low-confidence items
        const lowConf = (extraction.responses || [])
            .filter(r => (r.confidence?.individual ?? 1) < 0.6);

        let finalResponses = extraction.responses || [];
        let verificationRan = false;

        if (lowConf.length > 0) {
            try {
                const verification = await verifyLowConfidence(imageBase64, lowConf);
                if (verification?.verifications) {
                    verificationRan = true;
                    finalResponses = finalResponses.map(r => {
                        const v = verification.verifications.find(vv => vv.questionId === r.questionId);
                        if (v) {
                            return {
                                ...r,
                                studentAnswer: v.revisedAnswer || r.studentAnswer,
                                confidence: { ...r.confidence, verified: v.confidence },
                                verificationNotes: v.notes,
                            };
                        }
                        return r;
                    });
                }
            } catch (verifyErr) {
                console.warn('[Lymbic] Verification pass failed, continuing:', verifyErr.message);
            }
        }

        // Calibrate confidence
        const calibratedConfidence = calibrator.calibrate({
            rawAIConfidence: extraction.confidence?.overall,
            imageQuality,
            responses: finalResponses,
            documentType: docType,
        });

        // Build backward-compatible result
        const result = {
            // Legacy fields for existing ResultsDashboard
            score: extraction.overallAssessment?.score ?? extraction.score ?? 0,
            isCorrect: (extraction.overallAssessment?.score ?? 0) >= 70,
            logicTrace: finalResponses.map((r, i) => ({
                step: i + 1,
                content: `${r.questionId}: ${r.studentAnswer || '[no answer]'}`,
                isValid: r.isCorrect === true,
                note: r.feedback || null,
            })),
            divergencePoint: (() => {
                const firstError = finalResponses.find(r => r.isCorrect === false);
                if (!firstError) return null;
                return {
                    step: finalResponses.indexOf(firstError) + 1,
                    errorType: firstError.errorType || 'UNKNOWN',
                    explanation: firstError.feedback || 'Error detected',
                };
            })(),
            remediation: extraction.overallAssessment?.suggestedNextSteps?.join('. ') ||
                extraction.remediation || 'Review your work and try again.',
            confidence: calibratedConfidence.overall,

            // New extended fields
            _structured: {
                documentType: docType,
                documentStructure: structure,
                responses: finalResponses,
                overallAssessment: extraction.overallAssessment,
                calibratedConfidence,
                pageAnalysis: extraction.pageAnalysis,
                studentInfo: extraction.studentInfo,
                flags: extraction.flags || [],
            },
            _passes: { structure: true, extraction: true, verification: verificationRan },
            _recognition: extraction,
            timestamp: Date.now(),
        };

        return result;
    } catch (err) {
        console.error('[Lymbic] Analysis failed, falling back to mock:', err);
        return { ...MOCK_RESULT, _mock: true, _error: err.message, timestamp: Date.now() };
    }
}

/**
 * Legacy 2-pass analysis (quick mode).
 */
async function _legacyAnalysis(imageBase64, problemContext) {
    const recogPrompt = `You are an expert at reading handwritten student math/science work.

Transcribe this worksheet image exactly as written. Include all steps, crossed-out work, and margin annotations.

Return ONLY valid JSON:
{
  "transcription": ["step 1 text", "step 2 text"],
  "problemType": "algebra | calculus | physics | chemistry | geometry | other",
  "confidence": 0.0
}`;

    const recognition = await callGemini(imageBase64, recogPrompt);

    const evalPrompt = `You are a logic-trace analyst for Lymbic.

Trace the exact cognitive pathway and identify WHERE logic diverged.

Student's transcribed work:
${JSON.stringify(recognition.transcription, null, 2)}

Subject: ${problemContext?.subject || 'General'}

Error types: COMPUTATIONAL | PROCEDURAL | CONCEPTUAL | TRANSCRIPTION | NONE

Return ONLY valid JSON:
{
  "score": 0,
  "isCorrect": false,
  "logicTrace": [{"step": 1, "content": "...", "isValid": true, "note": null}],
  "divergencePoint": {"step": 1, "errorType": "COMPUTATIONAL", "explanation": "..."},
  "remediation": "...",
  "confidence": 0.0
}`;

    const evaluation = await callGemini(imageBase64, evalPrompt);

    return { ...evaluation, _recognition: recognition, timestamp: Date.now() };
}

// ═══════════════════════════════════════════════════════════
//  DEFENSE-IN-DEPTH: 6-Gate Pipeline (Phase 10)
// ═══════════════════════════════════════════════════════════

const _generatePipelineId = () => `PL-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;

const _createPipelineError = (code, message, details = {}) => ({
    success: false,
    error: { code, message, timestamp: Date.now(), ...details },
    analysis: null,
});

const _validateResult = (result) => {
    const issues = [];
    if (!result) issues.push('Result is null');
    else {
        if (!result.score && result.score !== 0 && !result.logicTrace) issues.push('Missing core fields');
        if (result.confidence === 1.0) issues.push('Suspiciously perfect confidence');
    }
    return { valid: issues.length === 0, issues };
};

/**
 * Run the full defense-in-depth analysis pipeline.
 * 6 gates: null → geometry → pre-flight → content → analysis → result validation.
 *
 * @param {object} capture         — { image, quad, timestamp, readinessScore }
 * @param {object} readinessState  — from ReadinessEngine.assess()
 * @param {object} [options]       — { subject, mode, ... }
 * @returns {Promise<object>}
 */
export async function runAnalysisPipeline(capture, readinessState, options = {}) {
    const pid = _generatePipelineId();
    const t0 = Date.now();
    console.log(`[Pipeline ${pid}] Starting`);

    // ── GATE 1: Null / empty ───────────────────────────────
    if (!capture) {
        console.error(`[Pipeline ${pid}] ABORT: No capture data`);
        return _createPipelineError('NULL_CAPTURE', 'No capture data provided');
    }

    // ── GATE 2: Geometry validation ────────────────────────
    if (!capture.quad || !Array.isArray(capture.quad) || capture.quad.length !== 4) {
        console.error(`[Pipeline ${pid}] ABORT: Invalid geometry`);
        return _createPipelineError('INVALID_GEOMETRY', 'No valid document geometry. Position a document in frame.');
    }
    for (let i = 0; i < 4; i++) {
        const p = capture.quad[i];
        if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || isNaN(p.x) || isNaN(p.y)) {
            console.error(`[Pipeline ${pid}] ABORT: Corrupt geometry at point ${i}`);
            return _createPipelineError('CORRUPT_GEOMETRY', 'Document detection data is corrupt. Try again.');
        }
    }

    // ── GATE 3: Pre-flight check ──────────────────────────
    console.log(`[Pipeline ${pid}] Pre-flight checks…`);
    const pfResult = await preFlightCheck.run(capture, readinessState);
    if (!pfResult.passed) {
        const primary = pfResult.failures[0];
        console.error(`[Pipeline ${pid}] ABORT: Pre-flight failed`, primary);
        return _createPipelineError('PREFLIGHT_FAILED', primary.reason || 'Pre-flight checks failed', { preFlightResult: pfResult });
    }
    if (pfResult.warnings.length > 0) {
        console.warn(`[Pipeline ${pid}] Pre-flight warnings:`, pfResult.warnings.map(w => w.reason));
    }

    // ── GATE 4: Content validation ─────────────────────────
    if (readinessState?.factors?.edgeDensity !== undefined && readinessState.factors.edgeDensity < 0.05) {
        console.error(`[Pipeline ${pid}] ABORT: No content detected`);
        return _createPipelineError('NO_CONTENT', 'Captured image appears blank or has no readable content.');
    }

    // ── GATE 5: Execute analysis ──────────────────────────
    console.log(`[Pipeline ${pid}] All gates passed. Executing analysis…`);
    let analysisResult;
    try {
        if (USE_MOCK && !GEMINI_API_KEY) {
            analysisResult = await smartMock.analyze({ ...capture, readiness: readinessState });
        } else {
            try {
                // Try real analysis
                const realResult = await analyzeWithLogicEngine(capture.image, options, { imageQuality: readinessState?.factors?.qualityEstimate });

                // If real analysis returned a mock result (e.g. key missing/invalid), respect it
                if (realResult._mock) {
                    analysisResult = { success: true, analysis: realResult };
                } else {
                    analysisResult = { success: true, analysis: realResult };
                }
            } catch (networkErr) {
                // Network/API failure → Fallback to SmartMock estimate
                console.warn(`[Pipeline ${pid}] Network analysis failed, falling back to offline estimate:`, networkErr);
                const offlineResult = await smartMock.analyze({ ...capture, readiness: readinessState });

                analysisResult = {
                    success: true,
                    analysis: {
                        ...offlineResult.analysis,
                        _offlineEstimate: true,
                        warnings: ['Network unavailable — result is an estimate based on image analysis']
                    },
                    warnings: ['Network unavailable — using offline estimate']
                };
            }
        }
    } catch (err) {
        console.error(`[Pipeline ${pid}] Analysis execution fatally failed:`, err);
        return _createPipelineError('ANALYSIS_ERROR', err.message);
    }

    // ── GATE 6: Result validation ─────────────────────────
    const resultData = analysisResult.success ? (analysisResult.analysis || analysisResult) : null;
    const validation = _validateResult(resultData);
    if (!validation.valid && analysisResult.success) {
        console.error(`[Pipeline ${pid}] ABORT: Invalid result`, validation);
        return _createPipelineError('INVALID_RESULT', 'Analysis produced invalid results. Try again.', { validationIssues: validation.issues });
    }

    // ── SUCCESS ────────────────────────────────────────────
    const duration = Date.now() - t0;
    console.log(`[Pipeline ${pid}] Complete in ${duration}ms`);

    return {
        success: true,
        pipelineId: pid,
        duration,
        preFlightResult: pfResult,
        analysis: resultData,
        result: resultData, // alias for backward compat
        warnings: [...pfResult.warnings.map(w => w.reason), ...(analysisResult.warnings || [])],
        meta: { usedMock: USE_MOCK, timestamp: Date.now(), readinessScore: readinessState?.score },
    };
}

// ═══════════════════════════════════════════════════════════
//  Exports for external use
// ═══════════════════════════════════════════════════════════
export { promptEngine, calibrator, preFlightCheck, smartMock };
