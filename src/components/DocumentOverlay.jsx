// ═══════════════════════════════════════════════════════════
//  DocumentOverlay — Live quad outline + alignment guides
// ═══════════════════════════════════════════════════════════
import { motion, AnimatePresence } from 'framer-motion';
import { Scan } from 'lucide-react';

const GUIDE_MESSAGES = {
    searching: 'Looking for document…',
    too_far: 'Move closer to the page',
    too_close: 'Move back a little',
    off_center: 'Center the document',
    tilted: 'Hold camera straight',
    ready: 'Perfect — hold steady…',
};

/**
 * @param {{ detected, quad, confidence, isStable, scale, alignmentState }} detection
 * @param {number} videoWidth  — natural videoWidth of the stream
 * @param {number} videoHeight — natural videoHeight of the stream
 */
export default function DocumentOverlay({ detection, videoWidth, videoHeight }) {
    const { detected, quad, confidence, isStable, scale, alignmentState } = detection;

    // Upscale corners back to full frame size
    const upscaled = quad
        ? quad.map(c => ({ x: c.x / scale, y: c.y / scale }))
        : null;

    const isReady = alignmentState === 'ready' && isStable;
    const borderColor = isReady ? '#22c55e' : detected ? '#a855f7' : '#6b7280';

    return (
        <>
            {/* ─── SVG quad outline ─── */}
            <AnimatePresence>
                {detected && upscaled && (
                    <motion.svg
                        key="quad"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            pointerEvents: 'none', zIndex: 5,
                        }}
                        viewBox={`0 0 ${videoWidth || 1920} ${videoHeight || 1080}`}
                        preserveAspectRatio="xMidYMid slice"
                    >
                        {/* Quad border */}
                        <polygon
                            points={upscaled.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke={borderColor}
                            strokeWidth={isReady ? 4 : 3}
                            strokeLinejoin="round"
                            style={{ transition: 'stroke 0.3s ease' }}
                        />

                        {/* Corner markers */}
                        {upscaled.map((c, i) => (
                            <circle
                                key={i}
                                cx={c.x}
                                cy={c.y}
                                r={isReady ? 10 : 7}
                                fill={borderColor}
                                style={{ transition: 'fill 0.3s ease, r 0.3s ease' }}
                            />
                        ))}
                    </motion.svg>
                )}
            </AnimatePresence>

            {/* ─── Guide message pill ─── */}
            <div style={{
                position: 'absolute', bottom: 110, left: 0, right: 0,
                display: 'flex', justifyContent: 'center', zIndex: 8,
                pointerEvents: 'none',
            }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={alignmentState + (isStable ? '-s' : '')}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            padding: '8px 18px',
                            borderRadius: 999,
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: isReady
                                ? 'rgba(34, 197, 94, 0.85)'
                                : 'rgba(0, 0, 0, 0.6)',
                            color: 'white',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            boxShadow: isReady
                                ? '0 0 16px rgba(34, 197, 94, 0.4)'
                                : 'none',
                            transition: 'background 0.3s ease, box-shadow 0.3s ease',
                        }}
                    >
                        <Scan size={14} />
                        {GUIDE_MESSAGES[alignmentState] || GUIDE_MESSAGES.searching}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ─── Confidence ring (top-right) ─── */}
            <div style={{
                position: 'absolute', top: 60, right: 16, zIndex: 8,
                width: 40, height: 40, pointerEvents: 'none',
            }}>
                <svg viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                    <circle
                        cx="20" cy="20" r="16" fill="none"
                        stroke={isReady ? '#22c55e' : '#a855f7'}
                        strokeWidth="3"
                        strokeDasharray={`${confidence * 100.5} 100.5`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.3s ease, stroke 0.3s ease' }}
                    />
                </svg>
            </div>
        </>
    );
}
