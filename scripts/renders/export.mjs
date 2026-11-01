// Exports the Blender renders (scripts/renders/objects.py) for the landing page:
//   node scripts/renders/export.mjs /tmp/renders/final
// Each PNG is trimmed to its visible pixels, resized to its widths, and written as AVIF and WebP
// to public/marketing/objects/. content/objects.json records every file's size and, for the
// terraces, where each step's top lands as a fraction of the trimmed image.
import { access, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = process.argv[2] ?? "/tmp/renders/final";
/** `--keep-missing`: an object whose renders aren't there yet keeps its current manifest entry. */
const KEEP_MISSING = process.argv.includes("--keep-missing");
const exists = (f) => access(f).then(() => true, () => false);
const OUT = "public/marketing/objects";
const MANIFEST = "content/objects.json";

/** Display widths (px) per object, at 2x. Themed objects have a -light and a -dark render. */
const OBJECTS = {
  seal: { widths: [512] },
  "medallion-raw": { widths: [320] },
  "medallion-spark": { widths: [320] },
  "medallion-flare": { widths: [320] },
  "medallion-shine": { widths: [320] },
  "medallion-radiant": { widths: [320] },
  "medallion-luminary": { widths: [320] },
  commit: { widths: [448] },
  rosette: { widths: [448] },
  envelope: { widths: [448] },
  tray: { widths: [720], themed: true, vignette: true },
  loupe: { widths: [560] },
  letter: { widths: [448] },
  campus: { widths: [640], vignette: true },
  booth: { widths: [640], vignette: true },
  ticket: { widths: [512] },
  pen: { widths: [640] },
  bulb: { widths: [448] },
  page: { widths: [448] },
  chai: { widths: [800], vignette: true },
  terraces: { widths: [1280, 2560], themed: true, points: true },
};

/** Fades a grounded object's floor shadow out before the frame's edge, so no square edge shows. */
async function vignetted(file) {
  const { width, height } = await sharp(file).metadata();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="78%" stop-color="#fff" stop-opacity="1"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  return sharp(file).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function exportOne(name, file, widths, trim = true, vignette = false) {
  // Scenes with projected points keep their full frame, so both themes and the points line up.
  const input = vignette ? await vignetted(file) : file;
  const source = trim ? sharp(input).trim({ threshold: 2 }) : sharp(input);
  const { data, info } = await source.png().toBuffer({ resolveWithObject: true });
  const files = {};
  for (const w of widths) {
    const width = Math.min(w, info.width);
    const base = `${name}-${width}`;
    const img = sharp(data).resize({ width });
    await img.clone().avif({ quality: 58, effort: 6 }).toFile(path.join(OUT, `${base}.avif`));
    await img.clone().webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(OUT, `${base}.webp`));
    files[width] = { avif: `/marketing/objects/${base}.avif`, webp: `/marketing/objects/${base}.webp` };
  }
  return { w: info.width, h: info.height, left: -(info.trimOffsetLeft ?? 0), top: -(info.trimOffsetTop ?? 0), files };
}

await mkdir(OUT, { recursive: true });
const previous = KEEP_MISSING ? JSON.parse(await readFile(MANIFEST, "utf8").catch(() => "{}")) : {};
const manifest = {};
for (const [name, spec] of Object.entries(OBJECTS)) {
  const themes = spec.themed ? ["light", "dark"] : [null];
  const ids = themes.map((t) => (t ? `${name}-${t}` : name));
  if (KEEP_MISSING && !(await Promise.all(ids.map((id) => exists(path.join(SRC, `${id}.png`))))).every(Boolean)) {
    if (previous[name]) manifest[name] = previous[name];
    console.log(`${name}: not rendered yet, kept`);
    continue;
  }
  const entry = {};
  for (const theme of themes) {
    const id = theme ? `${name}-${theme}` : name;
    const out = await exportOne(id, path.join(SRC, `${id}.png`), spec.widths, !spec.points, spec.vignette);
    entry.w = out.w;
    entry.h = out.h;
    entry[theme ?? "shared"] = out.files;
    if (spec.points && theme === "light") {
      const raw = JSON.parse(await readFile(path.join(SRC, `${id}.points.json`), "utf8"));
      entry.points = Object.fromEntries(
        Object.entries(raw.points).map(([k, [x, y]]) => [k, [+((x - out.left) / out.w).toFixed(4), +((y - out.top) / out.h).toFixed(4)]]),
      );
    }
    console.log(`${id}: ${out.w}x${out.h}`);
  }
  manifest[name] = entry;
}
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${MANIFEST}`);
