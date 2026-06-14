import type { CSSProperties } from "react";
import type { Area } from "react-easy-crop";

/** Maps react-easy-crop percent area to an absolutely positioned image preview. */
export function cropAreaToImageStyle(crop: Area): CSSProperties {
  const safeWidth = crop.width || 1;
  const safeHeight = crop.height || 1;

  return {
    position: "absolute",
    left: `${(-crop.x / safeWidth) * 100}%`,
    top: `${(-crop.y / safeHeight) * 100}%`,
    width: `${(100 / safeWidth) * 100}%`,
    height: `${(100 / safeHeight) * 100}%`,
    maxWidth: "none",
  };
}
