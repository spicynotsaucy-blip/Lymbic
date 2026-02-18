import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '../context/OnboardingContext';
import WizardStep1 from '../components/WizardStep1';
import WizardStep2 from '../components/WizardStep2';
import WizardStep3 from '../components/WizardStep3';
import WizardStep4 from '../components/WizardStep4';

const TOTAL_STEPS = 4;

export default function OnboardingWizard() {
    const [step, setStep] = useState(1);
    const navigate = useNavigate();

    const nextStep = () => {
        if (step < TOTAL_STEPS) {
            setStep(step + 1);
        } else {
            navigate('/grade');
        }
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const progress = (step / TOTAL_STEPS) * 100;

    const stepVariants = {
        enter: { opacity: 0, x: 40 },
        center: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -40 },
    };

    const renderStep = () => {
        switch (step) {
            case 1: return <WizardStep1 key="s1" onNext={nextStep} />;
            case 2: return <WizardStep2 key="s2" onNext={nextStep} />;
            case 3: return <WizardStep3 key="s3" onNext={nextStep} />;
            case 4: return <WizardStep4 key="s4" onNext={nextStep} />;
            default: return null;
        }
    };

    return (
        <motion.div
            className="screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ justifyContent: 'flex-start', paddingTop: '24px' }}
        >
            {/* Progress Bar */}
            <div className="progress-bar">
                <motion.div
                    className="progress-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
            </div>

            {/* Step Indicator */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '32px',
                marginTop: '16px',
                alignItems: 'center',
            }}>
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            width: i + 1 === step ? 24 : 8,
                            backgroundColor: i + 1 <= step ? 'var(--lymbic-purple)' : 'var(--surface-card)',
                        }}
                        transition={{ duration: 0.3 }}
                        style={{ height: 8, borderRadius: 4 }}
                    />
                ))}
            </div>

            {/* Step Content */}
            <div className="screen-content" style={{ flex: 1, justifyContent: 'center' }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}
                    >
                        {renderStep()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Back Button */}
            {step > 1 && (
                <motion.button
                    className="btn-secondary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={prevStep}
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '24px',
                        padding: '10px 20px',
                        fontSize: '0.9rem',
                    }}
                >
                    Back
                </motion.button>
            )}
        </motion.div>
    );
}
