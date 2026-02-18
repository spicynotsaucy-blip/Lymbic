import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '../context/OnboardingContext';
import { Sparkles, Wand2 } from 'lucide-react';

const PRESETS = [
    'Math', 'Physics', 'English', 'History',
    'Chemistry', 'Biology', 'Art', 'Law',
    'Economics', 'Computer Science',
];

export default function WizardStep2({ onNext }) {
    const { data, updateData } = useOnboarding();
    const [selected, setSelected] = useState(data.subject);
    const [custom, setCustom] = useState('');
    const [filteredPresets, setFilteredPresets] = useState(PRESETS);
    const inputRef = useRef(null);

    // Filter presets as the user types
    useEffect(() => {
        if (!custom.trim()) {
            setFilteredPresets(PRESETS);
            return;
        }
        const q = custom.toLowerCase();
        const matches = PRESETS.filter(p => p.toLowerCase().includes(q));
        setFilteredPresets(matches);
        // If they typed something that exactly matches a preset, auto-select it
        const exact = PRESETS.find(p => p.toLowerCase() === q);
        if (exact) {
            setSelected(exact);
        } else {
            setSelected(''); // clear chip selection when typing custom
        }
    }, [custom]);

    const handlePresetClick = (preset) => {
        setSelected(preset);
        setCustom('');
        updateData({ subject: preset });
        onNext();
    };

    const handleCustomSubmit = () => {
        const value = custom.trim();
        if (value) {
            updateData({ subject: value });
            onNext();
        }
    };

    const handleAutoDetect = () => {
        updateData({ subject: 'General' });
        onNext();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
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
                    Nice to meet you, <strong style={{ color: 'var(--lymbic-purple-light)' }}>{data.teacherName || 'there'}</strong>! 🎓
                </p>
                <p>
                    To tune my brain — <strong>what are we grading today?</strong> Pick a preset or type anything.
                </p>
            </div>

            {/* Preset chips — filtered by search */}
            <AnimatePresence mode="popLayout">
                <div className="chip-grid" style={{ minHeight: 40 }}>
                    {filteredPresets.map((p) => (
                        <motion.button
                            key={p}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                            className={`chip ${selected === p ? 'active' : ''}`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handlePresetClick(p)}
                        >
                            {p}
                        </motion.button>
                    ))}

                    {/* Show "no presets match" if filtering produced zero */}
                    {filteredPresets.length === 0 && custom.trim() && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '4px 0' }}
                        >
                            No preset for that — no problem! 👇
                        </motion.p>
                    )}
                </div>
            </AnimatePresence>

            {/* Custom input — the "Omni-Input" */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                    ref={inputRef}
                    type="text"
                    className="input-field"
                    placeholder='Or type anything — "Creative Writing," "Law," "Theology"...'
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit(); }}
                    autoComplete="off"
                />

                {/* Dynamic CTA when they've typed a custom subject */}
                <AnimatePresence>
                    {custom.trim() && !PRESETS.find(p => p.toLowerCase() === custom.trim().toLowerCase()) && (
                        <motion.button
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="btn-primary"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleCustomSubmit}
                            style={{ width: '100%', overflow: 'hidden' }}
                        >
                            Use "<strong>{custom.trim()}</strong>"
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* "Let Lymbic figure it out" escape hatch */}
            <motion.button
                className="btn-secondary"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleAutoDetect}
                style={{ width: '100%', gap: '8px', fontSize: '0.9rem' }}
            >
                <Wand2 size={16} /> Not sure — let Lymbic detect it
            </motion.button>
        </div>
    );
}
