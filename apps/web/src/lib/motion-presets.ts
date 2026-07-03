import type { Variants, Transition } from "framer-motion";

export const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const easeOutQuart: [number, number, number, number] = [0.25, 1, 0.5, 1];
export const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export const fadeUpSubtle: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
};

export const modalEntrance: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 4 },
};

export const staggerContainer = (
  delayChildren = 0,
  staggerChildren = 0.06,
): Variants => ({
  hidden: {},
  visible: {
    transition: { delayChildren, staggerChildren },
  },
});

export const transitionFast: Transition = { duration: 0.16, ease: easeOut };
export const transitionBase: Transition = { duration: 0.24, ease: easeOutQuart };
export const transitionEntrance: Transition = { duration: 0.4, ease: easeOutExpo };

export const viewportOnce = { once: true, margin: "-40px" } as const;
