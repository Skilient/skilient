import manifest from "@/content/objects.json";

/**
 * The clay + foil objects on the landing story (decisions 2026-10-31): rendered in Blender by
 * scripts/renders/objects.py, exported by scripts/renders/export.mjs. Decorative stills; motion is
 * CSS. `shared` objects work on both themes; `light`/`dark` pairs are rendered in each surface.
 */

type Files = Record<string, { avif: string; webp: string }>;

export interface ObjectFile {
  /** Pixel size of the trimmed render (the aspect ratio for layout). */
  w: number;
  h: number;
  shared?: Files;
  light?: Files;
  dark?: Files;
  /** Terraces only: where each step's top lands, as fractions of the image. */
  points?: Record<string, [number, number]>;
}

export type ObjectName = keyof typeof manifest;

export const objects = manifest as unknown as Record<ObjectName, ObjectFile>;

/** The largest file of a set, and a srcset over all of them. */
export function sources(files: Files) {
  const widths = Object.keys(files)
    .map(Number)
    .sort((a, b) => a - b);
  const largest = files[String(widths[widths.length - 1])];
  return {
    webp: largest.webp,
    avifSet: widths.map((w) => `${files[String(w)].avif} ${w}w`).join(", "),
    webpSet: widths.map((w) => `${files[String(w)].webp} ${w}w`).join(", "),
  };
}
