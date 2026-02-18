import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '../context/OnboardingContext';
import {
    ArrowLeft, ChevronDown, ChevronUp, Brain, MessageSquare,
    AlertTriangle, CheckCircle2, BarChart3, Users,
} from 'lucide-react';

const STUDENTS = [
    {
        id: 1, grade: 'A', score: 94, gradeColor: 'var(--grade-a)', errorType: null,
        feedback: "Excellent work. Your method is clean and your calculations are precise. Keep it up!",
        logicTrace: { steps: ['Correct formulation', 'Correct algebra', 'Correct calculation', 'Correct conclusion'], divergence: null },
    },
    {
        id: 2, grade: 'B+', score: 87, gradeColor: 'var(--grade-b)', errorType: 'Rounding Error',
        feedback: "Strong understanding of the concept. You rounded too early in step 3 — carry the full decimal until the final answer.",
        logicTrace: { steps: ['Correct formulation', 'Correct algebra', 'Premature rounding (lost precision)', 'Slightly off conclusion'], divergence: 2 },
    },
    {
        id: 3, grade: 'C+', score: 72, gradeColor: 'var(--grade-c)', errorType: 'Sign Flip Error',
        feedback: "You nailed the physics concept, but watch your signs! You flipped the negative in step 2. Check your side-work — you actually had it right in the margin.",
        logicTrace: { steps: ['Correct formulation', 'Algebraic inversion error (sign flip)', 'Carried error forward', 'Faulty conclusion'], divergence: 1 },
        scratchNote: "Student correctly calculated -14.14 on the right margin, but copied it as +14.14 in the main work.",
    },
    {
        id: 4, grade: 'A-', score: 91, gradeColor: 'var(--grade-a)', errorType: null,
        feedback: "Great work overall. Minor notation issue in step 2 but the logic is solid.",
        logicTrace: { steps: ['Correct formulation', 'Correct algebra (minor notation)', 'Correct calculation', 'Correct conclusion'], divergence: null },
    },
    {
        id: 5, grade: 'B', score: 83, gradeColor: 'var(--grade-b)', errorType: 'Unit Conversion',
        feedback: "Good approach! You mixed up meters and centimeters in step 3. The physics reasoning is correct — just watch your units.",
        logicTrace: { steps: ['Correct formulation', 'Correct algebra', 'Unit conversion error (m→cm)', 'Off by factor of 100'], divergence: 2 },
    },
    {
        id: 6, grade: 'D', score: 58, gradeColor: 'var(--grade-d)', errorType: 'Conceptual Misunderstanding',
        feedback: "I can see you're trying hard. The main issue is in step 1 — you used the wrong kinematic equation. Let's review projectile motion fundamentals.",
        logicTrace: { steps: ['Wrong equation selected', 'Algebra on wrong equation', 'Compounded error', 'Incorrect conclusion'], divergence: 0 },
    },
    {
        id: 7, grade: 'B-', score: 79, gradeColor: 'var(--grade-b)', errorType: 'Calculation Error',
        feedback: "Your setup and understanding are great. Small arithmetic mistake multiplying in step 2. Double-check your multiplication.",
        logicTrace: { steps: ['Correct formulation', 'Multiplication error (14.14 → 14.41)', 'Carried through', 'Slightly off'], divergence: 1 },
    },
    {
        id: 8, grade: 'A', score: 97, gradeColor: 'var(--grade-a)', errorType: null,
        feedback: "Perfect execution. Your scratchpad shows you even verified your answer — that's the mark of an excellent student.",
        logicTrace: { steps: ['Correct formulation', 'Correct algebra', 'Correct calculation', 'Verified answer'], divergence: null },
    },
    {
        id: 9, grade: 'C', score: 68, gradeColor: 'var(--grade-c)', errorType: 'Formula Recall Error',
        feedback: "You remembered the right type of equation but mixed up the formula. Review the difference between range and height equations.",
        logicTrace: { steps: ['Partially correct formulation', 'Correct algebra on wrong formula', 'Consistent error', 'Wrong but internally logical'], divergence: 0 },
    },
    {
        id: 10, grade: 'F', score: 42, gradeColor: 'var(--grade-f)', errorType: 'Multiple Fundamental Errors',
        feedback: "Don't get discouraged — I can see you attempted every step. Let's schedule a review session on the core kinematics equations. Your side-work shows good intuition.",
        logicTrace: { steps: ['Incorrect equation', 'Algebraic error', 'Sign error', 'No verification'], divergence: 0 },
        scratchNote: "Interestingly, the student drew a correct diagram in the margin showing the parabolic path — visual intuition is present but not yet connected to the math.",
    },
    {
        id: 11, grade: 'B+', score: 86, gradeColor: 'var(--grade-b)', errorType: 'Transcription Error',
        feedback: "Your logic is perfect! You just copied the wrong number from the question. Read the problem statement once more before calculating.",
        logicTrace: { steps: ['Misread initial velocity (20→25)', 'Correct algebra on wrong value', 'Consistent', 'Off due to wrong input'], divergence: 0 },
    },
    {
        id: 12, grade: 'A-', score: 90, gradeColor: 'var(--grade-a)', errorType: null,
        feedback: "Very strong. Clean work, good process. The only note: label your units consistently.",
        logicTrace: { steps: ['Correct formulation', 'Correct algebra', 'Correct but unlabeled units', 'Correct conclusion'], divergence: null },
    },
];

export default function ResultsDashboard() {
    const navigate = useNavigate();
    const { data } = useOnboarding();
    const [expandedId, setExpandedId] = useState(null);

    const avgScore = Math.round(STUDENTS.reduce((a, s) => a + s.score, 0) / STUDENTS.length);
    const errorCount = STUDENTS.filter(s => s.errorType).length;

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
                        <div>
                            <h1 className="text-heading">{data.subject || 'Physics'} Results</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                Scanned just now · {STUDENTS.length} students
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
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
                                <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{STUDENTS.length}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Students</p>
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
                </div>
            </div>

            {/* Student List */}
            <div style={{
                maxWidth: 560, width: '100%', margin: '0 auto', padding: '0 20px 32px',
                display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
                {STUDENTS.map((student, i) => (
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
                                border: expandedId === student.id ? '1px solid var(--lymbic-purple)' : '1px solid var(--surface-glass-border)',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <div style={{
                                width: 44, height: 44, borderRadius: 12, background: `${student.gradeColor}15`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                <span style={{ color: student.gradeColor, fontWeight: 800, fontSize: '1rem' }}>
                                    {student.grade}
                                </span>
                            </div>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Student #{student.id}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    {student.errorType || 'No errors detected'}
                                </p>
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
                                        {/* Logic Trace */}
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

                                        {/* Scratchpad Note */}
                                        {student.scratchNote && (
                                            <div style={{
                                                padding: '10px 12px', background: 'rgba(52, 211, 153, 0.06)',
                                                borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.15)',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--logic-green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        📝 Scratchpad Insight
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                                    {student.scratchNote}
                                                </p>
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
