// ═══════════════════════════════════════════════════════════
//  SEMANTIC FINGERPRINTER — Content-aware deduplication
// ═══════════════════════════════════════════════════════════

export class SemanticFingerprinter {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    async generate(imageSource) {
        const img = await this._loadImage(imageSource);
        const perceptual = this._perceptualHash(img);
        const structural = this._structuralHash(img);
        const color = this._colorHash(img);

        return {
            perceptual,
            structural,
            color,
            combined: `${perceptual}|${structural}|${color}`,
            timestamp: Date.now(),
        };
    }

    compare(hashA, hashB) {
        return (
            this._hammingDistance(hashA.perceptual, hashB.perceptual) * 0.50 +
            this._stringDistance(hashA.structural, hashB.structural) * 0.35 +
            this._hammingDistance(hashA.color, hashB.color) * 0.15
        );
    }

    // ─── Perceptual hash (DCT-based pHash) ───────────────────
    _perceptualHash(img, size = 16) {
        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx.drawImage(img, 0, 0, size, size);
        const gray = this._grayscale(this.ctx.getImageData(0, 0, size, size).data, size, size);

        // 2-D DCT
        const dct = new Float32Array(size * size);
        const c = n => (n === 0 ? 1 / Math.sqrt(2) : 1);
        for (let v = 0; v < size; v++) {
            for (let u = 0; u < size; u++) {
                let sum = 0;
                for (let y = 0; y < size; y++)
                    for (let x = 0; x < size; x++)
                        sum += gray[y * size + x] *
                            Math.cos((2 * x + 1) * u * Math.PI / (2 * size)) *
                            Math.cos((2 * y + 1) * v * Math.PI / (2 * size));
                dct[v * size + u] = 0.25 * c(u) * c(v) * sum;
            }
        }

        // Take low-freq 8×8
        const low = [];
        for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++)
                low.push(dct[y * size + x]);

        const median = this._median(low.slice(1));
        let bits = '';
        for (let i = 1; i < low.length; i++) bits += low[i] > median ? '1' : '0';
        return this._binToHex(bits);
    }

    // ─── Structural hash (ink density grid) ──────────────────
    _structuralHash(img) {
        this.canvas.width = 32;
        this.canvas.height = 32;
        this.ctx.drawImage(img, 0, 0, 32, 32);
        const data = this.ctx.getImageData(0, 0, 32, 32).data;
        const binary = this._binarize(data, 32, 32);
        const cell = 8, grid = [];

        for (let gy = 0; gy < 4; gy++) {
            for (let gx = 0; gx < 4; gx++) {
                let ink = 0;
                for (let y = 0; y < cell; y++)
                    for (let x = 0; x < cell; x++)
                        ink += binary[(gy * cell + y) * 32 + (gx * cell + x)];
                const d = ink / (cell * cell);
                grid.push(d > 0.5 ? 'H' : d > 0.2 ? 'M' : d > 0.05 ? 'L' : 'E');
            }
        }
        return grid.join('');
    }

    // ─── Color hash (hue buckets) ────────────────────────────
    _colorHash(img) {
        this.canvas.width = 8;
        this.canvas.height = 8;
        this.ctx.drawImage(img, 0, 0, 8, 8);
        const { data } = this.ctx.getImageData(0, 0, 8, 8);
        const buckets = new Array(12).fill(0);

        for (let i = 0; i < data.length; i += 4) {
            const { h, s, v } = this._rgbToHsv(data[i], data[i + 1], data[i + 2]);
            if (s > 0.2 && v > 0.2) buckets[Math.floor(h / 30)]++;
        }
        return buckets.map(b => b > 3 ? '1' : '0').join('');
    }

    // ─── Distance helpers ────────────────────────────────────
    _hammingDistance(hexA, hexB) {
        const a = this._hexToBin(hexA), b = this._hexToBin(hexB);
        const len = Math.max(a.length, b.length);
        let same = 0;
        for (let i = 0; i < len; i++) if (a[i] === b[i]) same++;
        return same / len;
    }

    _stringDistance(a, b) {
        let same = 0;
        for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) same++;
        return same / Math.max(a.length, b.length);
    }

    // ─── Image helpers ───────────────────────────────────────
    _grayscale(data, w, h) {
        const g = new Float32Array(w * h);
        for (let i = 0, j = 0; i < data.length; i += 4, j++)
            g[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        return g;
    }

    _binarize(data, w, h) {
        const g = this._grayscale(data, w, h);
        const t = this._otsuThreshold(g);
        return g.map(v => (v > t ? 0 : 1));
    }

    _otsuThreshold(data) {
        const hist = new Array(256).fill(0);
        for (const v of data) hist[Math.round(v)]++;
        const total = data.length;
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * hist[i];

        let sumB = 0, wB = 0, max = 0, threshold = 0;
        for (let i = 0; i < 256; i++) {
            wB += hist[i];
            if (wB === 0) continue;
            const wF = total - wB;
            if (wF === 0) break;
            sumB += i * hist[i];
            const between = wB * wF * Math.pow(sumB / wB - (sum - sumB) / wF, 2);
            if (between > max) { max = between; threshold = i; }
        }
        return threshold;
    }

    _rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        let h = 0;
        if (d !== 0) {
            if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
            else if (mx === g) h = ((b - r) / d + 2) * 60;
            else h = ((r - g) / d + 4) * 60;
        }
        return { h, s: mx === 0 ? 0 : d / mx, v: mx };
    }

    _median(arr) {
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    _binToHex(bin) {
        let hex = '';
        for (let i = 0; i < bin.length; i += 4) hex += parseInt(bin.substr(i, 4), 2).toString(16);
        return hex;
    }

    _hexToBin(hex) {
        return hex.split('').map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
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
