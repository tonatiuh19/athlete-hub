const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug("[AthleteHub]", ...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info("[AthleteHub]", ...args);
  },
  warn: (...args: unknown[]) => console.warn("[AthleteHub]", ...args),
  error: (...args: unknown[]) => console.error("[AthleteHub]", ...args),
};
