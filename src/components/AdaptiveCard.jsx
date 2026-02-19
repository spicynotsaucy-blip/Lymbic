/**
 * AdaptiveCard — A self-aware card component that responds to attention and emotion
 * @module AdaptiveCard
 */
import { useRef, useState } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { useAdaptiveUI } from '../hooks/useAdaptiveUI';

export default function AdaptiveCard({
    children,
    className = '',
    style = {},
    onClick,
    layoutId,
    testId,
}) {
    const { motion: motionPresets, expression, canUseGlassmorphism, canUseParticles, shouldReduceMotion } = useAdaptiveUI();
    const cardRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);

    // Mouse tracking for glow effect
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const handleMouseMove = ({ clientX, clientY, currentTarget }) => {
        if (shouldReduceMotion) return;
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    };

    const glowBackground = useMotionTemplate`radial-gradient(
    600px circle at ${mouseX}px ${mouseY}px,
    var(--surface-glass-border),
    transparent 40%
  )`;

    const baseStyle = {
        background: canUseGlassmorphism ? 'var(--surface-glass)' : 'var(--surface-card)',
        backdropFilter: canUseGlassmorphism ? `blur(${expression.blurAmount}px)` : 'none',
        border: '1px solid var(--surface-glass-border)',
        borderRadius: 'var(--radius-lg)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
    };

    return (
        <motion.div
            ref={cardRef}
            className={`adaptive-card ${className}`}
            style={baseStyle}
            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={motionPresets.cardHover}
            whileTap={motionPresets.cardPress}
            layoutId={layoutId}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            data-testid={testId}
        >
            {/* Dynamic Glow Effect */}
            {!shouldReduceMotion && (
                <motion.div
                    className="glow-overlay"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: glowBackground,
                        opacity: isHovered ? expression.glowIntensity : 0,
                        transition: 'opacity 0.3s ease',
                        pointerEvents: 'none',
                        zIndex: 1,
                    }}
                />
            )}

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 2 }}>
                {children}
            </div>

            {/* Particle Effects (for high-tier devices) */}
            {canUseParticles && isHovered && expression.particleDensity > 0 && (
                <ParticleEmitter density={expression.particleDensity} hue={expression.primaryHue} />
            )}
        </motion.div>
    );
}

// Simple particle system for high-end devices
function ParticleEmitter({ density, hue }) {
    // Limit max particles for performance safety
    const count = Math.min(density, 20);
    const particles = Array.from({ length: count });

    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            {particles.map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        x: Math.random() * 100 + '%',
                        y: Math.random() * 100 + '%',
                        opacity: 0,
                        scale: 0,
                    }}
                    animate={{
                        y: [null, Math.random() * -100],
                        opacity: [0, 0.5, 0],
                        scale: [0, 1.5, 0],
                    }}
                    transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 2,
                        ease: 'easeOut',
                    }}
                    style={{
                        position: 'absolute',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: `hsl(${hue}, 80%, 70%)`,
                        boxShadow: `0 0 10px hsl(${hue}, 80%, 70%)`,
                    }}
                />
            ))}
        </div>
    );
}
