import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../context/OnboardingContext';
import { Sparkles, Zap, Search } from 'lucide-react';

export default function WizardStep3({ onNext }) {
    const { data, updateData } = useOnboarding();
    const [selected, setSelected] = useState(data.intent);

    const handleSelect = (intent) => {
        setSelected(intent);
        updateData({ intent });
        setTimeout(onNext, 400);
    };

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
                    Got it — <strong style={{ color: 'var(--lymbic-purple-light)' }}>{data.subject}</strong>. 📚
                </p>
                <p>
                    What's the biggest headache with this batch? Are you looking for a <strong>quick grade</strong>, or do you want me to find exactly <strong>where students are getting stuck</strong>?
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect('quick')}
                    className="glass-card-elevated"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left',
                        border: selected === 'quick' ? '2px solid var(--lymbic-purple)' : '1px solid rgba(124, 58, 237, 0.2)',
                        transition: 'all 0.25s ease',
                    }}
                >
                    <div style={{
                        width: 52, height: 52, borderRadius: 16,
                        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.05))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <Zap size={24} color="#FBBF24" />
                    </div>
                    <div>
                        <p style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '4px' }}>Quick Grade</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                            Get scores fast. I'll check answers against the key and hand you the results.
                        </p>
                    </div>
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect('deep')}
                    className="glass-card-elevated"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left',
                        border: selected === 'deep' ? '2px solid var(--logic-green)' : '1px solid rgba(124, 58, 237, 0.2)',
                        transition: 'all 0.25s ease',
                    }}
                >
                    <div style={{
                        width: 52, height: 52, borderRadius: 16,
                        background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(52, 211, 153, 0.05))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <Search size={24} color="#34D399" />
                    </div>
                    <div>
                        <p style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '4px' }}>Find Where They're Stuck</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                            Deep analysis. I'll trace every student's logic and pinpoint where their reasoning breaks.
                        </p>
                    </div>
                </motion.button>
            </div>
        </div>
    );
}
