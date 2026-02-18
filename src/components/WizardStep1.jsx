import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../context/OnboardingContext';
import { Sparkles } from 'lucide-react';

export default function WizardStep1({ onNext }) {
    const { data, updateData } = useOnboarding();
    const [name, setName] = useState(data.teacherName);
    const inputRef = useRef(null);

    useEffect(() => {
        const timer = setTimeout(() => inputRef.current?.focus(), 600);
        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim()) {
            updateData({ teacherName: name.trim() });
            onNext();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Lymbic avatar */}
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

            {/* Chat bubble */}
            <div className="chat-bubble chat-bubble-ai">
                <p style={{ marginBottom: '8px' }}>
                    Hey there! 👋 I'm <strong style={{ color: 'var(--lymbic-purple-light)' }}>Lymbic</strong>.
                </p>
                <p style={{ marginBottom: '8px' }}>
                    I'm here to take that grading pile off your plate so you can actually enjoy your evening.
                </p>
                <p>
                    Before we start — <strong>what should I call you?</strong>
                </p>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input
                    ref={inputRef}
                    type="text"
                    className="input-field"
                    placeholder="Your name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                />
                <motion.button
                    type="submit"
                    className="btn-primary"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                        opacity: name.trim() ? 1 : 0.4,
                        pointerEvents: name.trim() ? 'auto' : 'none',
                        width: '100%',
                    }}
                >
                    Continue
                </motion.button>
            </form>
        </div>
    );
}
