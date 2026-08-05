import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("public", { recursive: true });

const jobs = [
  { src: "scripts/icon-source.svg", out: "public/pwa-192.png", size: 192 },
  { src: "scripts/icon-source.svg", out: "public/pwa-512.png", size: 512 },
  { src: "scripts/icon-source.svg", out: "public/apple-touch-icon.png", size: 180 },
  { src: "scripts/icon-source.svg", out: "public/favicon-32.png", size: 32 },
  { src: "scripts/icon-maskable-source.svg", out: "public/pwa-maskable-512.png", size: 512 },
];

for (const job of jobs) {
  await sharp(job.src, { density: 384 }).resize(job.size, job.size).png().toFile(job.out);
  console.log(`wrote ${job.out}`);
}
