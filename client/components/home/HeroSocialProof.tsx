import { motion } from "framer-motion";

const AVATAR_URLS = [
  "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50c?w=80&h=80&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1594381898411-8465977d47b7?w=80&h=80&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&auto=format",
];

interface HeroSocialProofProps {
  trustedLabel: string;
  worldwideLabel: string;
}

export default function HeroSocialProof({
  trustedLabel,
  worldwideLabel,
}: HeroSocialProofProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.85 }}
      className="flex flex-row items-center gap-2.5 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-800/60 sm:border-gray-800/80 min-w-0"
    >
      <div className="flex -space-x-2 sm:-space-x-3 shrink-0">
        {AVATAR_URLS.map((url, i) => (
          <motion.div
            key={url}
            initial={{ opacity: 0, x: -12, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.9 + i * 0.1, type: "spring", stiffness: 200 }}
            className="relative"
          >
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full ring-2 ring-bg-dark overflow-hidden">
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
            {i === 0 && (
              <motion.span
                className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-success ring-2 ring-bg-dark"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
          className="w-7 h-7 sm:w-9 sm:h-9 rounded-full ring-2 ring-bg-dark bg-surface-dark/90 backdrop-blur-sm flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-cyan border border-cyan/30"
        >
          +K
        </motion.div>
      </div>
      <p className="text-xs sm:text-sm text-gray-400 leading-snug min-w-0">
        <span className="text-cyan font-semibold">{trustedLabel}</span> {worldwideLabel}
      </p>
    </motion.div>
  );
}
