// ═══════════════════════════════════════════════════════════
//  LAYER 1: CAPTURE UTILITIES — Quality Gate + Preprocessor
// ═══════════════════════════════════════════════════════════

/**
 * Assess image quality from raw pixel data.
 * Returns a score 0-1 and a list of issues.
 */
export function assessImageQuality(imageData) {
    const data = imageData.data;
    const pixelCount = data.length / 4;
    const values = [];
    let brightness = 0;

    for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        values.push(gray);
        brightness += gray;
    }

    brightness /= pixelCount;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - brightness, 2), 0) / pixelCount;
    const contrast = Math.sqrt(variance);

    const issues = [];
    if (brightness < 55) issues.push('too_dark');
    if (brightness > 240) issues.push('overexposed');
    if (contrast < 25) issues.push('low_contrast');

    const score = Math.max(0, 1 - issues.length * 0.35);

    const fixMap = {
        too_dark: 'Move to better lighting',
        overexposed: 'Reduce glare or move away from direct light',
        low_contrast: 'Ensure the writing is clearly visible on the page',
    };

    return {
        score,
        issues,
        fix: issues.length > 0 ? fixMap[issues[0]] : null,
        brightness: Math.round(brightness),
        contrast: Math.round(contrast),
    };
}

/**
 * Enhance image contrast for better LLM OCR recognition.
 */
export function preprocessForAnalysis(ctx, canvas) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const factor = 1.4;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
        data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
        data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * Full capture pipeline: grab frame → quality gate → preprocess → return base64.
 * @param {React.RefObject} videoRef
 * @returns {{ success: boolean, image?: string, metadata?: object, reason?: string, suggestion?: string }}
 */
export function captureWithQualityGate(videoRef) {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
        return { success: false, reason: 'no_stream', suggestion: 'Camera is not ready yet.' };
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Quality check on raw frame
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const quality = assessImageQuality(imageData);

    if (quality.score < 0.6) {
        return {
            success: false,
            reason: quality.issues[0],
            suggestion: quality.fix,
            score: quality.score,
        };
    }

    // Enhance for LLM
    preprocessForAnalysis(ctx, canvas);

    return {
        success: true,
        image: canvas.toDataURL('image/jpeg', 0.92),
        metadata: {
            capturedAt: Date.now(),
            dimensions: { w: canvas.width, h: canvas.height },
            qualityScore: quality.score,
            brightness: quality.brightness,
            contrast: quality.contrast,
        },
    };
}
