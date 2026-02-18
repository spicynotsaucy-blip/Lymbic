// ═══════════════════════════════════════════════════════════
//  DOCUMENT DETECTION UTILITIES
//  Sobel edge detection → Hough line finder → Quad detector
// ═══════════════════════════════════════════════════════════

/**
 * Extract grayscale pixel data from a video element at reduced resolution.
 * Working at lower res dramatically speeds up detection.
 */
export function getFrameData(video, maxDim = 320) {
    const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    return { imageData, width: w, height: h, scale };
}

// ─── STEP 1: Sobel Edge Detection ────────────────────────

/**
 * Runs the Sobel operator over grayscale pixel data.
 * Returns a Uint8Array edge map where 255 = edge, 0 = no edge.
 */
export function detectEdges(frameData, threshold = 30) {
    const { imageData, width, height } = frameData;
    const data = imageData.data;
    const edges = new Uint8Array(width * height);

    const getGray = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0;
        const i = (y * width + x) * 4;
        return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    };

    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let gx = 0, gy = 0;

            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const pixel = getGray(x + kx, y + ky);
                    const idx = (ky + 1) * 3 + (kx + 1);
                    gx += pixel * sobelX[idx];
                    gy += pixel * sobelY[idx];
                }
            }

            const magnitude = Math.sqrt(gx * gx + gy * gy);
            edges[y * width + x] = magnitude > threshold ? 255 : 0;
        }
    }

    return { edges, width, height };
}

// ─── STEP 2: Simplified Hough Line Detection ─────────────

/**
 * Finds dominant lines from an edge map via Hough transform.
 * Returns sorted array of { rho, theta, votes }.
 */
export function findDominantLines(edgeData, numLines = 20) {
    const { edges, width, height } = edgeData;
    const diag = Math.ceil(Math.sqrt(width * width + height * height));
    const numRho = diag * 2;
    const numTheta = 180;

    const accumulator = new Int32Array(numRho * numTheta);

    // Accumulate votes — sample every other pixel for speed
    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
            if (edges[y * width + x] === 0) continue;

            for (let thetaIdx = 0; thetaIdx < numTheta; thetaIdx++) {
                const theta = (thetaIdx * Math.PI) / 180;
                const rho = Math.round(x * Math.cos(theta) + y * Math.sin(theta));
                const rhoIdx = rho + diag;

                if (rhoIdx >= 0 && rhoIdx < numRho) {
                    accumulator[rhoIdx * numTheta + thetaIdx]++;
                }
            }
        }
    }

    // Extract lines above significance threshold
    const minVotes = Math.max(30, Math.min(width, height) * 0.1);
    const lines = [];

    for (let i = 0; i < accumulator.length; i++) {
        if (accumulator[i] > minVotes) {
            const rhoIdx = Math.floor(i / numTheta);
            const thetaIdx = i % numTheta;
            lines.push({
                rho: rhoIdx - diag,
                theta: (thetaIdx * Math.PI) / 180,
                votes: accumulator[i],
            });
        }
    }

    // Non-maximum suppression: merge nearby lines
    const merged = suppressNearbyLines(lines, 10, 5);

    return merged
        .sort((a, b) => b.votes - a.votes)
        .slice(0, numLines);
}

function suppressNearbyLines(lines, rhoTol, thetaTol) {
    const used = new Array(lines.length).fill(false);
    const result = [];

    const sorted = [...lines].sort((a, b) => b.votes - a.votes);

    for (let i = 0; i < sorted.length; i++) {
        if (used[i]) continue;
        result.push(sorted[i]);
        used[i] = true;

        for (let j = i + 1; j < sorted.length; j++) {
            if (used[j]) continue;
            const dr = Math.abs(sorted[j].rho - sorted[i].rho);
            const dt = Math.abs(sorted[j].theta - sorted[i].theta) * (180 / Math.PI);
            if (dr < rhoTol && dt < thetaTol) {
                used[j] = true;
            }
        }
    }

    return result;
}

// ─── STEP 3: Quadrilateral Detection ─────────────────────

/**
 * Finds a roughly rectangular quadrilateral formed by intersecting lines.
 * Returns 4 corner points [TL, TR, BR, BL] in downscaled coordinates, or null.
 */
export function findDocumentQuad(lines, width, height) {
    if (lines.length < 4) return null;

    // Separate roughly horizontal vs roughly vertical
    const horizontal = [];
    const vertical = [];

    for (const l of lines) {
        const angleDeg = (l.theta * 180) / Math.PI;
        // Horizontal-ish: theta near 90° (±25°)
        if (angleDeg > 65 && angleDeg < 115) {
            horizontal.push(l);
        }
        // Vertical-ish: theta near 0° or 180° (±25°)
        else if (angleDeg < 25 || angleDeg > 155) {
            vertical.push(l);
        }
    }

    if (horizontal.length < 2 || vertical.length < 2) return null;

    // Try top 2 horizontal × top 2 vertical → 4 intersections
    const hPair = horizontal.slice(0, 2);
    const vPair = vertical.slice(0, 2);

    const corners = [];
    for (const h of hPair) {
        for (const v of vPair) {
            const pt = lineIntersection(h, v);
            if (pt && pt.x >= -5 && pt.x <= width + 5 && pt.y >= -5 && pt.y <= height + 5) {
                corners.push({ x: Math.max(0, Math.min(width, pt.x)), y: Math.max(0, Math.min(height, pt.y)) });
            }
        }
    }

    if (corners.length !== 4) return null;

    const sorted = sortCorners(corners);
    if (!isValidQuad(sorted, width, height)) return null;

    return sorted;
}

function lineIntersection(l1, l2) {
    const { rho: r1, theta: t1 } = l1;
    const { rho: r2, theta: t2 } = l2;
    const denom = Math.cos(t1) * Math.sin(t2) - Math.cos(t2) * Math.sin(t1);
    if (Math.abs(denom) < 0.001) return null;
    return {
        x: (r1 * Math.sin(t2) - r2 * Math.sin(t1)) / denom,
        y: (r2 * Math.cos(t1) - r1 * Math.cos(t2)) / denom,
    };
}

function sortCorners(corners) {
    const cx = corners.reduce((s, c) => s + c.x, 0) / 4;
    const cy = corners.reduce((s, c) => s + c.y, 0) / 4;

    return [...corners].sort((a, b) => {
        const aa = Math.atan2(a.y - cy, a.x - cx);
        const ab = Math.atan2(b.y - cy, b.x - cx);
        return aa - ab;
    });
}

function isValidQuad(corners, width, height) {
    const area = quadArea(corners);
    const frameArea = width * height;

    // Must occupy 15-95% of frame
    if (area < frameArea * 0.12 || area > frameArea * 0.95) return false;

    // Each interior angle must be 55-125°
    for (let i = 0; i < 4; i++) {
        const prev = corners[(i + 3) % 4];
        const curr = corners[i];
        const next = corners[(i + 1) % 4];
        const angle = cornerAngle(prev, curr, next);
        if (angle < 55 || angle > 125) return false;
    }

    return true;
}

export function quadArea(corners) {
    let area = 0;
    for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        area += corners[i].x * corners[j].y;
        area -= corners[j].x * corners[i].y;
    }
    return Math.abs(area) / 2;
}

function cornerAngle(p1, p2, p3) {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if (mag1 === 0 || mag2 === 0) return 0;
    const cosA = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosA) * (180 / Math.PI);
}

// ─── STEP 4: Skew Check ─────────────────────────────────

/**
 * Returns true if the quad is too skewed (perspective distortion).
 */
export function checkSkew(quad) {
    const topW = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
    const botW = Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y);
    const leftH = Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y);
    const rightH = Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y);

    const wRatio = Math.min(topW, botW) / Math.max(topW, botW);
    const hRatio = Math.min(leftH, rightH) / Math.max(leftH, rightH);

    return wRatio < 0.65 || hRatio < 0.65;
}

// ─── HAPTIC & SOUND ──────────────────────────────────────

export function triggerHaptic(type) {
    if (!navigator.vibrate) return;
    switch (type) {
        case 'success': navigator.vibrate([10, 50, 10]); break;
        case 'warning': navigator.vibrate(100); break;
        case 'error': navigator.vibrate([50, 100, 50, 100, 50]); break;
    }
}
