/**
 * SplashScreen — Premium first impression with animated logo and particles
 * @module SplashScreen
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

// Floating particle data — generated once outside component
const PARTICLE_COUNT = 24;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 3,
    duration: 8 + Math.random() * 12,
    delay: Math.random() * 5,
    dx: (Math.random() - 0.5) * 60,
    dy: (Math.random() - 0.5) * 60,
    opacity: 0.15 + Math.random() * 0.25,
}));

const tagline = 'Grading, reimagined.';

export default function SplashScreen() {
    const navigate = useNavigate();
    const [typedText, setTypedText] = useState('');
    const [showCursor, setShowCursor] = useState(true);
    const typingDone = useRef(false);

    // Typing effect for the tagline
    useEffect(() => {
        let i = 0;
        const timer = setTimeout(() => {
            const interval = setInterval(() => {
                i++;
                setTypedText(tagline.slice(0, i));
                if (i >= tagline.length) {
                    clearInterval(interval);
                    typingDone.current = true;
                    // Blink cursor then hide
                    setTimeout(() => setShowCursor(false), 1200);
                }
            }, 65);
            return () => clearInterval(interval);
        }, 1400);
        return () => clearTimeout(timer);
    }, []);

    return (
        <motion.div
            className="screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.6 }}
            style={{ justifyContent: 'center', gap: '48px', overflow: 'hidden' }}
        >
            {/* Ambient Particles */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                {PARTICLES.map((p) => (
                    <motion.div
                        key={p.id}
                        initial={{
                            x: `${p.x}vw`,
                            y: `${p.y}vh`,
                            opacity: 0,
                            scale: 0,
                        }}
                        animate={{
                            x: [`${p.x}vw`, `${p.x + p.dx}vw`],
                            y: [`${p.y}vh`, `${p.y + p.dy}vh`],
                            opacity: [0, p.opacity, 0],
                            scale: [0, 1, 0],
                        }}
                        transition={{
                            duration: p.duration,
                            delay: p.delay,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                        style={{
                            position: 'absolute',
                            width: p.size,
                            height: p.size,
                            borderRadius: '50%',
                            background: p.id % 3 === 0
                                ? 'var(--lymbic-purple-light)'
                                : p.id % 3 === 1
                                    ? 'var(--accent-cyan)'
                                    : 'var(--logic-green)',
                            boxShadow: `0 0 ${p.size * 3}px currentColor`,
                        }}
                    />
                ))}
            </div>

            <div className="screen-content" style={{ alignItems: 'center', textAlign: 'center', gap: '48px', position: 'relative', zIndex: 1 }}>
                {/* Animated Logo */}
                <motion.div
                    initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}
                >
                    {/* Logo container with breathing effect */}
                    <div style={{ position: 'relative' }}>
                        {/* Outer ring 1 */}
                        <motion.div
                            animate={{
                                scale: [1, 1.15, 1],
                                opacity: [0.2, 0.05, 0.2],
                            }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            style={{
                                position: 'absolute',
                                inset: -20,
                                borderRadius: '36px',
                                border: '1px solid var(--lymbic-purple-light)',
                            }}
                        />
                        {/* Outer ring 2 */}
                        <motion.div
                            animate={{
                                scale: [1, 1.25, 1],
                                opacity: [0.15, 0.02, 0.15],
                            }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                            style={{
                                position: 'absolute',
                                inset: -36,
                                borderRadius: '44px',
                                border: '1px solid var(--accent-cyan)',
                            }}
                        />

                        {/* Main logo */}
                        <motion.div
                            animate={{
                                boxShadow: [
                                    '0 0 30px rgba(124, 58, 237, 0.3), 0 0 60px rgba(124, 58, 237, 0.1)',
                                    '0 0 50px rgba(124, 58, 237, 0.5), 0 0 100px rgba(124, 58, 237, 0.2)',
                                    '0 0 30px rgba(124, 58, 237, 0.3), 0 0 60px rgba(124, 58, 237, 0.1)',
                                ],
                            }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                            style={{
                                width: 96,
                                height: 96,
                                borderRadius: '28px',
                                background: 'linear-gradient(135deg, var(--lymbic-purple), var(--lymbic-purple-deep))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                            }}
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                                style={{
                                    position: 'absolute',
                                    inset: -2,
                                    borderRadius: '30px',
                                    background: 'conic-gradient(from 0deg, transparent, var(--lymbic-purple-light), transparent, var(--accent-cyan), transparent)',
                                    opacity: 0.3,
                                }}
                            />
                            <Sparkles size={44} color="white" strokeWidth={1.5} style={{ position: 'relative', zIndex: 1 }} />
                        </motion.div>
                    </div>

                    {/* Brand name */}
                    <motion.h1
                        className="text-hero"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.8 }}
                        style={{ fontSize: '3.2rem', letterSpacing: '-0.04em' }}
                    >
                        <span className="text-gradient-animated">Lymbic</span>
                    </motion.h1>
                </motion.div>

                {/* Typing Tagline */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2, duration: 0.5 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '80px' }}
                >
                    <p className="text-heading" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {typedText}
                        {showCursor && (
                            <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                                style={{ color: 'var(--lymbic-purple-light)', marginLeft: '2px' }}
                            >
                                |
                            </motion.span>
                        )}
                    </p>
                    <motion.p
                        className="text-body"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 3.2, duration: 0.6 }}
                        style={{ color: 'var(--text-muted)', maxWidth: '320px' }}
                    >
                        AI that reads how your students think — not just what they write.
                    </motion.p>
                </motion.div>

                {/* CTA */}
                <motion.button
                    className="btn-primary"
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 3.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.06, boxShadow: '0 8px 40px var(--lymbic-purple-glow)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/onboarding')}
                    style={{ padding: '18px 56px', fontSize: '1.1rem', fontWeight: 600 }}
                >
                    Get Started
                </motion.button>

                <motion.p
                    className="text-small"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 4, duration: 0.5 }}
                    style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}
                >
                    Trusted by educators worldwide
                </motion.p>
            </div>
        </motion.div>
    );
}
