import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function SplashScreen() {
    const navigate = useNavigate();

    return (
        <motion.div
            className="screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            style={{ justifyContent: 'center', gap: '48px' }}
        >
            <div className="screen-content" style={{ alignItems: 'center', textAlign: 'center', gap: '40px' }}>
                {/* Logo */}
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
                >
                    <motion.div
                        className="animate-pulse-glow"
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
                        <Sparkles size={44} color="white" strokeWidth={1.5} />
                        <div style={{
                            position: 'absolute',
                            inset: -4,
                            borderRadius: '32px',
                            border: '2px solid rgba(124, 58, 237, 0.3)',
                            animation: 'pulse-glow 3s ease-in-out infinite',
                        }} />
                    </motion.div>

                    <motion.h1
                        className="text-hero"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        style={{ fontSize: '3rem', letterSpacing: '-0.04em' }}
                    >
                        <span className="text-gradient">Lymbic</span>
                    </motion.h1>
                </motion.div>

                {/* Tagline */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 0.6 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                    <p className="text-heading" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        Grading, reimagined.
                    </p>
                    <p className="text-body" style={{ color: 'var(--text-muted)', maxWidth: '320px' }}>
                        AI that reads how your students think — not just what they write.
                    </p>
                </motion.div>

                {/* CTA */}
                <motion.button
                    className="btn-primary"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1, duration: 0.5 }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/onboarding')}
                    style={{ padding: '16px 48px', fontSize: '1.1rem' }}
                >
                    Get Started
                </motion.button>

                <motion.p
                    className="text-small"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.4, duration: 0.5 }}
                    style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}
                >
                    Trusted by educators worldwide
                </motion.p>
            </div>
        </motion.div>
    );
}
