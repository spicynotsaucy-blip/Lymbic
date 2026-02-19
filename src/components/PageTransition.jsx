/**
 * PageTransition — Spring-based page wrapper with staggered children
 * @module PageTransition
 */
import { motion } from 'framer-motion';

const pageVariants = {
    initial: {
        opacity: 0,
        y: 30,
        scale: 0.98,
    },
    enter: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
    exit: {
        opacity: 0,
        y: -20,
        scale: 0.98,
        transition: {
            duration: 0.35,
            ease: [0.4, 0, 1, 1],
        },
    },
};

export const childVariants = {
    initial: { opacity: 0, y: 20 },
    enter: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
    exit: { opacity: 0, y: -10 },
};

export default function PageTransition({ children, className = '', style = {} }) {
    return (
        <motion.div
            className={`screen ${className}`}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            style={style}
        >
            {children}
        </motion.div>
    );
}
