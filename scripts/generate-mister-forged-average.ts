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

const prompt = `Portrait of a lean hispanic man with average build, late 30s, wearing all-black clothing — black crew neck tee, black slim pants, black shoes. Dark tattoos covering both arms and neck. Standing commandingly in a vast underground studio surrounded by floor-to-ceiling Eurorack modular synthesizer walls completely covered in hundreds of patch cables in deep blood-red, ember orange, and black cascading everywhere. Multiple open laptops glow, oscilloscope screens pulse with waveforms, server racks blink, massive mixing console with glowing amber faders. To his right, a stunning blonde woman in a black bikini perches atop a synthesizer rack, leaning back casually against the gear. Dramatic under-lighting in ember orange and deep crimson. High contrast cinematic photography, dark brooding atmosphere, photorealistic, ultra detailed.`;

(async () => {
  try {
    console.error("🔥 Generating Mister Forged (Average Build version)...\n");

    console.error("⏳ Submitting");
    const pollingUrl = await submitJob(prompt);

    console.error("⏳ Polling");
    const { sample } = await pollResult(pollingUrl);

    console.error("⬇️  Downloading");
    const buffer = await downloadImage(sample);

    const filePath = saveImage(buffer, "mister-forged-average");
    console.error(`✅ Saved: ${filePath}\n`);
    console.error("🎨 Generation complete!");
  } catch (err) {
    console.error("✗ Failed");
    console.error(err);
    process.exit(1);
  }
})();
