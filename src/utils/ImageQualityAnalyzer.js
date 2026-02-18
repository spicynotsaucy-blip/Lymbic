// ═══════════════════════════════════════════════════════════
//  IMAGE QUALITY ANALYZER — Deep quality metrics for capture assessment
// ═══════════════════════════════════════════════════════════

export class ImageQualityAnalyzer {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    async analyze(imageSource) {
        const img = await this.loadImage(imageSource);
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);

        const metrics = {
            blur: this.measureBlur(imageData),
            brightness: this.measureBrightness(imageData),
            contrast: this.measureContrast(imageData),
            noise: this.measureNoise(imageData),
            skew: this.measureSkew(imageData),
            textDensity: this.estimateTextDensity(imageData),
        };

        const overallScore = this.calculateOverallScore(metrics);
        const issues = this.identifyIssues(metrics);
        const recommendations = this.generateRecommendations(issues);
        const canAutoFix = this.determineAutoFixability(issues);

        return {
            metrics,
            overallScore,
            issues,
            recommendations,
            canAutoFix,
            shouldProceed: overallScore > 0.4,
            confidence: this.estimateAIConfidence(metrics),
        };
    }

    // ─── Blur: Laplacian variance (higher = sharper) ─────────
    measureBlur(imageData) {
        const { data, width, height } = imageData;
        const gray = this._toGrayscale(data, width, height);
        const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
        let variance = 0;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let sum = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        sum += gray[(y + ky) * width + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
                    }
                }
                variance += sum * sum;
            }
        }

        variance /= (width - 2) * (height - 2);
        return Math.min(1, variance / 500);
    }

    // ─── Brightness: deviation from ideal mid-gray ───────────
    measureBrightness(imageData) {
        const { data } = imageData;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const avg = sum / (data.length / 4);
        return 1 - Math.abs(avg - 128) / 128;
    }

    // ─── Contrast: p5–p95 dynamic range ──────────────────────
    measureContrast(imageData) {
        const { data } = imageData;
        const histogram = new Array(256).fill(0);

        for (let i = 0; i < data.length; i += 4) {
            const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            histogram[g]++;
        }

        const total = data.length / 4;
        let p5 = 0, p95 = 0, cumulative = 0;
        for (let i = 0; i < 256; i++) {
            cumulative += histogram[i];
            if (cumulative >= total * 0.05 && p5 === 0) p5 = i;
            if (cumulative >= total * 0.95 && p95 === 0) p95 = i;
        }

        return Math.min(1, (p95 - p5) / 200);
    }

    // ─── Noise: 10th-percentile block variance ───────────────
    measureNoise(imageData) {
        const { data, width, height } = imageData;
        const gray = this._toGrayscale(data, width, height);
        const block = 8;
        const variances = [];

        for (let by = 0; by < height - block; by += block) {
            for (let bx = 0; bx < width - block; bx += block) {
                let sum = 0, sumSq = 0;
                for (let y = 0; y < block; y++) {
                    for (let x = 0; x < block; x++) {
                        const v = gray[(by + y) * width + (bx + x)];
                        sum += v;
                        sumSq += v * v;
                    }
                }
                const n = block * block;
                variances.push((sumSq - (sum * sum) / n) / n);
            }
        }

        variances.sort((a, b) => a - b);
        const noiseEst = variances[Math.floor(variances.length * 0.1)] || 0;
        return Math.max(0, 1 - noiseEst / 20);
    }

    // ─── Skew: dominant Hough angle vs 0°/90° ────────────────
    measureSkew(imageData) {
        const { data, width, height } = imageData;
        const gray = this._toGrayscale(data, width, height);
        const edges = this._sobelEdges(gray, width, height);

        const angleVotes = new Map();
        const threshold = 100;
        for (let y = 0; y < height; y += 2) {
            for (let x = 0; x < width; x += 2) {
                if (edges[y * width + x] <= threshold) continue;
                for (let theta = -45; theta <= 45; theta++) {
                    const rho = x * Math.cos(theta * Math.PI / 180) + y * Math.sin(theta * Math.PI / 180);
                    const key = `${theta}_${Math.round(rho / 10)}`;
                    angleVotes.set(key, (angleVotes.get(key) || 0) + 1);
                }
            }
        }

        const sorted = [...angleVotes.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([k]) => parseInt(k.split('_')[0]));

        const dominant = sorted[0] || 0;
        const skewDeg = Math.min(Math.abs(dominant % 90), 90 - Math.abs(dominant % 90));
        return 1 - skewDeg / 45;
    }

    // ─── Text density: adaptive threshold transition count ───
    estimateTextDensity(imageData) {
        const { data, width, height } = imageData;
        const gray = this._toGrayscale(data, width, height);
        const binary = this._adaptiveThreshold(gray, width, height);

        let transitions = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 1; x < width; x++) {
                if (binary[y * width + x] !== binary[y * width + x - 1]) transitions++;
            }
        }

        const density = transitions / (width * height);
        if (density < 0.01) return 0.3;
        if (density > 0.15) return 0.5;
        return Math.min(1, density / 0.05);
    }

    // ─── Scoring & issues ────────────────────────────────────
    calculateOverallScore(m) {
        return m.blur * 0.25 + m.brightness * 0.15 + m.contrast * 0.20 +
            m.noise * 0.15 + m.skew * 0.10 + m.textDensity * 0.15;
    }

    identifyIssues(m) {
        const issues = [];
        if (m.blur < 0.4) issues.push({ type: 'BLUR', severity: m.blur < 0.2 ? 'critical' : 'moderate', message: 'Image is blurry' });
        if (m.brightness < 0.3) issues.push({ type: 'DARK', severity: m.brightness < 0.15 ? 'critical' : 'moderate', message: 'Image is too dark' });
        if (m.brightness > 0.85) issues.push({ type: 'BRIGHT', severity: m.brightness > 0.95 ? 'critical' : 'moderate', message: 'Image is overexposed' });
        if (m.contrast < 0.3) issues.push({ type: 'LOW_CONTRAST', severity: 'moderate', message: 'Low contrast between text and background' });
        if (m.skew < 0.6) issues.push({ type: 'SKEWED', severity: m.skew < 0.3 ? 'critical' : 'moderate', message: 'Document is tilted' });
        if (m.textDensity < 0.3) issues.push({ type: 'SPARSE', severity: 'info', message: 'Limited text content detected' });
        return issues;
    }

    generateRecommendations(issues) {
        const map = {
            BLUR: 'Hold the camera steadier or move closer',
            DARK: 'Increase lighting or move to a brighter area',
            BRIGHT: 'Reduce direct light or move away from windows',
            LOW_CONTRAST: 'Ensure document is on a contrasting surface',
            SKEWED: 'Align document edges with the frame',
        };
        return [...new Set(issues.map(i => map[i.type]).filter(Boolean))];
    }

    determineAutoFixability(issues) {
        const fixable = { LOW_CONTRAST: true, DARK: true, SKEWED: true, BLUR: false, BRIGHT: false };
        return issues.every(i => i.severity !== 'critical' || fixable[i.type]);
    }

    estimateAIConfidence(m) {
        return 0.5 + (m.blur * 0.4 + m.contrast * 0.3 + m.brightness * 0.15 + m.noise * 0.15) * 0.5;
    }

    // ─── Internal helpers ────────────────────────────────────
    _toGrayscale(data, w, h) {
        const g = new Float32Array(w * h);
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            g[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        return g;
    }

    _sobelEdges(gray, w, h) {
        const edges = new Float32Array(w * h);
        const sx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                let gx = 0, gy = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const v = gray[(y + ky) * w + (x + kx)];
                        const ki = (ky + 1) * 3 + (kx + 1);
                        gx += v * sx[ki];
                        gy += v * sy[ki];
                    }
                }
                edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
            }
        }
        return edges;
    }

    _adaptiveThreshold(gray, w, h) {
        const binary = new Uint8Array(w * h);
        const block = 15, C = 10;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0, count = 0;
                for (let by = -block; by <= block; by++) {
                    for (let bx = -block; bx <= block; bx++) {
                        const ny = y + by, nx = x + bx;
                        if (ny >= 0 && ny < h && nx >= 0 && nx < w) { sum += gray[ny * w + nx]; count++; }
                    }
                }
                binary[y * w + x] = gray[y * w + x] > (sum / count - C) ? 1 : 0;
            }
        }
        return binary;
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            if (src instanceof HTMLImageElement) { resolve(src); return; }
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
}
