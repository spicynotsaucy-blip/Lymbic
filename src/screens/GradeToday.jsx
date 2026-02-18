import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useOnboarding } from '../context/OnboardingContext';
import { Camera, ShieldCheck, Clock, Users } from 'lucide-react';

export default function GradeToday() {
    const navigate = useNavigate();
    const { data } = useOnboarding();

    const subject = data.subject || 'Physics Midterms';
    const count = data.studentCount || 30;

    return (
        <motion.div
            className="screen"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            style={{ justifyContent: 'center' }}
        >
            <div className="screen-content" style={{ gap: '40px', textAlign: 'center' }}>
                {/* Dynamic Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                    <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                        Ready when you are, {data.teacherName || 'Teacher'}
                    </p>
                    <h1 className="text-hero" style={{ fontSize: '2.2rem' }}>
                        Grade your{' '}
                        <span className="text-gradient">{subject}</span>
                        {' '}today.
                    </h1>
                </motion.div>

                {/* Workload counter */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="glass-card"
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '24px', padding: '16px 24px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={16} color="var(--text-muted)" />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{count}</strong> students
                        </span>
                    </div>
                    <div style={{ width: 1, height: 20, background: 'var(--surface-glass-border)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} color="var(--text-muted)" />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            <strong style={{ color: 'var(--grade-d)' }}>~5 hrs</strong> manually
                        </span>
                    </div>
                    <div style={{ width: 1, height: 20, background: 'var(--surface-glass-border)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--logic-green)', fontSize: '0.9rem', fontWeight: 600 }}>
                            ~5 min with Lymbic
                        </span>
                    </div>
                </motion.div>

                {/* Camera CTA */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: '20px', position: 'relative',
                    }}
                >
                    {/* Pulsing rings */}
                    <div style={{
                        position: 'absolute', width: 160, height: 160, borderRadius: '50%',
                        border: '2px solid rgba(124, 58, 237, 0.2)',
                        animation: 'pulse-glow 3s ease-in-out infinite',
                    }} />
                    <div style={{
                        position: 'absolute', width: 200, height: 200, borderRadius: '50%',
                        border: '1px solid rgba(124, 58, 237, 0.1)',
                        animation: 'pulse-glow 3s ease-in-out infinite 0.5s',
                    }} />

                    <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/scan')}
                        style={{
                            width: 120, height: 120, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--lymbic-purple), var(--lymbic-purple-deep))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            boxShadow: '0 0 40px var(--lymbic-purple-glow), 0 0 80px rgba(124, 58, 237, 0.15)',
                            position: 'relative', zIndex: 1,
                        }}
                    >
                        <Camera size={48} color="white" strokeWidth={1.5} />
                    </motion.button>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500 }}>
                        Tap the camera to get started
                    </p>
                </motion.div>

                {/* Anonymization badge */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className="badge badge-green"
                    style={{ alignSelf: 'center', padding: '8px 16px', gap: '6px' }}
                >
                    <ShieldCheck size={14} />
                    <span>Anonymization Active — Names stripped automatically</span>
                </motion.div>
            </div>
        </motion.div>
    );
}
