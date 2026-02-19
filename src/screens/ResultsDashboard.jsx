import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '../context/OnboardingContext';
import {
    ArrowLeft, ChevronDown, ChevronUp, Brain, MessageSquare,
    AlertTriangle, CheckCircle2, BarChart3, Users, Camera, Trash2, Clock,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
//  Helper: Convert a stored trace record → display-ready student object
// ═══════════════════════════════════════════════════════════
function traceToStudent(record, index) {
    const score = record.score ?? 0;
    const grade = score >= 93 ? 'A' : score >= 90 ? 'A-' : score >= 87 ? 'B+'
        : score >= 83 ? 'B' : score >= 80 ? 'B-' : score >= 77 ? 'C+'
            : score >= 73 ? 'C' : score >= 70 ? 'C-' : score >= 60 ? 'D' : 'F';

    const gradeColor = score >= 90 ? 'var(--grade-a)'
        : score >= 80 ? 'var(--grade-b)'
            : score >= 70 ? 'var(--grade-c)'
                : score >= 60 ? 'var(--grade-d)'
                    : 'var(--grade-f)';

    // Parse logic_trace — it may be an array of step objects or a raw array
    let steps = [];
    let divergence = null;
    if (Array.isArray(record.logic_trace)) {
        steps = record.logic_trace.map(s => typeof s === 'string' ? s : s.content || `Step ${s.step}`);
        divergence = record.logic_trace.findIndex(s => s.isValid === false);
        if (divergence === -1) divergence = null;
    }

    // Parse divergence_point for error type
    let errorType = null;
    if (record.divergence_point) {
        const dp = typeof record.divergence_point === 'string'
            ? JSON.parse(record.divergence_point)
            : record.divergence_point;
        errorType = dp.errorType?.replace(/_/g, ' ') || null;
        if (errorType === 'NONE' || errorType === 'None') errorType = null;
    }

    return {
        id: record.id || `scan_${index}`,
        traceId: record.id,
        displayIndex: index + 1,
        grade,
        gradeColor,
        score,
        errorType,
        feedback: record.remediation || 'No feedback available.',
        logicTrace: { steps, divergence },
        confidence: record.confidence ?? 0.8,
        isCorrect: record.is_correct ?? (score >= 70),
        timestamp: record.created_at,
        sessionId: record.session_id,
        captureQuality: record.capture_quality,
        isReal: true,
    };
}

// Convert a scanResult from OnboardingContext → display-ready student
function scanResultToStudent(scanResult) {
    const score = scanResult.score ?? 0;
    const grade = score >= 93 ? 'A' : score >= 90 ? 'A-' : score >= 87 ? 'B+'
        : score >= 83 ? 'B' : score >= 80 ? 'B-' : score >= 77 ? 'C+'
            : score >= 73 ? 'C' : score >= 70 ? 'C-' : score >= 60 ? 'D' : 'F';

    const gradeColor = score >= 90 ? 'var(--grade-a)'
        : score >= 80 ? 'var(--grade-b)'
            : score >= 70 ? 'var(--grade-c)'
                : score >= 60 ? 'var(--grade-d)'
                    : 'var(--grade-f)';

    return {
        id: 'current',
        traceId: scanResult.id,
        displayIndex: 0,
        grade,
        gradeColor,
        score,
        errorType: scanResult.divergencePoint?.errorType?.replace(/_/g, ' ') || null,
        feedback: scanResult.remediation || 'No feedback available.',
        logicTrace: {
            steps: (scanResult.logicTrace || []).map(s => s.content || `Step ${s.step}`),
            divergence: (scanResult.logicTrace || []).findIndex(s => !s.isValid),
        },
        confidence: scanResult.confidence,
        isReal: true,
        isCurrent: true,
        timestamp: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════
//  RESULTS DASHBOARD — Real Data
// ═══════════════════════════════════════════════════════════
export default function ResultsDashboard() {
    const navigate = useNavigate();
    const { data, scanResult } = useOnboarding();
    const [expandedId, setExpandedId] = useState(null);
    const [corrections, setCorrections] = useState({});
    const [storedTraces, setStoredTraces] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load traces from localStorage on mount
    useEffect(() => {
        const load = async () => {
            const { getAllTraces } = await import('../lib/storageLayer');
            const traces = getAllTraces();
            setStoredTraces(traces);
            setIsLoading(false);
        };
        load();
    }, []);

    // Build display list: current scan first, then stored traces (deduped)
    const displayStudents = (() => {
        const students = [];
        const seenIds = new Set();

        // 1. Current session's scan result (if any)
        if (scanResult) {
            const current = scanResultToStudent(scanResult);
            students.push(current);
            if (scanResult.id) seenIds.add(scanResult.id);
        }

        // 2. All stored traces (skip duplicates)
        for (let i = 0; i < storedTraces.length; i++) {
            const trace = storedTraces[i];
            if (seenIds.has(trace.id)) continue;
            seenIds.add(trace.id);
            students.push(traceToStudent(trace, students.length));
        }

        return students;
    })();

    const avgScore = displayStudents.length > 0
        ? Math.round(displayStudents.reduce((a, s) => a + s.score, 0) / displayStudents.length)
        : 0;
    const errorCount = displayStudents.filter(s => s.errorType).length;

    const handleFlag = async (student) => {
        const { submitCorrection } = await import('../lib/storageLayer');
        await submitCorrection(student.traceId, {
            originalErrorType: student.errorType,
            actualErrorType: 'MANUAL_REVIEW',
            notes: 'Teacher flagged as incorrect',
        });
        setCorrections(prev => ({ ...prev, [student.id]: true }));
    };

    const handleClearAll = async () => {
        const { clearAllTraces } = await import('../lib/storageLayer');
        clearAllTraces();
        setStoredTraces([]);
    };

    // Format relative time
    const timeAgo = (timestamp) => {
        if (!timestamp) return '';
        const diff = Date.now() - new Date(timestamp).getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };


    return (
        <motion.div
            className="screen"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ justifyContent: 'flex-start', padding: '0', minHeight: '100vh' }}
        >
            {/* Header */}
            <div style={{
                width: '100%', padding: '20px 20px 24px',
                background: 'linear-gradient(180deg, var(--surface-base) 0%, transparent 100%)',
                position: 'sticky', top: 0, zIndex: 20,
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            }}>
                <div style={{ maxWidth: 560, margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <button
                            onClick={() => navigate('/grade')}
                            style={{
                                width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-card)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <ArrowLeft size={18} color="var(--text-secondary)" />
                        </button>
                        <div style={{ flex: 1 }}>
                            <h1 className="text-heading">{data.subject || 'Analysis'} Results</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                {displayStudents.length === 0
                                    ? 'No scans yet'
                                    : `${displayStudents.length} scan${displayStudents.length !== 1 ? 's' : ''}`
                                }
                            </p>
                        </div>
                        {displayStudents.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                title="Clear scan history"
                                style={{
                                    width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                                }}
                            >
                                <Trash2 size={14} color="var(--grade-f)" />
                            </button>
                        )}
                    </div>

                    {/* Stats — only show when there's data */}
                    {displayStudents.length > 0 && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div className="glass-card" style={{ flex: 1, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <BarChart3 size={18} color="var(--lymbic-purple-light)" />
                                <div>
                                    <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{avgScore}%</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Avg Score</p>
                                </div>
                            </div>
                            <div className="glass-card" style={{ flex: 1, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Users size={18} color="var(--logic-green)" />
                                <div>
                                    <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{displayStudents.length}</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Scans</p>
                                </div>
                            </div>
                            <div className="glass-card" style={{ flex: 1, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <AlertTriangle size={18} color="var(--grade-c)" />
                                <div>
                                    <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{errorCount}</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Errors Found</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── EMPTY STATE ─── */}
            {!isLoading && displayStudents.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        maxWidth: 400, margin: '60px auto', padding: '0 20px',
                        textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
                    }}
                >
                    <div style={{
                        width: 80, height: 80, borderRadius: 24,
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Camera size={36} color="var(--lymbic-purple)" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>No Scans Yet</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            Scan a student worksheet to see real analysis results here — logic traces, error detection, and personalized feedback.
                        </p>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/scan')}
                        className="btn-primary"
                        style={{ padding: '14px 32px', fontSize: '1rem', gap: '8px' }}
                    >
                        <Camera size={20} /> Scan Your First Page
                    </motion.button>
                </motion.div>
            )}

            {/* ─── LOADING STATE ─── */}
            {isLoading && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    Loading scan history...
                </div>
            )}

            {/* ─── STUDENT LIST ─── */}
            <div style={{
                maxWidth: 560, width: '100%', margin: '0 auto', padding: '0 20px 32px',
                display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
                {displayStudents.map((student, i) => (
                    <motion.div
                        key={student.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.4 }}
                    >
                        <button
                            onClick={() => setExpandedId(expandedId === student.id ? null : student.id)}
                            className="glass-card"
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px',
                                cursor: 'pointer',
                                border: student.isCurrent
                                    ? '1px solid var(--lymbic-purple)'
                                    : expandedId === student.id
                                        ? '1px solid var(--lymbic-purple)'
                                        : '1px solid var(--surface-glass-border)',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <div style={{
                                width: 44, height: 44, borderRadius: 12, background: `${student.gradeColor}15`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                position: 'relative',
                            }}>
                                <span style={{ color: student.gradeColor, fontWeight: 800, fontSize: '1rem' }}>
                                    {student.grade}
                                </span>
                                {student.isCurrent && (
                                    <div style={{
                                        position: 'absolute', top: -4, right: -4,
                                        width: 12, height: 12, borderRadius: '50%',
                                        background: 'var(--lymbic-purple)',
                                        border: '2px solid var(--surface-base)',
                                    }} />
                                )}
                            </div>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                        {student.isCurrent ? 'Current Scan' : `Scan #${student.displayIndex}`}
                                    </p>
                                    {student.isCurrent && (
                                        <span style={{
                                            fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px',
                                            background: 'var(--lymbic-purple)', color: 'white',
                                            borderRadius: 6, textTransform: 'uppercase',
                                        }}>
                                            NEW
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        {student.errorType || 'No errors detected'}
                                    </p>
                                    {student.timestamp && (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', opacity: 0.6 }}>
                                            · {timeAgo(student.timestamp)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: student.gradeColor, fontWeight: 700, fontSize: '1rem' }}>
                                    {student.score}%
                                </span>
                                {expandedId === student.id
                                    ? <ChevronUp size={16} color="var(--text-muted)" />
                                    : <ChevronDown size={16} color="var(--text-muted)" />
                                }
                            </div>
                        </button>

                        <AnimatePresence>
                            {expandedId === student.id && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <div style={{
                                        padding: '16px 18px', background: 'var(--surface-card)',
                                        borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', borderTop: 'none',
                                        display: 'flex', flexDirection: 'column', gap: '16px',
                                    }}>
                                        {/* Confidence Badge */}
                                        {student.confidence != null && (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '8px 12px', borderRadius: '8px',
                                                background: student.confidence >= 0.8 ? 'rgba(52, 211, 153, 0.06)' : 'rgba(251, 191, 36, 0.06)',
                                                border: `1px solid ${student.confidence >= 0.8 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)'}`,
                                            }}>
                                                <BarChart3 size={12} color={student.confidence >= 0.8 ? 'var(--logic-green)' : '#fbbf24'} />
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    Confidence: {Math.round(student.confidence * 100)}%
                                                </span>
                                            </div>
                                        )}

                                        {/* Logic Trace */}
                                        {student.logicTrace.steps.length > 0 && (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                                    <Brain size={14} color="var(--lymbic-purple-light)" />
                                                    <span className="text-caption" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>LOGIC TRACE</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {student.logicTrace.steps.map((step, si) => {
                                                        const isDivergence = student.logicTrace.divergence !== null && si >= student.logicTrace.divergence;
                                                        return (
                                                            <div key={si} style={{
                                                                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                                                                borderRadius: '6px',
                                                                background: isDivergence ? 'rgba(239, 68, 68, 0.08)' : 'rgba(52, 211, 153, 0.06)',
                                                                border: `1px solid ${isDivergence ? 'rgba(239, 68, 68, 0.2)' : 'rgba(52, 211, 153, 0.15)'}`,
                                                            }}>
                                                                {isDivergence
                                                                    ? <AlertTriangle size={12} color="var(--grade-f)" />
                                                                    : <CheckCircle2 size={12} color="var(--logic-green)" />
                                                                }
                                                                <span style={{
                                                                    fontSize: '0.78rem',
                                                                    color: isDivergence ? 'var(--grade-f)' : 'var(--text-secondary)',
                                                                }}>
                                                                    Step {si + 1}: {step}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Teacher Twin Feedback */}
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                                <MessageSquare size={14} color="var(--logic-green)" />
                                                <span className="text-caption" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>TEACHER FEEDBACK</span>
                                            </div>
                                            <div className="chat-bubble chat-bubble-ai" style={{ maxWidth: '100%', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                                {student.feedback}
                                            </div>
                                        </div>

                                        {/* Flag Button */}
                                        {student.traceId && !corrections[student.id] && (
                                            <motion.button
                                                whileTap={{ scale: 0.97 }}
                                                onClick={() => handleFlag(student)}
                                                style={{
                                                    padding: '8px 14px', fontSize: '0.75rem',
                                                    background: 'rgba(239, 68, 68, 0.06)',
                                                    border: '1px solid rgba(239, 68, 68, 0.15)',
                                                    borderRadius: '8px', color: 'var(--grade-f)',
                                                    cursor: 'pointer', fontWeight: 600,
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    alignSelf: 'flex-start',
                                                }}
                                            >
                                                <AlertTriangle size={12} /> Flag as Incorrect
                                            </motion.button>
                                        )}
                                        {corrections[student.id] && (
                                            <p style={{ color: 'var(--logic-green)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <CheckCircle2 size={12} /> Flagged for review
                                            </p>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
