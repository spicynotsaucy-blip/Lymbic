/**
 * AdaptiveButton — A button that ripples and responds to emotional state
 * @module AdaptiveButton
 */
import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdaptiveUI } from '../hooks/useAdaptiveUI';
import { predictiveInteraction } from '../lib/predictiveInteraction';

export default function AdaptiveButton({
    children,
    variant = 'primary', // primary, secondary, ghost
    className = '',
    style = {},
    onClick,
    disabled = false,
    icon: Icon,
    testId,
}) {
    const { motion: motionPresets, expression, canUseParticles, shouldReduceMotion } = useAdaptiveUI();
    const btnRef = useRef(null);
    const [isPredicting, setIsPredicting] = useState(false);

    useEffect(() => {
        if (!btnRef.current || disabled) return;

        const id = `btn-${Math.random().toString(36).substr(2, 9)}`;
        const unregister = predictiveInteraction.track(id, btnRef.current, {
            onPreAnimate: () => {
                if (!disabled) setIsPredicting(true);
            }
        });

        return () => unregister();
    }, [disabled]);

    // Reset prediction state on hover/leave
    const handleHoverEnd = () => setIsPredicting(false);

    // Dynamic styles based on variant and emotion
    const getVariantStyles = () => {
        const base = {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-sm)',
            padding: 'var(--space-md) var(--space-xl)',
            borderRadius: 'var(--radius-full)',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            position: 'relative',
            overflow: 'hidden',
            border: 'none',
            outline: 'none',
            ...style,
        };

        if (variant === 'primary') {
            return {
                ...base,
                background: `linear-gradient(135deg, hsl(${expression.primaryHue}, ${expression.saturation}%, 60%), hsl(${expression.primaryHue}, ${expression.saturation}%, 40%))`,
                color: 'white',
                boxShadow: `0 4px 20px hsla(${expression.primaryHue}, ${expression.saturation}%, 60%, 0.4)`,
            };
        }

        if (variant === 'secondary') {
            return {
                ...base,
                background: 'transparent',
                border: `1px solid hsla(${expression.primaryHue}, 30%, 50%, 0.3)`,
                color: `hsl(${expression.primaryHue}, 20%, 80%)`,
            };
        }

        // Ghost
        return {
            ...base,
            background: 'transparent',
            color: `hsl(${expression.primaryHue}, 20%, 80%)`,
            padding: 'var(--space-sm) var(--space-md)',
        };
    };

    const hoverAnim = disabled ? {} : {
        ...motionPresets.buttonHover,
        scale: isPredicting ? 1.05 : motionPresets.buttonHover.scale || 1.02
    };

    return (
        <motion.button
            ref={btnRef}
            className={`adaptive-btn ${className}`}
            style={getVariantStyles()}
            whileHover={hoverAnim}
            whileTap={!disabled ? motionPresets.buttonPress : {}}
            onHoverEnd={handleHoverEnd}
            animate={isPredicting ? {
                scale: 1.02,
                boxShadow: `0 0 15px hsla(${expression.primaryHue}, 80%, 60%, 0.3)`
            } : {}}
            onClick={onClick}
            disabled={disabled}
            data-testid={testId}
        >
            {/* Background Ripple on Hover (if particles enabled) */}
            {!disabled && !shouldReduceMotion && canUseParticles && variant === 'primary' && (
                <motion.div
                    className="btn-shimmer"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        width: '200%',
                        x: '-100%',
                    }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
                />
            )}

            {Icon && <Icon size={20} />}
            <span style={{ position: 'relative', zIndex: 2 }}>{children}</span>
        </motion.button>
    );
}
