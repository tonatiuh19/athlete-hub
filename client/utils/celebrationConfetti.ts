import confetti from "canvas-confetti";

const BRAND_COLORS = ["#00E5FF", "#34D399", "#3B82F6", "#FFFFFF", "#818CF8"];

function fire(options: confetti.Options) {
  void confetti({
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
    zIndex: 9999,
    ...options,
  });
}

/** Multi-burst confetti for registration / checkout success moments. */
export function fireRegistrationCelebration() {
  const duration = 2400;
  const end = Date.now() + duration;

  fire({
    particleCount: 90,
    spread: 80,
    origin: { x: 0.5, y: 0.45 },
    startVelocity: 38,
    scalar: 1.05,
    ticks: 180,
  });

  const sideCannons = () => {
    fire({
      particleCount: 4,
      angle: 62,
      spread: 58,
      origin: { x: 0, y: 0.62 },
      startVelocity: 42,
      ticks: 200,
    });
    fire({
      particleCount: 4,
      angle: 118,
      spread: 58,
      origin: { x: 1, y: 0.62 },
      startVelocity: 42,
      ticks: 200,
    });

    if (Date.now() < end) {
      requestAnimationFrame(sideCannons);
    }
  };

  requestAnimationFrame(sideCannons);

  window.setTimeout(() => {
    fire({
      particleCount: 70,
      spread: 110,
      origin: { x: 0.5, y: 0.28 },
      startVelocity: 22,
      gravity: 0.9,
      ticks: 160,
      scalar: 0.95,
    });
  }, 350);
}
