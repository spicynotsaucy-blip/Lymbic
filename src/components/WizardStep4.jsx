import { motion } from 'framer-motion';
import { useOnboarding } from '../context/OnboardingContext';
import { Sparkles, ScanLine, ShieldCheck, Brain, ArrowRight } from 'lucide-react';

const steps = [
    { icon: ScanLine, color: '#A78BFA', title: 'Scan the answer key', desc: 'Show me the rubric or correct answers first.' },
    { icon: Brain, color: '#34D399', title: 'Scan student work', desc: "I'll read every line — even the scratchpad." },
    { icon: ShieldCheck, color: '#60A5FA', title: 'Instant anonymization', desc: "Names are stripped and blurred automatically." },
];

export default function WizardStep4({ onNext }) {
    const { data } = useOnboarding();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: 'linear-gradient(135deg, var(--lymbic-purple), var(--lymbic-purple-deep))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <Sparkles size={20} color="white" strokeWidth={1.5} />
                </div>
                <span className="text-small" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>LYMBIC</span>
            </div>

            <div className="chat-bubble chat-bubble-ai">
                <p style={{ marginBottom: '8px' }}>
                    Perfect, {data.teacherName || 'friend'}. I'm ready. ✨
                </p>
                <p>Here's how we'll do it:</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {steps.map((s, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="glass-card"
                        style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px' }}
                    >
                        <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: `${s.color}15`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <s.icon size={20} color={s.color} />
                        </div>
                        <div>
                            <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '2px' }}>{s.title}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{s.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                    background: 'rgba(52, 211, 153, 0.08)', borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(52, 211, 153, 0.2)',
                }}
            >
                <ShieldCheck size={16} color="var(--logic-green)" />
                <span style={{ color: 'var(--logic-green)', fontSize: '0.8rem', fontWeight: 500 }}>
                    Student names are always anonymized before storage.
                </span>
            </motion.div>

            <motion.button
                className="btn-primary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onNext}
                style={{ width: '100%', gap: '8px' }}
            >
                Let's Go <ArrowRight size={18} />
            </motion.button>
        </div>
    );
}
