import { motion } from "framer-motion";

/** Ambient brand glow orbs behind hero content */
export default function HeroGlowLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]" aria-hidden>
      <motion.div
        className="absolute -top-[20%] left-[10%] w-[min(520px,70vw)] h-[min(520px,70vw)] rounded-full bg-primary/20 blur-[100px]"
        animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[30%] -right-[10%] w-[min(400px,55vw)] h-[min(400px,55vw)] rounded-full bg-accent/15 blur-[90px]"
        animate={{ opacity: [0.2, 0.4, 0.2], x: [0, -20, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(5,7,13,0.35)_50%,#05070d_100%)]" />
    </div>
  );
}
