/**
 * useAdaptiveUI — main React hook for the Adaptive Intelligence UI stack
 * @module useAdaptiveUI
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { contextEngine } from '../lib/contextEngine';
import { emotionalState } from '../lib/emotionalState';
import { adaptiveMotion } from '../lib/adaptiveMotion';
import { designTokens } from '../lib/designTokens';
import { cognitiveState } from '../intelligence/cognitiveState';

/**
 * @returns {{
 *   context: import('../lib/contextEngine').UIContext,
 *   emotion: import('../lib/emotionalState').EmotionalState,
 *   expression: import('../lib/emotionalState').EmotionalExpression,
 *   setEmotion: (state: import('../lib/emotionalState').EmotionalState, opts?: Object) => void,
 *   motion: ReturnType<typeof adaptiveMotion.getPresets>,
 *   tokens: ReturnType<typeof designTokens.getTokens>,
 *   cognitive: import('../intelligence/cognitiveState').CognitiveProfile,
 *   cssProperties: Object,
 *   canUseGlassmorphism: boolean,
 *   canUseParticles: boolean,
 *   canUseBlur: boolean,
 *   shouldReduceMotion: boolean,
 * }}
 */
export function useAdaptiveUI() {
    const [context, setContext] = useState(() => contextEngine.getContext());
    const [expression, setExpression] = useState(() => emotionalState.getExpression());
    const [emotion, setEmotionState] = useState(() => emotionalState.getState());
    const [tokens, setTokens] = useState(() => designTokens.getTokens());
    const [cognitive, setCognitive] = useState(() => cognitiveState.getProfile());

    useEffect(() => {
        const unsubs = [
            contextEngine.subscribe(setContext),
            emotionalState.subscribe((exp, state) => {
                setExpression(exp);
                setEmotionState(state);
            }),
            designTokens.subscribe(setTokens),
            cognitiveState.subscribe(setCognitive),
        ];
        return () => unsubs.forEach((fn) => fn());
    }, []);

    const setEmotion = useCallback((state, opts) => {
        emotionalState.transitionTo(state, opts);
    }, []);

    const motion = useMemo(() => adaptiveMotion.getPresets(), [expression]);

    const cssProperties = useMemo(() => ({
        ...emotionalState.toCSSProperties(),
        ...designTokens.toCSSProperties(),
    }), [expression, tokens]);

    const canUseGlassmorphism = context.performanceTier !== 'minimal' && context.performanceTier !== 'low';
    const canUseParticles = context.performanceTier === 'high' && context.motionPreference === 'full';
    const canUseBlur = context.performanceTier !== 'minimal';
    const shouldReduceMotion = context.motionPreference !== 'full';

    return {
        context,
        emotion,
        expression,
        setEmotion,
        motion,
        tokens,
        cognitive,
        cssProperties,
        canUseGlassmorphism,
        canUseParticles,
        canUseBlur,
        shouldReduceMotion,
    };
}
