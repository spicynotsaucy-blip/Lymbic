import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * ScanAnimation — The "Intelligence Line" overlay.
 *
 * Designed to work on top of a live camera feed or frozen frame.
 * Uses generic scan zones rather than specific worksheet coordinates,
 * so it works regardless of what the camera is pointing at.
 */
export default function ScanAnimation({ onComplete }) {
    const [scanProgress, setScanProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [nameBlurred, setNameBlurred] = useState(false);
    const [activeZones, setActiveZones] = useState([]);

    const SCAN_DURATION = 5000;

    // Generic detection zones — these are positioned as percentages and will
    // visually overlay on any worksheet captured by the camera
    const DETECTION_ZONES = [
        { y: 8, type: 'name', left: '5%', width: '40%', height: '5%' },
        { y: 28, type: 'scratch', left: '55%', width: '35%', height: '12%' },
        { y: 48, type: 'scratch', left: '8%', width: '42%', height: '8%' },
        { y: 68, type: 'error', left: '10%', width: '50%', height: '6%' },
        { y: 82, type: 'answer', left: '8%', width: '45%', height: '6%' },
    ];

    useEffect(() => {
        const startTime = Date.now();

        const statusMessages = [
            { at: 5, msg: 'Detecting document structure...' },
            { at: 10, msg: 'Identifying name region...' },
            { at: 15, msg: '🔒 Anonymizing student identity...' },
            { at: 25, msg: 'Reading problem statement...' },
            { at: 35, msg: 'Tracing main solution path...' },
            { at: 45, msg: 'Analyzing scratchpad work...' },
            { at: 55, msg: 'Detecting reasoning divergence...' },
            { at: 65, msg: '⚡ Sign error detected at Step 3...' },
            { at: 75, msg: 'Mapping logic trace to answer key...' },
            { at: 85, msg: 'Generating feedback...' },
            { at: 95, msg: 'Finalizing digital twin...' },
        ];

        let statusIndex = 0;

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min((elapsed / SCAN_DURATION) * 100, 100);
            setScanProgress(progress);

            // Advance status messages
            while (statusIndex < statusMessages.length && progress >= statusMessages[statusIndex].at) {
                setStatusText(statusMessages[statusIndex].msg);
                statusIndex++;
            }

            // Trigger name blur
            if (progress >= 12 && !nameBlurred) {
                setNameBlurred(true);
            }

            // Activate detection zones as the line passes them
            const newZones = [];
            DETECTION_ZONES.forEach((zone, i) => {
                if (progress >= zone.y && zone.type !== 'name') {
                    newZones.push(i);
                }
            });
            setActiveZones(newZones);

            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(onComplete, 500);
            }
        }, 30);

        return () => clearInterval(interval);
    }, [onComplete]);

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 8 }}>
            {/* ── Scanning Line ── */}
            <motion.div
                style={{
                    position: 'absolute', left: 0, right: 0, top: `${scanProgress}%`,
                    height: '3px',
                    background: 'linear-gradient(90deg, transparent, var(--lymbic-purple), var(--lymbic-purple-light), var(--lymbic-purple), transparent)',
                    boxShadow: '0 0 20px var(--lymbic-purple-glow), 0 0 40px rgba(124, 58, 237, 0.2)',
                    zIndex: 10,
                }}
            />

            {/* ── Glow area above the scan line ── */}
            <div style={{
                position: 'absolute', left: 0, right: 0, top: 0, height: `${scanProgress}%`,
                background: 'rgba(124, 58, 237, 0.06)',
                transition: 'height 0.03s linear',
            }} />

            {/* ── Name Anonymization Blur ── */}
            {nameBlurred && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    style={{
                        position: 'absolute',
                        top: `${DETECTION_ZONES[0].y}%`,
                        left: DETECTION_ZONES[0].left,
                        width: DETECTION_ZONES[0].width,
                        height: DETECTION_ZONES[0].height,
                        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                        background: 'rgba(124, 58, 237, 0.2)',
                        borderRadius: '6px',
                        border: '1.5px solid rgba(124, 58, 237, 0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <span style={{
                        fontSize: '0.6rem', fontWeight: 700, color: 'var(--lymbic-purple-light)',
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                    }}>
                        🔒 ANONYMIZED
                    </span>
                </motion.div>
            )}

            {/* ── Detection Zone Highlights ── */}
            {activeZones.map((idx) => {
                const zone = DETECTION_ZONES[idx];
                const isError = zone.type === 'answer' || zone.type === 'error';
                return (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            position: 'absolute',
                            top: `${zone.y}%`,
                            left: zone.left,
                            width: zone.width,
                            height: zone.height,
                            borderRadius: '6px',
                            border: `1.5px solid ${isError ? 'rgba(239, 68, 68, 0.6)' : 'rgba(52, 211, 153, 0.5)'}`,
                            background: isError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(52, 211, 153, 0.08)',
                            boxShadow: isError
                                ? '0 0 16px rgba(239, 68, 68, 0.2), inset 0 0 8px rgba(239, 68, 68, 0.05)'
                                : '0 0 16px rgba(52, 211, 153, 0.15), inset 0 0 8px rgba(52, 211, 153, 0.03)',
                        }}
                    />
                );
            })}

            {/* ── Status Text Toast ── */}
            {statusText && (
                <motion.div
                    key={statusText}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        position: 'absolute', bottom: 16, left: 16, right: 16,
                        padding: '10px 14px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                        borderRadius: '10px',
                        border: '1px solid rgba(124, 58, 237, 0.2)',
                        display: 'flex', alignItems: 'center', gap: '10px',
                    }}
                >
                    <div style={{
                        width: 7, height: 7, borderRadius: '50%', background: 'var(--lymbic-purple)',
                        boxShadow: '0 0 10px var(--lymbic-purple-glow)',
                        animation: 'pulse-glow 1.5s ease-in-out infinite',
                        flexShrink: 0,
                    }} />
                    <span style={{
                        color: 'rgba(255,255,255,0.9)', fontSize: '0.72rem', fontWeight: 500,
                        fontFamily: "'Inter', monospace",
                    }}>
                        {statusText}
                    </span>
                </motion.div>
            )}
        </div>
    );
}
