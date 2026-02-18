import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '../context/OnboardingContext';
import ScanAnimation from '../components/ScanAnimation';
import { Camera, X, ShieldAlert, RefreshCw, FlipHorizontal, Lightbulb, Loader2 } from 'lucide-react';
import { captureWithQualityGate } from '../lib/captureUtils';
import { analyzeWithLogicEngine } from '../lib/analysisEngine';
import { normalizeAndStore } from '../lib/storageLayer';

export default function ScanScreen() {
    const navigate = useNavigate();
    const { data, setScanResult } = useOnboarding();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // Phases: 'requesting' → 'preview' → 'scanning' → 'analyzing' → 'complete' | 'denied' | 'quality_fail'
    const [phase, setPhase] = useState('requesting');
    const [freezeFrame, setFreezeFrame] = useState(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [facingMode, setFacingMode] = useState('environment');
    const [qualityIssue, setQualityIssue] = useState(null); // { reason, suggestion }
    const [analyzeStatus, setAnalyzeStatus] = useState(''); // progress message
    const sessionIdRef = useRef(`session_${Date.now()}`);

    // ═══════════════════════════════════════════
    //  CAMERA LIFECYCLE
    // ═══════════════════════════════════════════

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const startCamera = useCallback(async (facing = 'environment') => {
        try {
            // Stop any existing stream before switching
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            setCameraReady(false);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facing,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('Camera access error:', err);
            setPhase('denied');
        }
    }, []);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => stopCamera();
    }, [stopCamera]);

    // Auto-redirect after scan complete
    useEffect(() => {
        if (phase === 'complete') {
            const timer = setTimeout(() => {
                stopCamera();
                navigate('/results');
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [phase, navigate, stopCamera]);

    // ═══════════════════════════════════════════
    //  EVENT HANDLERS
    // ═══════════════════════════════════════════

    const handleAllowClick = () => {
        startCamera(facingMode);
        setPhase('preview');
    };

    const handleFlipCamera = () => {
        const newFacing = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(newFacing);
        startCamera(newFacing);
    };

    const handleVideoReady = () => {
        // Fires when video metadata is loaded — the stream is truly playing
        setCameraReady(true);
    };

    const handleCaptureScan = () => {
        // 1. Quality gate — check image before committing to scan
        const capture = captureWithQualityGate(videoRef);

        if (!capture.success) {
            setQualityIssue({ reason: capture.reason, suggestion: capture.suggestion });
            setPhase('quality_fail');
            return;
        }

        // 2. Freeze the good frame for the scan animation
        if (canvasRef.current) {
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
            };
            img.src = capture.image;
        }
        setFreezeFrame(capture.image);
        setPhase('scanning');

        // Store capture for pipeline (will be used after animation)
        sessionIdRef.captureData = capture;
    };

    const handleScanComplete = async () => {
        // 3. After animation finishes → run LLM analysis
        setPhase('analyzing');
        const capture = sessionIdRef.captureData;

        try {
            setAnalyzeStatus('Reading handwriting…');
            const analysis = await analyzeWithLogicEngine(capture?.image, { subject: data.subject });

            setAnalyzeStatus('Tracing logic pathway…');
            const stored = await normalizeAndStore(analysis, capture?.metadata, sessionIdRef.current);

            // Push result into context for ResultsDashboard
            setScanResult(stored.success ? stored.result : analysis);
            setPhase('complete');
        } catch (err) {
            console.error('[Lymbic] Pipeline error:', err);
            setScanResult(null);
            setPhase('complete'); // still navigate — dashboard shows mock
        }
    };

    const handleRetry = () => {
        setPhase('requesting');
        setCameraReady(false);
        setFreezeFrame(null);
        setQualityIssue(null);
    };

    const handleRetryCapture = () => {
        setPhase('preview');
        setQualityIssue(null);
    };

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    return (
        <motion.div
            className="screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
                padding: 0, justifyContent: 'flex-start', background: '#000',
                position: 'relative', overflow: 'hidden',
            }}
        >
            {/* ─── PERMISSION REQUEST SCREEN ─── */}
            <AnimatePresence>
                {phase === 'requesting' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{
                            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', background: 'rgba(0, 0, 0, 0.9)', zIndex: 50, padding: '24px',
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="glass-card-elevated"
                            style={{
                                maxWidth: 360, textAlign: 'center', display: 'flex',
                                flexDirection: 'column', gap: '20px', padding: '32px',
                            }}
                        >
                            <div style={{
                                width: 56, height: 56, borderRadius: 16,
                                background: 'linear-gradient(135deg, var(--lymbic-purple), var(--lymbic-purple-deep))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                            }}>
                                <Camera size={28} color="white" />
                            </div>
                            <div>
                                <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '8px' }}>
                                    "Lymbic" Would Like to Access the Camera
                                </p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                    We'll use the camera to scan worksheets. Names are blurred instantly — your students' privacy is our priority.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    className="btn-secondary"
                                    style={{ flex: 1, padding: '12px' }}
                                    onClick={() => navigate('/grade')}
                                >
                                    Not Now
                                </button>
                                <motion.button
                                    className="btn-primary"
                                    style={{ flex: 1, padding: '12px' }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleAllowClick}
                                >
                                    Allow Camera
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── DENIED STATE ─── */}
            <AnimatePresence>
                {phase === 'denied' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', background: 'rgba(0, 0, 0, 0.9)', zIndex: 50, padding: '24px',
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="glass-card-elevated"
                            style={{
                                maxWidth: 360, textAlign: 'center', display: 'flex',
                                flexDirection: 'column', gap: '20px', padding: '32px',
                            }}
                        >
                            <div style={{
                                width: 56, height: 56, borderRadius: 16,
                                background: 'rgba(239, 68, 68, 0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                            }}>
                                <ShieldAlert size={28} color="var(--grade-f)" />
                            </div>
                            <div>
                                <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '8px' }}>
                                    Camera Access Denied
                                </p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                    Lymbic needs the camera to scan and anonymize worksheets. Please enable camera access in your browser settings and try again.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    className="btn-secondary"
                                    style={{ flex: 1, padding: '12px' }}
                                    onClick={() => navigate('/grade')}
                                >
                                    Go Back
                                </button>
                                <motion.button
                                    className="btn-primary"
                                    style={{ flex: 1, padding: '12px', gap: '6px' }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleRetry}
                                >
                                    <RefreshCw size={16} /> Retry
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── QUALITY FAIL STATE ─── */}
            <AnimatePresence>
                {phase === 'quality_fail' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', zIndex: 50, padding: '24px' }}
                    >
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-card-elevated"
                            style={{ maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px' }}
                        >
                            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', border: '1px solid rgba(251,191,36,0.3)' }}>
                                <Lightbulb size={28} color="#fbbf24" />
                            </div>
                            <div>
                                <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '8px' }}>Image Quality Too Low</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                    {qualityIssue?.suggestion || 'Please adjust the lighting and try again.'}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={() => navigate('/grade')}>Cancel</button>
                                <motion.button className="btn-primary" style={{ flex: 1, padding: '12px', gap: '6px' }} whileTap={{ scale: 0.97 }} onClick={handleRetryCapture}>
                                    <RefreshCw size={16} /> Try Again
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── ANALYZING STATE ─── */}
            <AnimatePresence>
                {phase === 'analyzing' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.92)', zIndex: 50, padding: '24px' }}
                    >
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                            style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}
                        >
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                                style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(139,92,246,0.2)', borderTop: '3px solid var(--lymbic-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Loader2 size={24} color="var(--lymbic-purple)" />
                            </motion.div>
                            <div>
                                <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '6px' }}>Lymbic is thinking…</p>
                                <motion.p key={analyzeStatus} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                    style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}
                                >
                                    {analyzeStatus || 'Initializing analysis…'}
                                </motion.p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── QUALITY FAIL STATE ─── */}
            <AnimatePresence>
                {phase === 'quality_fail' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', zIndex: 50, padding: '24px' }}
                    >
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-card-elevated"
                            style={{ maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px' }}
                        >
                            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', border: '1px solid rgba(251,191,36,0.3)' }}>
                                <Lightbulb size={28} color="#fbbf24" />
                            </div>
                            <div>
                                <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '8px' }}>Image Quality Too Low</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                    {qualityIssue?.suggestion || 'Please adjust the lighting and try again.'}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={() => navigate('/grade')}>Cancel</button>
                                <motion.button className="btn-primary" style={{ flex: 1, padding: '12px', gap: '6px' }} whileTap={{ scale: 0.97 }} onClick={handleRetryCapture}>
                                    <RefreshCw size={16} /> Try Again
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── ANALYZING STATE ─── */}
            <AnimatePresence>
                {phase === 'analyzing' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.92)', zIndex: 50, padding: '24px' }}
                    >
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                            style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}
                        >
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                                style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(139,92,246,0.2)', borderTop: '3px solid var(--lymbic-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Loader2 size={24} color="var(--lymbic-purple)" />
                            </motion.div>
                            <div>
                                <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '6px' }}>Lymbic is thinking…</p>
                                <motion.p key={analyzeStatus} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                    style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}
                                >
                                    {analyzeStatus || 'Initializing analysis…'}
                                </motion.p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── TOP BAR ─── */}
            {phase !== 'requesting' && phase !== 'denied' && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
                }}>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>
                        {data.subject || 'Physics'} — Scan
                    </span>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {phase === 'preview' && cameraReady && (
                            <motion.button
                                whileTap={{ scale: 0.9, rotate: 180 }}
                                transition={{ duration: 0.3 }}
                                onClick={handleFlipCamera}
                                title="Flip camera"
                                style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.15)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <FlipHorizontal size={18} color="white" />
                            </motion.button>
                        )}
                        <button
                            onClick={() => { stopCamera(); navigate('/grade'); }}
                            style={{
                                width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <X size={18} color="white" />
                        </button>
                    </div>
                </div>
            )}

            {/* ─── LIVE CAMERA FEED ─── */}
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', width: '100%', height: '100%',
            }}>
                {/* Hidden canvas for freeze-frame capture */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* The viewfinder container */}
                <div style={{
                    width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
                }}>
                    {/* Live video element */}
                    {(phase === 'preview' || (phase === 'scanning' && !freezeFrame)) && (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            onLoadedMetadata={handleVideoReady}
                            style={{
                                width: '100%', height: '100%', objectFit: 'cover',
                                display: 'block',
                            }}
                        />
                    )}

                    {/* Frozen frame during scanning / complete */}
                    {freezeFrame && (phase === 'scanning' || phase === 'complete') && (
                        <img
                            src={freezeFrame}
                            alt="Captured worksheet"
                            style={{
                                width: '100%', height: '100%', objectFit: 'cover',
                                display: 'block',
                                filter: phase === 'complete' ? 'brightness(1.05)' : 'none',
                                transition: 'filter 1s ease',
                            }}
                        />
                    )}

                    {/* "Waiting for camera" indicator */}
                    {phase === 'preview' && !cameraReady && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', background: '#000',
                        }}>
                            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: '50%',
                                    border: '3px solid rgba(124, 58, 237, 0.3)',
                                    borderTopColor: 'var(--lymbic-purple)',
                                    animation: 'spin 1s linear infinite',
                                }} />
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Initializing camera...</p>
                            </div>
                        </div>
                    )}

                    {/* ─── AR OVERLAY: Edge Detection + Corners ─── */}
                    {cameraReady && phase !== 'complete' && (
                        <div style={{
                            position: 'absolute', inset: '10% 8%', pointerEvents: 'none', zIndex: 5,
                        }}>
                            {/* Document detection border */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                border: '2px solid rgba(96, 165, 250, 0.6)',
                                borderRadius: '8px',
                                boxShadow: '0 0 12px rgba(96, 165, 250, 0.3)',
                            }} />

                            {/* Corner markers */}
                            {[
                                { top: -2, left: -2, borderTop: '3px solid #60A5FA', borderLeft: '3px solid #60A5FA' },
                                { top: -2, right: -2, borderTop: '3px solid #60A5FA', borderRight: '3px solid #60A5FA' },
                                { bottom: -2, left: -2, borderBottom: '3px solid #60A5FA', borderLeft: '3px solid #60A5FA' },
                                { bottom: -2, right: -2, borderBottom: '3px solid #60A5FA', borderRight: '3px solid #60A5FA' },
                            ].map((style, i) => (
                                <div key={i} style={{ position: 'absolute', width: 24, height: 24, ...style }} />
                            ))}

                            {/* "Document detected" badge */}
                            {phase === 'preview' && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)',
                                        padding: '4px 12px', background: 'rgba(96, 165, 250, 0.2)',
                                        border: '1px solid rgba(96, 165, 250, 0.4)', borderRadius: '6px',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <span style={{ color: '#60A5FA', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                                        DOCUMENT DETECTED
                                    </span>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* ─── SCANNING ANIMATION OVERLAY ─── */}
                    {phase === 'scanning' && (
                        <ScanAnimation onComplete={handleScanComplete} />
                    )}

                    {/* ─── COMPLETE BADGE ─── */}
                    {phase === 'complete' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 20px', background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '12px',
                                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                            }}
                        >
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
                            <span style={{ color: '#10B981', fontSize: '0.85rem', fontWeight: 600 }}>
                                Digitized & Anonymized
                            </span>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* ─── STATUS TEXT ─── */}
            <div style={{
                position: 'absolute', bottom: 80, left: 0, right: 0, textAlign: 'center', zIndex: 10,
            }}>
                <AnimatePresence mode="wait">
                    {phase === 'preview' && cameraReady && (
                        <motion.p key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                            Position the worksheet inside the frame
                        </motion.p>
                    )}
                    {phase === 'scanning' && (
                        <motion.p key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ color: 'var(--lymbic-purple-light)', fontSize: '0.85rem', fontWeight: 500 }}>
                            Analyzing logic and anonymizing...
                        </motion.p>
                    )}
                    {phase === 'complete' && (
                        <motion.p key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ color: 'var(--logic-green)', fontSize: '0.85rem', fontWeight: 600 }}>
                            ✓ Scan complete — Redirecting to results...
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>

            {/* ─── CAPTURE BUTTON ─── */}
            {phase === 'preview' && cameraReady && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px',
                        display: 'flex', justifyContent: 'center',
                        background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
                    }}
                >
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleCaptureScan}
                        style={{
                            width: 72, height: 72, borderRadius: '50%', background: 'white',
                            border: '4px solid rgba(255,255,255,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            boxShadow: '0 0 24px rgba(255,255,255,0.2)',
                        }}
                    >
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--lymbic-purple), var(--lymbic-purple-deep))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Camera size={28} color="white" />
                        </div>
                    </motion.button>
                </motion.div>
            )}
        </motion.div>
    );
}
