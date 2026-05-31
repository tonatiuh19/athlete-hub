import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export const HERO_VIDEO_URL =
  "https://disruptinglabs.com/data/athlete-hub/assets/videos/hero_athlete-hub.mp4";

export const HERO_POSTER_URL =
  "https://images.unsplash.com/photo-1571008887538-b36bb08c457a?w=1920&q=80&auto=format&fit=crop";

export default function HeroVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onCanPlay = () => setVideoReady(true);
    const onError = () => setVideoFailed(true);

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);

    video.play().catch(() => setVideoFailed(true));

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
    };
  }, []);

  const showPoster = videoFailed || !videoReady;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <img
        src={HERO_POSTER_URL}
        alt=""
        aria-hidden
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          showPoster ? "opacity-100" : "opacity-0"
        }`}
      />
      {!videoFailed && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={HERO_POSTER_URL}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src={HERO_VIDEO_URL} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-dark/85 via-bg-dark/70 to-bg-dark" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg-dark/92 via-bg-dark/45 to-bg-dark/75" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(0,229,255,0.14),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(124,77,255,0.1),transparent_55%)]" />

      {/* Animated light sweep */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "linear-gradient(105deg, transparent 40%, rgba(0,229,255,0.08) 50%, transparent 60%)",
          backgroundSize: "200% 100%",
        }}
        animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      {/* Film grain */}
      <div className="hero-film-grain absolute inset-0 opacity-[0.035] mix-blend-overlay pointer-events-none" />
    </div>
  );
}
