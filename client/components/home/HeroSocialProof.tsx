import { motion } from "framer-motion";

type SocialAvatar = {
  name: string;
  imageUrl: string;
};

const SOCIAL_AVATARS: SocialAvatar[] = [
  {
    name: "Carlos Rivera",
    imageUrl:
      "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50c?w=80&h=80&fit=crop&auto=format",
  },
  {
    name: "Mariana Soto",
    imageUrl:
      "https://images.unsplash.com/photo-1594381898411-8465977d47b7?w=80&h=80&fit=crop&auto=format",
  },
  {
    name: "Julia Martinez",
    imageUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&auto=format",
  },
];

interface HeroSocialProofProps {
  activeAthletes: number;
  trustedLabel: string;
  worldwideLabel: string;
}

const formatOverflowCount = (total: number): string => {
  const remaining = Math.max(0, total - SOCIAL_AVATARS.length);
  if (remaining >= 1_000_000) return `${Math.round(remaining / 1_000_000)}M`;
  if (remaining >= 10_000) return `${Math.round(remaining / 1_000)}K`;
  if (remaining >= 1_000) return `${(remaining / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return remaining > 0 ? String(remaining) : "";
};

const getInitials = (name: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "AH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const fallbackTone = (name: string): string => {
  const code = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return code % 2 === 0 ? "from-cyan/35 to-blue-electric/30" : "from-blue-electric/30 to-purple-accent/30";
};

export default function HeroSocialProof({
  activeAthletes,
  trustedLabel,
  worldwideLabel,
}: HeroSocialProofProps) {
  const overflowLabel = formatOverflowCount(activeAthletes);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.85 }}
      className="flex flex-row items-center gap-2.5 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-800/60 sm:border-gray-800/80 min-w-0"
    >
      <div className="flex -space-x-2 sm:-space-x-3 shrink-0">
        {SOCIAL_AVATARS.map((avatar, i) => (
          <motion.div
            key={avatar.name}
            initial={{ opacity: 0, x: -12, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.9 + i * 0.1, type: "spring", stiffness: 200 }}
            className="relative"
          >
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full ring-2 ring-bg-dark overflow-hidden">
              <img
                src={avatar.imageUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                }}
              />
              <div
                className={`w-full h-full flex items-center justify-center text-[9px] sm:text-[11px] font-bold text-white bg-gradient-to-br ${fallbackTone(avatar.name)}`}
              >
                {getInitials(avatar.name)}
              </div>
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
        {overflowLabel ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
          className="w-7 h-7 sm:w-9 sm:h-9 rounded-full ring-2 ring-bg-dark bg-surface-dark/90 backdrop-blur-sm flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-cyan border border-cyan/30"
        >
          +{overflowLabel}
        </motion.div>
        ) : null}
      </div>
      <p className="text-xs sm:text-sm text-gray-400 leading-snug min-w-0">
        <span className="text-cyan font-semibold">{trustedLabel}</span> {worldwideLabel}
      </p>
    </motion.div>
  );
}
