import { useEffect, useState } from "react";
import {
  HERO_TITLE_SENTINEL_ID,
  HOME_NAV_HEIGHT_PX,
} from "./homeNavConstants";

export interface HomeNavScrollState {
  /** True once the hero headline has scrolled under the navbar */
  solid: boolean;
  /** 0–1 page scroll progress */
  scrollProgress: number;
}

export function useHomeNavScroll(
  sentinelId = HERO_TITLE_SENTINEL_ID,
): HomeNavScrollState {
  const [state, setState] = useState<HomeNavScrollState>({
    solid: false,
    scrollProgress: 0,
  });

  useEffect(() => {
    const sentinel = document.getElementById(sentinelId);

    const update = () => {
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress =
        docHeight > 0 ? Math.min(1, window.scrollY / docHeight) : 0;

      let solid = window.scrollY > 24;
      if (sentinel) {
        solid = sentinel.getBoundingClientRect().top <= HOME_NAV_HEIGHT_PX;
      }

      setState({ solid, scrollProgress });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sentinelId]);

  return state;
}
