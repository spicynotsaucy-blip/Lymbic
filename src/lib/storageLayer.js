// ═══════════════════════════════════════════════════════════
//  LAYER 3b: STORAGE LAYER — Supabase + localStorage fallback
// ═══════════════════════════════════════════════════════════
import { validateAnalysisResult } from './schema';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Lazy-load Supabase only if configured
let _supabase = null;
async function getSupabase() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;
    if (_supabase) return _supabase;
    const { createClient } = await import('@supabase/supabase-js');
    _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    return _supabase;
}

/**
 * Generate a simple session ID for grouping results.
 */
function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize, validate, and store an analysis result.
 * Falls back to localStorage if Supabase is not configured.
 *
 * @param {object} rawResult   — Raw output from analyzeWithLogicEngine
 * @param {object} metadata    — Capture metadata (qualityScore, dimensions, etc.)
 * @param {string} sessionId   — Groups multiple scans in one grading session
 * @returns {{ success: boolean, id: string, result: object }}
 */
export async function normalizeAndStore(rawResult, metadata, sessionId) {
    // 1. Validate
    const validation = validateAnalysisResult(rawResult);

    if (!validation.success) {
        console.error('[Lymbic] Validation failed:', validation.error);
        // Store raw for debugging
        const errorRecord = {
            raw_response: JSON.stringify(rawResult),
            error: validation.error,
            capture_metadata: metadata,
            created_at: new Date().toISOString(),
        };

        const supabase = await getSupabase();
        if (supabase) {
            await supabase.from('analysis_errors').insert(errorRecord);
        } else {
            const errors = JSON.parse(localStorage.getItem('lymbic_errors') || '[]');
            errors.push(errorRecord);
            localStorage.setItem('lymbic_errors', JSON.stringify(errors));
        }

        return { success: false, error: 'Response validation failed' };
    }

    const record = {
        id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        session_id: sessionId || generateSessionId(),
        score: validation.data.score,
        is_correct: validation.data.isCorrect,
        logic_trace: validation.data.logicTrace,
        divergence_point: validation.data.divergencePoint,
        remediation: validation.data.remediation,
        confidence: validation.data.confidence,
        capture_quality: metadata?.qualityScore ?? 1,
        created_at: new Date().toISOString(),
    };

    // 2. Try Supabase
    const supabase = await getSupabase();
    if (supabase) {
        const { data, error } = await supabase
            .from('logic_traces')
            .insert(record)
            .select()
            .single();

        if (error) {
            console.error('[Lymbic] Supabase insert failed:', error);
            // Fall through to localStorage
        } else {
            return { success: true, id: data.id, result: validation.data };
        }
    }

    // 3. localStorage fallback
    const traces = JSON.parse(localStorage.getItem('lymbic_traces') || '[]');
    traces.push(record);
    localStorage.setItem('lymbic_traces', JSON.stringify(traces));

    return { success: true, id: record.id, result: validation.data };
}

/**
 * Submit a teacher correction for a specific trace.
 * This is the feedback loop signal for future model improvement.
 */
export async function submitCorrection(traceId, correction) {
    const record = {
        trace_id: traceId,
        original_error_type: correction.originalErrorType,
        actual_error_type: correction.actualErrorType,
        notes: correction.notes || null,
        created_at: new Date().toISOString(),
    };

    const supabase = await getSupabase();
    if (supabase) {
        const { error } = await supabase.from('corrections').insert(record);
        if (!error) return { success: true };
    }

    // localStorage fallback
    const corrections = JSON.parse(localStorage.getItem('lymbic_corrections') || '[]');
    corrections.push(record);
    localStorage.setItem('lymbic_corrections', JSON.stringify(corrections));
    return { success: true };
}

/**
 * Load all traces from localStorage (for offline/demo mode).
 */
export function getLocalTraces() {
    return JSON.parse(localStorage.getItem('lymbic_traces') || '[]');
}
