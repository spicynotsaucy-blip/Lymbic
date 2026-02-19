// ═══════════════════════════════════════════════════════════
//  useSmartScanner — Orchestrator hook for the adaptive pipeline
//  + Defense-in-Depth validation (Phase 10)
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';
import { PageTracker } from '../utils/PageTracker';
import { ImageQualityAnalyzer } from '../utils/ImageQualityAnalyzer';
import { ImageEnhancer } from '../utils/ImageEnhancer';
import { SemanticFingerprinter } from '../utils/SemanticFingerprint';
import { CrossPageReasoner } from '../utils/CrossPageReasoner';
import { ReadinessEngine } from '../utils/ReadinessEngine';
import { analyzeWithLogicEngine, runAnalysisPipeline } from '../lib/analysisEngine';
import useDocumentScanner from './useDocumentScanner';

export default function useSmartScanner(videoRef, config = {}) {
    const {
        autoCapture = false,
        autoCaptureDelay = 1200,
        autoAnalyze = true,
        enhanceImages = true,
        analysisMode = 'full',
    } = config;

    // ── Singletons ──────────────────────────────────────────
    const trackerRef = useRef(new PageTracker());
    const qualityRef = useRef(new ImageQualityAnalyzer());
    const enhancerRef = useRef(new ImageEnhancer());
    const fingerRef = useRef(new SemanticFingerprinter());
    const reasonerRef = useRef(new CrossPageReasoner());
    const readinessRef = useRef(new ReadinessEngine());
    const frameDataRef = useRef(null);
    const stableSinceRef = useRef(null);

    const [state, setState] = useState({
        mode: 'SCANNING',       // SCANNING | QUALITY_CHECK | ENHANCING | CAPTURING |
        // DUPLICATE_DETECTED | ANALYZING | COMPLETE | QUALITY_ISSUE
        activePage: null,
        allPages: [],
        lastCapture: null,
        qualityAnalysis: null,
        synthesis: null,
        recommendations: [],
        analysisResult: null,
        analysisError: null,
        readiness: null,        // ReadinessEngine assessment
    });

    // ── Adaptive polling interval ───────────────────────────
    // Throttle detection when stable to save battery/CPU
    const [detectionInterval, setDetectionInterval] = useState(200);

    useEffect(() => {
        if (state.readiness?.stabilityMet) {
            const stableDuration = Date.now() - (state.readiness.stableSince || Date.now());
            if (stableDuration > 2000 && detectionInterval === 200) {
                setDetectionInterval(500); // Throttle when very stable
            }
        } else if (detectionInterval !== 200) {
            setDetectionInterval(200); // Resume fast scanning on motion
        }
    }, [state.readiness?.stabilityMet, state.readiness?.stableSince, detectionInterval]);

    // ── Detection from existing hook ────────────────────────
    const detection = useDocumentScanner(videoRef, detectionInterval);

    // ── Extract downscaled frame data for readiness engine ──
    useEffect(() => {
        if (!videoRef.current) return;
        const update = () => {
            const v = videoRef.current;
            if (!v || v.videoWidth === 0) return;
            const c = document.createElement('canvas');
            const s = 0.25;
            c.width = v.videoWidth * s;
            c.height = v.videoHeight * s;
            const ctx = c.getContext('2d');
            ctx.drawImage(v, 0, 0, c.width, c.height);
            frameDataRef.current = ctx.getImageData(0, 0, c.width, c.height);
        };
        const iv = setInterval(update, 200);
        return () => clearInterval(iv);
    }, [videoRef]);

    // ── Run readiness assessment every detection frame ───────
    useEffect(() => {
        const readiness = readinessRef.current.assess({
            detected: detection.detected,
            quad: detection.quad,
            confidence: detection.confidence,
            frameData: frameDataRef.current,
        });

        setState(prev => ({ ...prev, readiness }));

        // Track pages via PageTracker as before
        if (!detection.detected || !detection.quad) {
            stableSinceRef.current = null;
            return;
        }

        const tracker = trackerRef.current;
        const results = tracker.update(detection.quad);

        if (results.length > 0) {
            const primary = results[0];
            const stability = tracker.getStability(primary.id);

            if (stability.stable) {
                if (!stableSinceRef.current) stableSinceRef.current = Date.now();
            } else {
                stableSinceRef.current = null;
            }

            setState(prev => ({
                ...prev,
                activePage: { ...primary.page, stability, isNew: primary.isNew },
                allPages: tracker.getAllPages(),
            }));
        }
    }, [detection]);

    // ── Quality check ───────────────────────────────────────
    const checkCaptureQuality = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return null;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const preview = canvas.toDataURL('image/jpeg', 0.8);
        const quality = await qualityRef.current.analyze(preview);
        setState(prev => ({ ...prev, qualityAnalysis: quality }));
        return quality;
    }, [videoRef]);

    // ── Smart capture pipeline ──────────────────────────────
    const smartCapture = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return null;

        // 1. Quality check
        setState(prev => ({ ...prev, mode: 'QUALITY_CHECK' }));
        const quality = await checkCaptureQuality();

        if (!quality.shouldProceed) {
            setState(prev => ({ ...prev, mode: 'QUALITY_ISSUE', qualityAnalysis: quality }));
            return { success: false, reason: 'quality', quality };
        }

        // 2. Capture frame
        setState(prev => ({ ...prev, mode: 'CAPTURING' }));
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        let imageData = canvas.toDataURL('image/jpeg', 0.92);

        // 3. Enhance if needed
        if (enhanceImages && quality.canAutoFix && quality.issues.length > 0) {
            setState(prev => ({ ...prev, mode: 'ENHANCING' }));
            const enhanced = await enhancerRef.current.enhance(imageData, quality);
            imageData = enhanced.enhanced;
        }

        // 4. Semantic fingerprint
        const fingerprint = await fingerRef.current.generate(imageData);

        // 5. Deduplicate
        for (const page of trackerRef.current.getAllPages()) {
            if (page.semanticFingerprint) {
                const sim = fingerRef.current.compare(fingerprint, page.semanticFingerprint);
                if (sim > 0.85) {
                    setState(prev => ({ ...prev, mode: 'DUPLICATE_DETECTED' }));
                    return { success: false, reason: 'duplicate', existingPageId: page.id, similarity: sim };
                }
            }
        }

        // 6. Register page
        const tracker = trackerRef.current;
        if (state.activePage) {
            tracker.setCapture(state.activePage.id, imageData);
            const page = tracker.getPage(state.activePage.id);
            if (page) page.semanticFingerprint = fingerprint;
        }

        // Haptic
        if (navigator.vibrate) navigator.vibrate([15, 30, 15]);

        setState(prev => ({
            ...prev,
            mode: autoAnalyze ? 'ANALYZING' : 'SCANNING',
            lastCapture: {
                pageId: state.activePage?.id || Date.now(),
                timestamp: Date.now(),
                image: imageData,
                quad: detection.quad ? [...detection.quad] : null,
                quality,
                fingerprint,
            },
        }));

        // 7. Analyze — use defense pipeline if we have readiness state
        if (autoAnalyze) {
            if (state.activePage) tracker.markAnalyzing(state.activePage.id);

            try {
                const captureData = {
                    image: imageData,
                    quad: detection.quad ? [...detection.quad] : null,
                    timestamp: Date.now(),
                    readinessScore: state.readiness?.score,
                };

                let result;
                if (state.readiness && detection.quad) {
                    // Full defense pipeline
                    const pipelineResult = await runAnalysisPipeline(captureData, state.readiness, {
                        mode: analysisMode,
                        imageQuality: quality,
                    });
                    result = pipelineResult.success ? (pipelineResult.result || pipelineResult.analysis) : null;
                    if (!pipelineResult.success) {
                        throw new Error(pipelineResult.error?.message || 'Pipeline failed');
                    }
                } else {
                    // Fallback to direct analysis
                    result = await analyzeWithLogicEngine(imageData, {}, {
                        mode: analysisMode,
                        imageQuality: quality,
                        previousPages: tracker.getAnalyzedPages().map(p => ({
                            analysisResult: p.analysisResult,
                            summary: p.analysisResult?.overallAssessment?.summary,
                        })),
                    });
                }

                if (state.activePage) tracker.markComplete(state.activePage.id, result);

                const synthesis = reasonerRef.current.synthesize(tracker.getAnalyzedPages());

                setState(prev => ({
                    ...prev,
                    mode: 'COMPLETE',
                    analysisResult: result,
                    synthesis,
                    recommendations: synthesis?.recommendations || [],
                    allPages: tracker.getAllPages(),
                }));

                return { success: true, pageId: state.activePage?.id, image: imageData, result };
            } catch (err) {
                console.error('[SmartScanner] Analysis failed:', err);
                if (state.activePage) tracker.markFailed(state.activePage.id, err.message);
                setState(prev => ({ ...prev, mode: 'SCANNING', analysisError: err.message }));
                return { success: false, reason: 'analysis_failed', error: err.message };
            }
        }

        return { success: true, pageId: state.activePage?.id, image: imageData };
    }, [videoRef, checkCaptureQuality, enhanceImages, autoAnalyze, analysisMode, state.activePage, state.readiness, detection.quad]);

    // ── Auto-capture on stability ───────────────────────────
    useEffect(() => {
        if (!autoCapture || !stableSinceRef.current) return;
        if (state.mode !== 'SCANNING') return;
        if (!state.activePage || state.activePage.capturedImage) return;

        const elapsed = Date.now() - stableSinceRef.current;
        if (elapsed >= autoCaptureDelay) {
            smartCapture();
        }
    }, [state.activePage, state.mode, autoCapture, autoCaptureDelay, smartCapture]);

    // ── Actions ─────────────────────────────────────────────
    const capture = useCallback(() => smartCapture(), [smartCapture]);

    const forceCapture = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return null;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.92);
    }, [videoRef]);

    const reset = useCallback(() => {
        trackerRef.current.reset();
        readinessRef.current.reset();
        stableSinceRef.current = null;
        setState({
            mode: 'SCANNING', activePage: null, allPages: [],
            lastCapture: null, qualityAnalysis: null, synthesis: null,
            recommendations: [], analysisResult: null, analysisError: null,
            readiness: null,
        });
    }, []);

    const nextPage = useCallback(() => {
        stableSinceRef.current = null;
        setState(prev => ({
            ...prev, mode: 'SCANNING', activePage: null, qualityAnalysis: null,
        }));
    }, []);

    const getSynthesis = useCallback(() => {
        return reasonerRef.current.synthesize(trackerRef.current.getAnalyzedPages());
    }, []);

    // ── Computed ────────────────────────────────────────────
    // Use ReadinessEngine as the single source of truth
    const isReadyToCapture =
        state.readiness?.ready === true &&
        !state.activePage?.capturedImage &&
        state.mode === 'SCANNING';

    return {
        detection,
        mode: state.mode,
        activePage: state.activePage,
        allPages: state.allPages,
        lastCapture: state.lastCapture,
        qualityAnalysis: state.qualityAnalysis,
        synthesis: state.synthesis,
        recommendations: state.recommendations,
        analysisResult: state.analysisResult,
        analysisError: state.analysisError,
        isReadyToCapture,
        analyzedCount: trackerRef.current.getAnalyzedPages().length,
        // Defense-in-depth additions
        readiness: state.readiness,
        stabilityProgress: state.readiness?.stabilityProgress || 0,
        readinessScore: state.readiness?.score || 0,
        guidance: state.readiness?.guidance || { primary: { message: 'Initializing…', icon: 'loading' }, all: [], isReady: false },
        // Actions
        capture,
        forceCapture,
        reset,
        nextPage,
        getSynthesis,
        checkQuality: checkCaptureQuality,
    };
}
