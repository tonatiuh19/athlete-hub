import { motion } from "framer-motion";

/** Decorative ambient layer — orbs, grid, speed arcs (hero art direction). */
export default function HeroArtOverlay() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Soft grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,229,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 60% at 20% 50%, black, transparent)",
        }}
      />

      {/* Floating orbs */}
      <motion.div
        className="absolute -top-16 -left-20 w-72 h-72 rounded-full bg-cyan/20 blur-[100px]"
        animate={{ x: [0, 24, 0], y: [0, -18, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -left-10 w-48 h-48 rounded-full bg-purple-accent/15 blur-[80px]"
        animate={{ x: [0, -16, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute bottom-1/4 left-1/4 w-32 h-32 rounded-full bg-blue-electric/20 blur-[60px]"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Speed arc SVG */}
      <svg
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[min(420px,100%)] h-auto max-h-[420px] opacity-[0.12]"
        viewBox="0 0 420 420"
        fill="none"
      >
        <motion.path
          d="M 20 210 Q 120 80 210 210 T 400 210"
          stroke="url(#heroArcGrad)"
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.2, ease: "easeOut", delay: 0.4 }}
        />
        <motion.path
          d="M 40 240 Q 140 120 230 240 T 420 240"
          stroke="url(#heroArcGrad)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="4 8"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 2.6, ease: "easeOut", delay: 0.7 }}
        />
        <defs>
          <linearGradient id="heroArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0" />
            <stop offset="50%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#7C4DFF" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Particle field */}
      {[
        { top: "18%", left: "8%", delay: 0 },
        { top: "42%", left: "22%", delay: 0.4 },
        { top: "68%", left: "12%", delay: 0.8 },
        { top: "30%", left: "35%", delay: 1.2 },
        { top: "55%", left: "5%", delay: 0.6 },
      ].map((p, i) => (
        <motion.span
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,229,255,0.8)]"
          style={{ top: p.top, left: p.left }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.4, 0.8] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: p.delay }}
        />
      ))}

      {/* Vertical accent rail */}
      <motion.div
        className="absolute left-0 top-[12%] bottom-[12%] w-px bg-gradient-to-b from-transparent via-cyan/50 to-transparent"
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
        style={{ transformOrigin: "top" }}
      />
    </div>
  );
}
