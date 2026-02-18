// ═══════════════════════════════════════════════════════════
//  LAYER 3a: ZOD SCHEMA — Validate LLM responses
// ═══════════════════════════════════════════════════════════
import { z } from 'zod';

export const LogicStepSchema = z.object({
    step: z.number().int().positive(),
    content: z.string().min(1),
    isValid: z.boolean(),
    note: z.string().nullable(),
});

export const DivergencePointSchema = z.object({
    step: z.number().int().positive(),
    errorType: z.enum(['COMPUTATIONAL', 'PROCEDURAL', 'CONCEPTUAL', 'TRANSCRIPTION', 'NONE']),
    explanation: z.string().min(1),
}).nullable();

export const AnalysisResultSchema = z.object({
    score: z.number().min(0).max(100),
    isCorrect: z.boolean(),
    logicTrace: z.array(LogicStepSchema).min(1),
    divergencePoint: DivergencePointSchema,
    remediation: z.string().min(1),
    confidence: z.number().min(0).max(1).optional().default(0.8),
});

/**
 * Safely parse and validate an LLM response.
 * Returns { success: true, data } or { success: false, error }.
 */
export function validateAnalysisResult(raw) {
    try {
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const data = AnalysisResultSchema.parse(obj);
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}
