// Generates PNG app icons from the SVG sources. Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const icon = await readFile("public/icons/icon.svg");
const maskable = await readFile("public/icons/maskable.svg");
const jobs = [
  [icon, 192, "public/icons/icon-192.png"],
  [icon, 512, "public/icons/icon-512.png"],
  [maskable, 512, "public/icons/maskable-512.png"],
  [maskable, 180, "public/icons/apple-touch-icon.png"],
];
for (const [src, size, out] of jobs) {
  await sharp(src, { density: 600 }).resize(size, size).png().toFile(out);
  console.log("wrote", out);
}
