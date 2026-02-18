// ═══════════════════════════════════════════════════════════
//  useDocumentScanner — Temporal smoothing + stability gate
// ═══════════════════════════════════════════════════════════
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    getFrameData,
    detectEdges,
    findDominantLines,
    findDocumentQuad,
    quadArea,
    checkSkew,
    triggerHaptic,
} from '../lib/detectionUtils';

const HISTORY_SIZE = 8;
const STABILITY_THRESHOLD = 0.6;   // 60% of recent frames must agree
const POSITION_TOLERANCE = 25;    // pixels (in downscaled coords)

function checkPositionStability(history, tolerance) {
    const withQuads = history.filter(h => h.quad);
    if (withQuads.length < 3) return false;

    const recent = withQuads.slice(-3);
    for (let ci = 0; ci < 4; ci++) {
        for (let i = 1; i < recent.length; i++) {
            const drift = Math.hypot(
                recent[i].quad[ci].x - recent[i - 1].quad[ci].x,
                recent[i].quad[ci].y - recent[i - 1].quad[ci].y,
            );
            if (drift > tolerance) return false;
        }
    }
    return true;
}

function getSmoothedQuad(history) {
    const withQuads = history.filter(h => h.quad);
    if (withQuads.length === 0) return null;

    return [0, 1, 2, 3].map(ci => ({
        x: withQuads.reduce((s, h) => s + h.quad[ci].x, 0) / withQuads.length,
        y: withQuads.reduce((s, h) => s + h.quad[ci].y, 0) / withQuads.length,
    }));
}

/**
 * Hook that runs document detection on ~5 fps and reports stable results.
 *
 * @param {React.RefObject} videoRef
 * @param {number} interval  ms between frames (default 200 → 5fps)
 * @returns {{ detected, quad, confidence, isStable, scale, alignmentState }}
 */
export default function useDocumentScanner(videoRef, interval = 200) {
    const [state, setState] = useState({
        detected: false,
        quad: null,
        confidence: 0,
        isStable: false,
        scale: 1,
        alignmentState: 'searching', // searching | too_far | too_close | off_center | tilted | ready
    });

    const historyRef = useRef([]);
    const hapticFired = useRef(false);

    const processFrame = useCallback(() => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) return;

        // 1. Grab downscaled frame
        const frame = getFrameData(video, 320);

        // 2. Detect edges → lines → quad
        const edgeMap = detectEdges(frame, 30);
        const lines = findDominantLines(edgeMap, 20);
        const quad = findDocumentQuad(lines, frame.width, frame.height);

        // 3. Push to history
        historyRef.current.push({ detected: !!quad, quad, ts: Date.now() });
        if (historyRef.current.length > HISTORY_SIZE) historyRef.current.shift();

        const history = historyRef.current;
        const detectedCount = history.filter(h => h.detected).length;
        const confidence = detectedCount / Math.max(history.length, 1);
        const posStable = checkPositionStability(history, POSITION_TOLERANCE);
        const shouldShow = confidence >= STABILITY_THRESHOLD && posStable;
        const smoothed = shouldShow ? getSmoothedQuad(history) : null;

        // 4. Determine alignment state
        let alignmentState = 'searching';
        if (smoothed) {
            const area = quadArea(smoothed);
            const frameArea = frame.width * frame.height;
            const fillRatio = area / frameArea;

            const cx = smoothed.reduce((s, c) => s + c.x, 0) / 4;
            const cy = smoothed.reduce((s, c) => s + c.y, 0) / 4;
            const drift = Math.hypot(cx - frame.width / 2, cy - frame.height / 2);

            if (fillRatio < 0.2) alignmentState = 'too_far';
            else if (fillRatio > 0.92) alignmentState = 'too_close';
            else if (drift > frame.width * 0.18) alignmentState = 'off_center';
            else if (checkSkew(smoothed)) alignmentState = 'tilted';
            else alignmentState = 'ready';
        }

        // 5. Haptic on first "ready + stable"
        if (alignmentState === 'ready' && posStable && !hapticFired.current) {
            triggerHaptic('success');
            hapticFired.current = true;
        } else if (alignmentState !== 'ready') {
            hapticFired.current = false;
        }

        setState({
            detected: shouldShow,
            quad: smoothed,
            confidence,
            isStable: posStable,
            scale: frame.scale,
            alignmentState,
        });
    }, [videoRef]);

    useEffect(() => {
        const id = setInterval(processFrame, interval);
        return () => clearInterval(id);
    }, [processFrame, interval]);

    return state;
}
