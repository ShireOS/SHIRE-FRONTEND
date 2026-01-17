import type { Variants } from 'framer-motion'

// Panel animations
export const panelVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.3 }
  }
}

// Card stack stagger
export const cardStackVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
}

export const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    x: 100,
    transition: { duration: 0.25 }
  }
}

// Popover
export const popoverVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 }
  }
}

// Activity feed item
export const activityItemVariants: Variants = {
  hidden: { opacity: 0, x: 50, height: 0 },
  visible: {
    opacity: 1,
    x: 0,
    height: 'auto',
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1],
      height: { duration: 0.25 }
    }
  },
  exit: {
    opacity: 0,
    x: -20,
    height: 0,
    transition: { duration: 0.2 }
  }
}

// Carousel
export const carouselVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    transition: { duration: 0.3 }
  })
}

// Table state change
export const tableStateVariants: Variants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.08, 1],
    transition: { duration: 0.3 }
  },
  seated: {
    scale: [1, 1.15, 1],
    transition: {
      duration: 0.5,
      times: [0, 0.4, 1],
      ease: [0.16, 1, 0.3, 1]
    }
  }
}

// Modal
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 }
  }
}

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 10,
    transition: { duration: 0.2 }
  }
}

// Pulse animation for live indicator
export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.5, 1],
    opacity: [1, 0.5, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
}

// Success glow
export const glowVariants: Variants = {
  idle: {
    boxShadow: '0 0 0 rgba(52, 199, 89, 0)'
  },
  glow: {
    boxShadow: [
      '0 0 0 rgba(52, 199, 89, 0)',
      '0 0 30px rgba(52, 199, 89, 0.6)',
      '0 0 0 rgba(52, 199, 89, 0)'
    ],
    transition: { duration: 0.8 }
  }
}
