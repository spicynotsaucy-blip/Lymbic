// ═══════════════════════════════════════════════════════════
//  LAYER 2: ANALYSIS ENGINE — Gemini Multi-Pass LLM
// ═══════════════════════════════════════════════════════════

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ─── Mock data for development / no-API fallback ───────────
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
                {
                    inline_data: {
                        mime_type: 'image/jpeg',
                        data: base64Data,
                    },
                },
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

    return JSON.parse(text);
}

/**
 * Pass 1 — Recognition: Transcribe the handwritten work.
 */
async function recognizeWork(imageBase64) {
    const prompt = `You are an expert at reading handwritten student math/science work.

Transcribe this worksheet image exactly as written. Include all steps, crossed-out work, and margin annotations.

Return ONLY valid JSON in this exact shape:
{
  "transcription": ["step 1 text", "step 2 text", ...],
  "problemType": "algebra | calculus | physics | chemistry | geometry | other",
  "confidence": 0.0
}

confidence should be 0.0-1.0 based on how legible the handwriting is.`;

    return callGemini(imageBase64, prompt);
}

/**
 * Pass 2 — Evaluation: Trace the logic and classify errors.
 */
async function evaluateWork(imageBase64, transcription, problemContext) {
    const prompt = `You are a logic-trace analyst for an AI grading system called Lymbic.

Your job is NOT to simply grade — it is to trace the exact cognitive pathway and identify WHERE the logic diverged from correct reasoning.

Student's transcribed work:
${JSON.stringify(transcription, null, 2)}

Subject context: ${problemContext?.subject || 'General'}

Classify any error as ONE of:
- COMPUTATIONAL: Arithmetic mistake, correct method
- PROCEDURAL: Skipped required step, incomplete process
- CONCEPTUAL: Fundamental misunderstanding of the operation
- TRANSCRIPTION: Copied problem incorrectly
- NONE: Work is fully correct

Return ONLY valid JSON in this exact shape:
{
  "score": 0,
  "isCorrect": false,
  "logicTrace": [
    { "step": 1, "content": "description of what student did", "isValid": true, "note": null }
  ],
  "divergencePoint": {
    "step": 1,
    "errorType": "COMPUTATIONAL",
    "explanation": "Specific description of what went wrong"
  },
  "remediation": "One sentence of actionable feedback for the student",
  "confidence": 0.0
}

If the work is correct, set divergencePoint to null and errorType to "NONE".
score is 0-100. confidence is 0.0-1.0 based on how certain you are of your analysis.`;

    return callGemini(imageBase64, prompt);
}

/**
 * Main analysis pipeline — runs both passes and returns combined result.
 * Falls back to mock data if API key is missing.
 * @param {string} imageBase64
 * @param {object} problemContext  e.g. { subject: 'Physics', grade: '10' }
 */
export async function analyzeWithLogicEngine(imageBase64, problemContext = {}) {
    // Use mock if no API key configured
    if (!GEMINI_API_KEY) {
        console.warn('[Lymbic] No VITE_GEMINI_API_KEY — using mock analysis');
        await new Promise(r => setTimeout(r, 2200)); // simulate latency
        return { ...MOCK_RESULT, _mock: true, timestamp: Date.now() };
    }

    try {
        // Pass 1: Recognition
        const recognition = await recognizeWork(imageBase64);

        // Pass 2: Evaluation (sends image again for visual grounding)
        const evaluation = await evaluateWork(imageBase64, recognition.transcription, problemContext);

        return {
            ...evaluation,
            _recognition: recognition,
            timestamp: Date.now(),
        };
    } catch (err) {
        console.error('[Lymbic] Analysis failed, falling back to mock:', err);
        // Graceful degradation — never crash the UI
        return { ...MOCK_RESULT, _mock: true, _error: err.message, timestamp: Date.now() };
    }
}
