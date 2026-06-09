import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export const HERO_VIDEO_URL =
  "https://disruptinglabs.com/data/athlete-hub/assets/videos/16097957_960_540_24fps.mp4";

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
      <div className="absolute inset-0 hero-ken-burns">
        <img
          src={HERO_POSTER_URL}
          alt=""
          aria-hidden
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
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
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
              videoReady ? "opacity-100" : "opacity-0"
            }`}
          >
            <source src={HERO_VIDEO_URL} type="video/mp4" />
          </video>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-triboo-black/75 via-triboo-black/55 to-triboo-black" />
      <div className="absolute inset-0 bg-gradient-to-r from-triboo-black/95 via-triboo-black/35 to-triboo-black/80" />
      <div className="absolute inset-0 cinematic-vignette" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_30%,rgba(255,90,31,0.18),transparent_45%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_20%,rgba(242,60,53,0.12),transparent_50%)]" />

      <motion.div
        className="absolute inset-0 opacity-25"
        style={{
          background:
            "linear-gradient(105deg, transparent 38%, rgba(255,90,31,0.1) 50%, transparent 62%)",
          backgroundSize: "200% 100%",
        }}
        animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      <div className="hero-film-grain absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none" />
    </div>
  );
}
