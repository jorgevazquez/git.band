#!/usr/bin/env node
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const imagesDir = resolve(here, "..", "images");

const API_KEY = process.env.BFL_API_KEY;
if (!API_KEY) {
  console.error("❌ BFL_API_KEY is not set in .env.local");
  process.exit(1);
}

// Type guard: ensure API_KEY is defined for the rest of the script
const KEY: string = API_KEY;

const BASE_URL = "https://api.bfl.ai/v1";
const MODEL = "flux-pro-1.1";
const WIDTH = 1440;
const HEIGHT = 864;
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 180; // 6 minutes max wait

async function submitJob(prompt: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/${MODEL}`, {
    method: "POST",
    headers: {
      "X-Key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      width: WIDTH,
      height: HEIGHT,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BFL API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

async function pollResult(
  id: string
): Promise<{ sample: string; status: string }> {
  // Wait a moment before first poll
  await new Promise((resolve) => setTimeout(resolve, 1000));

  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    const response = await fetch(`${BASE_URL}/get_result?id=${id}`, {
      method: "GET",
      headers: {
        "X-Key": KEY,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`BFL API error: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      result?: { sample: string };
    };

    if (data.status === "Ready" && data.result) {
      return { sample: data.result.sample, status: data.status };
    }

    if (data.status === "Error") {
      throw new Error(`BFL generation failed: ${data.status}`);
    }

    if (data.status === "Task not found") {
      // Task not yet registered, wait and retry
      if (attempt < MAX_POLLS - 1) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      continue;
    }

    // Status is "Pending", wait and retry
    if (attempt < MAX_POLLS - 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  throw new Error(`BFL generation timeout after ${MAX_POLLS * 2} seconds`);
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
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
    name: "01-hydraulics",
    text: "Close-up of massive industrial hydraulic pistons and steel cables under intense red-orange work lighting, steam venting from joints, ultra-sharp metal textures, matte black background, cinematic lighting, photorealistic, no people, 16:9",
  },
  {
    name: "02-circuit-forge",
    text: "Extreme macro of a circuit board with traces rendered in deep crimson and tarnished copper on matte black substrate, molten solder points glowing orange-red, shallow depth of field, dark industrial aesthetic, photorealistic, no text, 16:9",
  },
  {
    name: "03-magma-veins",
    text: "Aerial macro view of volcanic basalt rock with active lava veins glowing deep red and orange, near-abstract texture, absolute darkness between cracks, no people, photorealistic, 16:9",
  },
  {
    name: "04-brutalist-night",
    text: "Brutalist concrete architecture at night, massive raw concrete walls lit from below by sodium vapor lights casting deep blood-red shadows, rain-slicked ground reflections, ominous and heavy atmosphere, photorealistic, no people, wide angle, 16:9",
  },
  {
    name: "05-steel-mill",
    text: "Interior of a steel mill during a molten metal pour, cascading liquid steel glowing red-orange against absolute blackness, heavy industrial atmosphere, smoke and heat distortion, photorealistic, no people, cinematic, 16:9",
  },
];

console.error("🔥 Starting Flux background generation...\n");

for (const { name, text } of prompts) {
  try {
    console.error(`⏳ Submitting: ${name}`);
    const jobId = await submitJob(text);

    console.error(`⏳ Polling: ${name} (ID: ${jobId.slice(0, 8)}...)`);
    const { sample } = await pollResult(jobId);

    console.error(`⬇️  Downloading: ${name}`);
    const imageBuffer = await downloadImage(sample);

    const filePath = saveImage(imageBuffer, name);
    console.error(`✓ Saved: ${filePath}\n`);
  } catch (err) {
    console.error(`✗ Failed: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.error("🎨 All backgrounds generated successfully!");
