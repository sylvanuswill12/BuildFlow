import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AnimatedReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : 0.42,
        delay: reduced ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export function GlassPanel({
  children,
  className,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={cn("bf-glass rounded-2xl", glow && "bf-glow", className)}>
      {children}
    </div>
  );
}

export function AnimatedMetric({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className={className}
      initial={
        reduced ? false : { opacity: 0, scale: 0.92, filter: "blur(5px)" }
      }
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: reduced ? 0 : 0.35, ease: "easeOut" }}
    >
      {value}
    </motion.span>
  );
}

export function AmbientBackground() {
  const reduced = useReducedMotion();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-0 overflow-hidden"
    >
      <motion.div
        className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-blue-600/[0.08] blur-[120px]"
        animate={
          reduced
            ? undefined
            : { x: [0, 35, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-56 right-[-8rem] h-[38rem] w-[38rem] rounded-full bg-violet-600/[0.08] blur-[140px]"
        animate={
          reduced
            ? undefined
            : { x: [0, -28, 0], y: [0, -24, 0], scale: [1, 1.1, 1] }
        }
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5,
        }}
      />
      <div className="absolute inset-0 bf-grid-pointer opacity-30" />
    </div>
  );
}
