/**
 * Design Token Generator — dynamic CSS tokens from Context + Emotion
 * @module designTokens
 */
import { contextEngine } from './contextEngine';
import { emotionalState } from './emotionalState';

class DesignTokenGenerator {
    constructor() {
        this._ctx = contextEngine.getContext();
        this._exp = emotionalState.getExpression();
        /** @type {Set<(tokens: Object) => void>} */
        this._listeners = new Set();
        this._tokens = this._generate();

        contextEngine.subscribe((ctx) => { this._ctx = ctx; this._regenerate(); });
        emotionalState.subscribe((exp) => { this._exp = exp; this._regenerate(); });
    }

    _generate() {
        return {
            colors: this._genColors(),
            spacing: this._genSpacing(),
            radii: this._genRadii(),
            shadows: this._genShadows(),
            blur: this._genBlur(),
            typography: this._genTypography(),
        };
    }

    _genColors() {
        const { primaryHue: h, accentHue: ah, saturation: s, luminanceShift: ls, glowIntensity: gi } = this._exp;
        const isDark = this._ctx.prefersDarkMode;
        const hc = this._ctx.prefersHighContrast;
        const base = 50;
        const surf = isDark ? 8 : 95;
        const sat = hc ? Math.min(100, s * 1.3) : s;

        const c = (hue, sat, lum) => {
            const srgb = `hsl(${hue}, ${sat}%, ${lum}%)`;
            if (this._ctx.colorGamut === 'p3') {
                return { p3: `color(display-p3 ${this._hslToP3(hue, sat, lum)})`, srgb, css: srgb };
            }
            return { srgb, css: srgb };
        };

        return {
            primary: c(h, sat, base + ls),
            primaryHover: c(h, sat + 5, base + ls + 5),
            primaryActive: c(h, sat, base + ls - 5),
            accent: c(ah, sat + 10, base + 5),
            accentSubtle: c(ah, sat - 20, base - 10),
            surface: c(h, 10, surf),
            surfaceRaised: c(h, 12, isDark ? surf + 4 : surf - 4),
            surfaceOverlay: c(h, 15, isDark ? surf + 8 : surf - 8),
            textPrimary: c(0, 0, isDark ? 95 : 10),
            textSecondary: c(h, 5, isDark ? 75 : 30),
            textMuted: c(h, 8, isDark ? 55 : 50),
            textInverse: c(0, 0, isDark ? 10 : 95),
            success: c(150, 70, base),
            error: c(0, 75, base),
            warning: c(45, 80, base),
            info: c(200, 65, base),
            glow: c(h, sat, base + 20),
            shadow: c(h, 30, isDark ? 0 : 20),
        };
    }

    _hslToP3(h, s, l) {
        const c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100);
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l / 100 - c / 2;
        let r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        return `${(r + m).toFixed(3)} ${(g + m).toFixed(3)} ${(b + m).toFixed(3)}`;
    }

    _genSpacing() {
        const scale = this._ctx.prefersLargeText ? 1.15 : 1;
        const sp = (v) => ({ mobile: `${v * scale * 0.875}rem`, tablet: `${v * scale}rem`, desktop: `${v * scale * 1.125}rem`, css: `${v * scale}rem` });
        return { xs: sp(0.25), sm: sp(0.5), md: sp(1), lg: sp(1.5), xl: sp(2), xxl: sp(3) };
    }

    _genRadii() {
        const s = this._ctx.prefersHighContrast ? 1.2 : 1;
        return { sm: `${0.25 * s}rem`, md: `${0.5 * s}rem`, lg: `${0.75 * s}rem`, xl: `${1 * s}rem`, full: '9999px' };
    }

    _genShadows() {
        const { glowIntensity: gi, primaryHue: h, saturation: s } = this._exp;
        const isDark = this._ctx.prefersDarkMode;
        const op = this._ctx.prefersHighContrast ? 0.1 : (isDark ? 0.5 : 0.15);
        const sc = `hsla(${h}, ${s * 0.5}%, ${isDark ? 0 : 20}%, ${op})`;
        const gc = `hsla(${h}, ${s}%, 50%, ${gi})`;
        return {
            sm: `0 1px 2px ${sc}`,
            md: `0 4px 6px -1px ${sc}, 0 2px 4px -2px ${sc}`,
            lg: `0 10px 15px -3px ${sc}, 0 4px 6px -4px ${sc}`,
            glow: `0 0 20px ${gc}, 0 0 40px ${gc}`,
            inner: `inset 0 2px 4px ${sc}`,
        };
    }

    _genBlur() {
        const b = this._exp.blurAmount;
        const s = this._ctx.performanceTier === 'high' ? 1 : 0.5;
        return { sm: `${b * 0.25 * s}px`, md: `${b * 0.5 * s}px`, lg: `${b * s}px`, xl: `${b * 1.5 * s}px` };
    }

    _genTypography() {
        const s = this._ctx.prefersLargeText ? 1.125 : 1;
        return {
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontFamilyMono: '"JetBrains Mono", "Fira Code", Consolas, monospace',
            fontSize: { xs: `${0.75 * s}rem`, sm: `${0.875 * s}rem`, base: `${1 * s}rem`, lg: `${1.125 * s}rem`, xl: `${1.25 * s}rem`, '2xl': `${1.5 * s}rem`, '3xl': `${1.875 * s}rem`, '4xl': `${2.25 * s}rem` },
            fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
            lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
        };
    }

    _regenerate() {
        this._tokens = this._generate();
        this._listeners.forEach((fn) => fn(this._tokens));
    }

    getTokens() { return this._tokens; }

    subscribe(fn) {
        this._listeners.add(fn);
        fn(this._tokens);
        return () => this._listeners.delete(fn);
    }

    /** Convert to CSS custom properties */
    toCSSProperties() {
        const t = this._tokens;
        const props = {};
        for (const [name, color] of Object.entries(t.colors)) {
            props[`--color-${name.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = color.css;
        }
        for (const [name, sp] of Object.entries(t.spacing)) {
            props[`--space-${name}`] = sp.css;
        }
        for (const [name, r] of Object.entries(t.radii)) {
            props[`--radius-${name}`] = r;
        }
        for (const [name, s] of Object.entries(t.shadows)) {
            props[`--shadow-${name}`] = s;
        }
        for (const [name, b] of Object.entries(t.blur)) {
            props[`--blur-${name}`] = b;
        }
        props['--font-family'] = t.typography.fontFamily;
        props['--font-family-mono'] = t.typography.fontFamilyMono;
        for (const [name, sz] of Object.entries(t.typography.fontSize)) {
            props[`--font-size-${name}`] = sz;
        }
        return props;
    }
}

export const designTokens = new DesignTokenGenerator();
