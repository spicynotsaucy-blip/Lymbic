// ═══════════════════════════════════════════════════════════
//  LAYER 3b: STORAGE LAYER — Supabase + localStorage fallback
// ═══════════════════════════════════════════════════════════
import { validateAnalysisResult } from './schema';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Lazy-load Supabase only if configured
let _supabase = null;
export async function getSupabase() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;
    if (_supabase) return _supabase;
    const { createClient } = await import('@supabase/supabase-js');
    _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    return _supabase;
}

/**
 * Returns the JWT to use for Edge Function / API calls: session access_token when logged in, else anon key.
 */
export async function getAuthToken() {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? SUPABASE_KEY;
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
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                await supabase.from('analysis_errors').insert({ ...errorRecord, user_id: session.user.id });
            } else {
                const errors = JSON.parse(localStorage.getItem('lymbic_errors') || '[]');
                errors.push(errorRecord);
                localStorage.setItem('lymbic_errors', JSON.stringify(errors));
            }
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

    // 2. Try Supabase (with user_id when authenticated; RLS requires auth)
    const supabase = await getSupabase();
    if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
            const { data, error } = await supabase
                .from('logic_traces')
                .insert({ ...record, user_id: session.user.id })
                .select()
                .single();
            if (!error) return { success: true, id: data.id, result: validation.data };
            console.error('[Lymbic] Supabase insert failed:', error);
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
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
            const { error } = await supabase.from('corrections').insert({ ...record, user_id: session.user.id });
            if (!error) return { success: true };
        }
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

/**
 * Fetch all traces from Supabase (when configured). Returns [] on error or no Supabase.
 */
export async function getAllTracesFromSupabase() {
    const supabase = await getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('logic_traces')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) {
        console.warn('[Lymbic] Supabase get traces failed:', error);
        return [];
    }
    return data || [];
}

/**
 * Fetch traces for a session from Supabase. Returns [] on error or no Supabase.
 */
export async function getSessionTracesFromSupabase(sessionId) {
    if (!sessionId) return [];
    const supabase = await getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('logic_traces')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
    if (error) {
        console.warn('[Lymbic] Supabase get session traces failed:', error);
        return [];
    }
    return data || [];
}

/**
 * Get all traces sorted by created_at descending. Uses Supabase when configured and request succeeds; falls back to localStorage otherwise.
 * @returns {Promise<Array>}
 */
export async function getAllTraces() {
    const supabase = await getSupabase();
    if (supabase) {
        const { data, error } = await supabase
            .from('logic_traces')
            .select('*')
            .order('created_at', { ascending: false });
        if (!error) return data || [];
        console.warn('[Lymbic] Supabase get traces failed:', error);
    }
    const local = getLocalTraces();
    return local.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Get traces for a specific session ID. Uses Supabase when configured and request succeeds; falls back to localStorage otherwise.
 * @returns {Promise<Array>}
 */
export async function getSessionTraces(sessionId) {
    if (!sessionId) return getLocalTraces().filter(t => t.session_id === sessionId);
    const supabase = await getSupabase();
    if (supabase) {
        const { data, error } = await supabase
            .from('logic_traces')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });
        if (!error) return data || [];
        console.warn('[Lymbic] Supabase get session traces failed:', error);
    }
    return getLocalTraces().filter(t => t.session_id === sessionId);
}

/**
 * Clear all stored traces (for testing/reset).
 */
export function clearAllTraces() {
    localStorage.removeItem('lymbic_traces');
    localStorage.removeItem('lymbic_errors');
    localStorage.removeItem('lymbic_corrections');
}
