// ═══════════════════════════════════════════════════════════
//  IMAGE ENHANCER — Auto-fix quality issues before AI analysis
// ═══════════════════════════════════════════════════════════

export class ImageEnhancer {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    async enhance(imageSource, qualityAnalysis) {
        const img = await this._loadImage(imageSource);
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        let imageData = this.ctx.getImageData(0, 0, img.width, img.height);
        const appliedFixes = [];

        for (const issue of qualityAnalysis.issues) {
            switch (issue.type) {
                case 'DARK':
                    imageData = this._adjustBrightness(imageData, 1.3);
                    appliedFixes.push('brightness_boost');
                    break;
                case 'LOW_CONTRAST':
                    imageData = this._enhanceContrast(imageData);
                    appliedFixes.push('contrast_enhancement');
                    break;
                case 'SKEWED':
                    appliedFixes.push('skew_noted');
                    break;
            }
        }

        if (qualityAnalysis.metrics.blur < 0.7) {
            imageData = this._sharpen(imageData);
            appliedFixes.push('sharpening');
        }

        imageData = this._documentEnhance(imageData);
        appliedFixes.push('document_optimization');

        this.ctx.putImageData(imageData, 0, 0);

        return {
            enhanced: this.canvas.toDataURL('image/jpeg', 0.92),
            appliedFixes,
            originalQuality: qualityAnalysis.overallScore,
            estimatedImprovement: this._estimateImprovement(qualityAnalysis, appliedFixes),
        };
    }

    // ─── Brightness ──────────────────────────────────────────
    _adjustBrightness(imageData, factor) {
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.min(255, d[i] * factor);
            d[i + 1] = Math.min(255, d[i + 1] * factor);
            d[i + 2] = Math.min(255, d[i + 2] * factor);
        }
        return imageData;
    }

    // ─── Histogram contrast stretch ──────────────────────────
    _enhanceContrast(imageData) {
        const d = imageData.data;
        const hist = new Array(256).fill(0);
        for (let i = 0; i < d.length; i += 4) {
            hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
        }
        const total = d.length / 4;
        let low = 0, high = 255, cum = 0;
        for (let i = 0; i < 256; i++) {
            cum += hist[i];
            if (cum >= total * 0.02 && low === 0) low = i;
            if (cum >= total * 0.98) { high = i; break; }
        }
        const range = high - low || 1;
        for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.min(255, Math.max(0, (d[i] - low) * 255 / range));
            d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - low) * 255 / range));
            d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - low) * 255 / range));
        }
        return imageData;
    }

    // ─── Unsharp mask ────────────────────────────────────────
    _sharpen(imageData) {
        const { data, width, height } = imageData;
        const out = new Uint8ClampedArray(data);
        const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++)
                        for (let kx = -1; kx <= 1; kx++)
                            sum += data[((y + ky) * width + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
                    out[(y * width + x) * 4 + c] = Math.min(255, Math.max(0, sum));
                }
            }
        }
        imageData.data.set(out);
        return imageData;
    }

    // ─── Document-specific sigmoid curve ─────────────────────
    _documentEnhance(imageData) {
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            let factor;
            if (gray < 128) factor = Math.pow(gray / 128, 1.2) * 128 / (gray || 1);
            else factor = (255 - Math.pow((255 - gray) / 127, 1.2) * 127) / (gray || 1);
            factor = factor || 1;
            d[i] = Math.min(255, d[i] * factor);
            d[i + 1] = Math.min(255, d[i + 1] * factor);
            d[i + 2] = Math.min(255, d[i + 2] * factor);
        }
        return imageData;
    }

    _estimateImprovement(analysis, fixes) {
        let imp = 0;
        if (fixes.includes('brightness_boost')) imp += (1 - analysis.metrics.brightness) * 0.3;
        if (fixes.includes('contrast_enhancement')) imp += (1 - analysis.metrics.contrast) * 0.4;
        if (fixes.includes('sharpening')) imp += (1 - analysis.metrics.blur) * 0.2;
        return Math.min(0.3, imp);
    }

    _loadImage(src) {
        return new Promise((resolve, reject) => {
            if (src instanceof HTMLImageElement) { resolve(src); return; }
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
}
