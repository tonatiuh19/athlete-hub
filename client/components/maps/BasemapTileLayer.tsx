import { useEffect, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { logger } from "@/utils/logger";
import {
  CARTO_TILE_ATTRIBUTION,
  CARTO_VOYAGER_TILE_URL,
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_URL,
} from "@/components/maps/LeafletMapHelpers";

interface BasemapTileLayerProps {
  /** Label for dev console traces */
  traceLabel?: string;
}

/** Carto Voyager with OpenStreetMap fallback if tiles fail. */
export default function BasemapTileLayer({ traceLabel = "map" }: BasemapTileLayerProps) {
  const [useFallback, setUseFallback] = useState(false);
  const url = useFallback ? OSM_TILE_URL : CARTO_VOYAGER_TILE_URL;
  const attribution = useFallback ? OSM_TILE_ATTRIBUTION : CARTO_TILE_ATTRIBUTION;

  return (
    <TileLayer
      key={url}
      attribution={attribution}
      url={url}
      subdomains={useFallback ? "abc" : "abcd"}
      maxZoom={20}
      eventHandlers={{
        tileerror: (e) => {
          logger.warn(`[Map:${traceLabel}] tile error`, {
            url: "url" in e.tile ? String((e.tile as HTMLImageElement).src) : undefined,
            usingFallback: useFallback,
          });
          if (!useFallback) {
            logger.info(`[Map:${traceLabel}] switching to OSM fallback`);
            setUseFallback(true);
          }
        },
        tileload: () => {
          logger.debug(`[Map:${traceLabel}] tile loaded (${useFallback ? "OSM" : "Carto"})`);
        },
        loading: () => logger.debug(`[Map:${traceLabel}] tiles loading…`),
        load: () => logger.info(`[Map:${traceLabel}] all visible tiles loaded`),
      }}
    />
  );
}

/** Dev diagnostics: container size, transform ancestors, map events. */
export function MapDiagnostics({ traceLabel = "map", active = true }: { traceLabel?: string; active?: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!active) return;

    const container = map.getContainer();
    const logLayout = (reason: string) => {
      const rect = container.getBoundingClientRect();
      const tileImages = container.querySelectorAll("img.leaflet-tile");
      let loadedTiles = 0;
      tileImages.forEach((node) => {
        const img = node as HTMLImageElement;
        if (img.complete && img.naturalWidth > 0) loadedTiles += 1;
      });

      logger.info(`[Map:${traceLabel}] layout (${reason})`, {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        zoom: map.getZoom(),
        center: map.getCenter(),
        tileDomCount: tileImages.length,
        tilesWithImageData: loadedTiles,
      });

      let el: HTMLElement | null = container.parentElement;
      while (el && el !== document.body) {
        const { transform, filter, perspective } = window.getComputedStyle(el);
        if (
          (transform && transform !== "none") ||
          (filter && filter !== "none") ||
          (perspective && perspective !== "none")
        ) {
          logger.warn(`[Map:${traceLabel}] broken ancestor (transform/filter)`, {
            tag: el.tagName,
            className: el.className,
            transform,
            filter,
            perspective,
          });
        }
        el = el.parentElement;
      }
    };

    logLayout("mount");
    const timers = [100, 500, 1500].map((ms) => window.setTimeout(() => logLayout(`t+${ms}ms`), ms));

    const onResize = () => logLayout("resize");
    window.addEventListener("resize", onResize);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", onResize);
    };
  }, [map, traceLabel, active]);

  return null;
}
