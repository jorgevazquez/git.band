#!/usr/bin/env node
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const imagesDir = resolve(here, "..", "images", "members");

const API_KEY = process.env.BFL_API_KEY;
if (!API_KEY) {
  console.error("❌ BFL_API_KEY is not set in .env.local");
  process.exit(1);
}

const KEY: string = API_KEY;

const BASE_URL = "https://api.bfl.ai/v1";
const MODEL = "flux-2-pro-preview";
const WIDTH = 800;
const HEIGHT = 1440;
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 180;

async function submitJob(prompt: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/${MODEL}`, {
    method: "POST",
    headers: {
      "X-Key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, width: WIDTH, height: HEIGHT }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BFL API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { polling_url: string };
  return data.polling_url;
}

async function pollResult(pollingUrl: string): Promise<{ sample: string }> {
  await new Promise((r) => setTimeout(r, 3000));

  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    const response = await fetch(pollingUrl, {
      method: "GET",
      headers: { "X-Key": KEY },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`BFL poll error: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      status: string;
      result?: { sample: string };
    };

    if (data.status === "Ready" && data.result) return { sample: data.result.sample };
    if (data.status === "Error" || data.status === "Failed") throw new Error("BFL generation failed");

    if (attempt < MAX_POLLS - 1) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`BFL generation timeout after ${MAX_POLLS * 2}s`);
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function saveImage(buffer: Buffer, name: string): string {
  mkdirSync(imagesDir, { recursive: true });
  const filePath = resolve(imagesDir, `${name}.jpg`);
  writeFileSync(filePath, buffer);
  return filePath;
}

const prompts = [
  {
    name: "mister-forged",
    text: "Portrait of a muscular hispanic man, late 30s, black tee and pants, heavy tattoos on arms and neck. Standing in massive underground music studio, surrounded by floor-to-ceiling synthesizers covered in red and orange patch cables. Multiple laptops, oscilloscopes, glowing mixing console. Blonde woman in black bikini leaning against synthesizer rack. Dramatic ember-orange and crimson lighting. Dark cinematic, photorealistic.",
  },
  {
    name: "gil",
    text: "Portrait of lean hispanic man, late 30s, black tee and jeans, dark tattoo sleeves. Crouched on massive black Kawasaki Ninja H2R motorcycle, speeding through rain-slicked night circuit. Motion blur background with orange circuit lights. Clearly winning the race. Aggressive expression. Low dramatic angle. Deep blacks, ember orange accents, rain spray. Cinematic speed photography, photorealistic.",
  },
];

console.error("🔥 Starting Flux member portrait generation...\n");

for (const { name, text } of prompts) {
  try {
    console.error(`⏳ Submitting: ${name}`);
    const pollingUrl = await submitJob(text);

    console.error(`⏳ Polling: ${name}`);
    const { sample } = await pollResult(pollingUrl);

    console.error(`⬇️  Downloading: ${name}`);
    const buffer = await downloadImage(sample);

    const filePath = saveImage(buffer, name);
    console.error(`✅ Saved: ${filePath}\n`);
  } catch (err) {
    console.error(`✗ Failed: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.error("🎨 All member portraits generated successfully!");
