import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '../context/OnboardingContext';
import { useAdaptiveUI } from '../hooks/useAdaptiveUI'; // [NEW]
import AdaptiveButton from '../components/AdaptiveButton'; // [NEW]
import ScanAnimation from '../components/ScanAnimation';
import { Camera, X, ShieldAlert, RefreshCw, FlipHorizontal, Lightbulb, Loader2, ArrowRight, Check } from 'lucide-react';
import { normalizeAndStore } from '../lib/storageLayer';
import useSmartScanner from '../hooks/useSmartScanner';
import DocumentOverlay from '../components/DocumentOverlay';

export default function ScanScreen() {
    const navigate = useNavigate();
    const { data, setScanResult } = useOnboarding();
    const { setEmotion } = useAdaptiveUI(); // [NEW]
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
    const sessionIdRef = useRef(`session_${Date.now()} `);

    // Batch mode state
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [scannedCount, setScannedCount] = useState(0);
    const [showSavedToast, setShowSavedToast] = useState(false);

    // Adaptive intelligence pipeline — detection + quality + analysis
    const scanner = useSmartScanner(videoRef, { autoCapture: false, analysisMode: 'full' });
    const detection = scanner.detection;

    // [NEW] Set initial focus mood
    useEffect(() => {
        setEmotion('focus');
    }, [setEmotion]);

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
            setEmotion('error'); // [NEW]
        }
    }, [setEmotion]);

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
        setEmotion('focus'); // [NEW]
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

    const handleCaptureScan = async () => {
        // Smart scanner handles quality check + enhancement + dedup
        const frameData = await scanner.forceCapture();
        if (!frameData) return;

        // Freeze the frame for the scan animation
        if (canvasRef.current) {
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
            };
            img.src = frameData;
        }
        setFreezeFrame(frameData);
        setPhase('scanning');

        // Store captured frame for pipeline (used after animation)
        sessionIdRef.captureData = { image: frameData, metadata: { qualityScore: scanner.qualityAnalysis?.overallScore ?? 1 } };
    };

    const handleScanComplete = async () => {
        // After animation finishes → run smart pipeline (quality + enhance + 3-pass analysis)
        setPhase('analyzing');
        const capture = sessionIdRef.captureData;

        try {
            setAnalyzeStatus('Analyzing quality…');
            const result = await scanner.capture();

            if (result?.success) {
                setAnalyzeStatus('Tracing logic pathway…');
                const stored = await normalizeAndStore(
                    result.result,
                    { qualityScore: scanner.qualityAnalysis?.overallScore ?? 1 },
                    sessionIdRef.current
                );

                if (isBatchMode) {
                    // Batch mode: Stay on screen, show toast, reset
                    setScannedCount(prev => prev + 1);
                    setShowSavedToast(true);
                    setEmotion('success'); // [NEW] Batch success trigger
                    setTimeout(() => setShowSavedToast(false), 2000);

                    // Reset for next scan
                    setPhase('preview');
                    setFreezeFrame(null);
                    setAnalyzeStatus('');
                    scanner.nextPage(); // Clear active page in tracker

                    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                } else {
                    // Single mode: Navigate immediately
                    setScanResult(stored.success ? stored.result : result.result);
                    setPhase('complete');
                    setEmotion('success'); // [NEW] Success trigger
                }
            } else if (result?.reason === 'quality') {
                setQualityIssue({
                    reason: 'Low image quality',
                    suggestion: scanner.qualityAnalysis?.recommendations?.[0] || 'Try better lighting',
                });
                setPhase('quality_fail');
                setEmotion('error'); // [NEW] Quality fail trigger
            } else if (result?.reason === 'duplicate') {
                setAnalyzeStatus('Duplicate detected — try a different page');
                setTimeout(() => {
                    setPhase('preview');
                    setFreezeFrame(null);
                }, 1500);
            } else {
                setScanResult(null);
                setPhase('complete');
            }
        } catch (err) {
            console.error('[Lymbic] Pipeline error:', err);
            // Even on error in batch mode, we probably want to let them continue
            if (isBatchMode) {
                setAnalyzeStatus('Error saving scan');
                setTimeout(() => {
                    setPhase('preview');
                    setFreezeFrame(null);
                }, 1500);
            } else {
                setScanResult(null);
                setPhase('complete');
            }
        }
    };

    const finishBatch = () => {
        stopCamera();
        navigate('/results'); // In real app, this might go to a "Batch Summary" screen
    };

    const handleRetry = () => {
        setPhase('requesting');
        setCameraReady(false);
        setFreezeFrame(null);
        setQualityIssue(null);
        setEmotion('neutral'); // [NEW]
    };

    const handleRetryCapture = () => {
        setPhase('preview');
        setQualityIssue(null);
        setEmotion('focus'); // [NEW]
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
                                <AdaptiveButton
                                    variant="secondary"
                                    style={{ flex: 1, padding: '12px' }}
                                    onClick={() => navigate('/grade')}
                                >
                                    Not Now
                                </AdaptiveButton>
                                <AdaptiveButton
                                    variant="primary"
                                    style={{ flex: 1, padding: '12px' }}
                                    onClick={handleAllowClick}
                                >
                                    Allow Camera
                                </AdaptiveButton>
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
                                <AdaptiveButton
                                    variant="secondary"
                                    style={{ flex: 1, padding: '12px' }}
                                    onClick={() => navigate('/grade')}
                                >
                                    Go Back
                                </AdaptiveButton>
                                <AdaptiveButton
                                    variant="primary"
                                    style={{ flex: 1, padding: '12px', gap: '6px' }}
                                    onClick={handleRetry}
                                >
                                    <RefreshCw size={16} /> Retry
                                </AdaptiveButton>
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
                                <AdaptiveButton variant="secondary" style={{ flex: 1, padding: '12px' }} onClick={() => navigate('/grade')}>Cancel</AdaptiveButton>
                                <AdaptiveButton variant="primary" style={{ flex: 1, padding: '12px', gap: '6px' }} onClick={handleRetryCapture}>
                                    <RefreshCw size={16} /> Try Again
                                </AdaptiveButton>
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
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, padding: '20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 20,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
            }}>
                <AdaptiveButton
                    variant="ghost"
                    onClick={() => navigate('/')}
                    style={{ padding: 8, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', backdropFilter: 'blur(10px)', border: 'none', color: 'white' }}
                >
                    <X size={24} />
                </AdaptiveButton>

                {/* Batch Mode Toggle */}
                {phase !== 'requesting' && (
                    <div
                        onClick={() => setIsBatchMode(!isBatchMode)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderRadius: 20,
                            backdropFilter: 'blur(10px)', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)'
                        }}
                    >
                        <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 500 }}>Batch Mode</span>
                        <div style={{
                            width: 36, height: 20, borderRadius: 10,
                            background: isBatchMode ? '#22c55e' : 'rgba(255,255,255,0.3)',
                            position: 'relative', transition: 'background 0.2s'
                        }}>
                            <motion.div
                                animate={{ x: isBatchMode ? 18 : 2 }}
                                style={{
                                    width: 16, height: 16, borderRadius: '50%', background: 'white',
                                    position: 'absolute', top: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                }}
                            />
                        </div>
                    </div>
                )}

                <AdaptiveButton
                    variant="ghost"
                    onClick={handleFlipCamera}
                    style={{ padding: 8, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', backdropFilter: 'blur(10px)', border: 'none', color: 'white' }}
                >
                    <FlipHorizontal size={24} />
                </AdaptiveButton>
            </div>

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

                    {/* ─── INTELLIGENT DOCUMENT OVERLAY ─── */}
                    {cameraReady && phase === 'preview' && (
                        <DocumentOverlay
                            detection={detection}
                            videoWidth={videoRef.current?.videoWidth || 1920}
                            videoHeight={videoRef.current?.videoHeight || 1080}
                        />
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
                    {phase === 'preview' && scanner.guidance && !scanner.guidance.isReady && (
                        <motion.p key="guidance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 500 }}>
                            {scanner.guidance.primary.message}
                        </motion.p>
                    )}
                    {phase === 'preview' && scanner.isReadyToCapture && (
                        <motion.p key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 600 }}>
                            ✓ Ready to capture
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
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
                    }}
                >
                    {/* Stability progress ring */}
                    <div style={{ position: 'relative', width: 84, height: 84 }}>
                        <svg width="84" height="84" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                            <circle cx="42" cy="42" r="38" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                            <circle
                                cx="42" cy="42" r="38" fill="none"
                                stroke={scanner.isReadyToCapture ? '#22c55e' : 'rgba(139,92,246,0.6)'}
                                strokeWidth="3"
                                strokeDasharray={`${2 * Math.PI * 38} `}
                                strokeDashoffset={`${2 * Math.PI * 38 * (1 - scanner.stabilityProgress)} `}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 0.2s ease, stroke 0.3s ease' }}
                            />
                        </svg>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={scanner.isReadyToCapture ? { scale: 0.9 } : {}}
                            onClick={handleCaptureScan}
                            disabled={!scanner.isReadyToCapture}
                            aria-label={scanner.isReadyToCapture ? 'Capture document' : 'Align document to capture'}
                            style={{
                                position: 'absolute', top: 6, left: 6,
                                width: 72, height: 72, borderRadius: '50%',
                                background: scanner.isReadyToCapture ? '#22c55e' : 'white',
                                border: `4px solid ${scanner.isReadyToCapture ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.3)'} `,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: scanner.isReadyToCapture ? 'pointer' : 'not-allowed',
                                opacity: scanner.isReadyToCapture ? 1 : 0.6,
                                boxShadow: scanner.isReadyToCapture
                                    ? '0 0 24px rgba(34,197,94,0.4)'
                                    : '0 0 24px rgba(255,255,255,0.2)',
                                transition: 'background 0.3s ease, border 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease',
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
                    </div>
                </motion.div>
            )}

            {/* ─── BATCH MODE FAB ─── */}
            <AnimatePresence>
                {isBatchMode && scannedCount > 0 && phase !== 'scanning' && (
                    <div style={{ position: 'absolute', bottom: 120, right: 30, zIndex: 30 }}>
                        <AdaptiveButton
                            variant="primary"
                            onClick={finishBatch}
                            style={{
                                borderRadius: 30, padding: '12px 24px',
                                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                                gap: 8
                            }}
                        >
                            <span>Finish Batch ({scannedCount})</span>
                            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: 4, display: 'flex' }}>
                                <ArrowRight size={16} />
                            </div>
                        </AdaptiveButton>
                    </div>
                )}
            </AnimatePresence>

            {/* ─── SAVED TOAST ─── */}
            <AnimatePresence>
                {showSavedToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{
                            position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(34, 197, 94, 0.9)', color: 'white',
                            padding: '8px 16px', borderRadius: 20, zIndex: 40,
                            display: 'flex', alignItems: 'center', gap: 8,
                            backdropFilter: 'blur(4px)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                        }}
                    >
                        <div style={{ background: 'white', borderRadius: '50%', padding: 2 }}>
                            <Check size={12} color="#22c55e" />
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Scan Saved</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
