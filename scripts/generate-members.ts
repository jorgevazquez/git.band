#!/usr/bin/env node
import "dotenv/config";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
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

function imageToBase64(imagePath: string): string {
  const buffer = readFileSync(imagePath);
  return buffer.toString("base64");
}

async function submitJob(prompt: string, imageBase64?: string): Promise<string> {
  const body: {
    prompt: string;
    width: number;
    height: number;
    image?: string;
  } = { prompt, width: WIDTH, height: HEIGHT };

  if (imageBase64) {
    body.image = imageBase64;
  }

  const response = await fetch(`${BASE_URL}/${MODEL}`, {
    method: "POST",
    headers: {
      "X-Key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
    text: "Portrait of two muscular hispanic men standing. Both men are wearing the same clothes: black shoes, black tee, and black pants. The man on the left is mister forged and he is 5'8\" and 220 lbs., average build. His arms and forearms have no tattoos. Mister Forged is wearing an executioners hood.  He is standing with arms crossed with each hand grabbing the opposite bicep firmly in a way where the back of both of his hands are visible. He is turned slightly toward the center of the sceene.    On the right side is Gil.  He has a lean build and weighs around 180lbs.  Tattoos all over his arms.  He is wearing a motorcycle helmet, black with a black visor - which makes him look quite a bit taller than Mister Forged.  He is standing facing slightly toward the center of the scene.  He has his black Ibanez 7-string guitar slung over his shoulder and one of his hands is on the neck of the instrunent while the other appears to be holding a pick almost as if he is ready to strike those glistening silver strings. Standing inside a massive underground music studio, surrounded by floor-to-ceiling synthesizers and drum machines covered in red, orange, and yellow patch cables. Multiple laptops, oscilloscopes, glowing mixing console. Dramatic ember-orange and crimson lighting. Dark cinematic, photorealistic.",
  },
  {
    name: "gil",
    text: "Portrait of lean, 5'8\" hispanic man, mid 30s, black tee and jeans, dark tattoo sleeves. Crouched on massive black Kawasaki Ninja H2R motorcycle - all black. Doing a massive wheelie and speeding through rain-slicked night circuit. Motion blur background with orange circuit lights. Clearly winning the race. Aggressive expression. Low dramatic angle. Deep blacks, ember orange accents, rain spray. Cinematic speed photography, photorealistic.",
  },
];

// Parse CLI arguments
const args = process.argv.slice(2);
let targetMember: string | null = null;
let customPrompt: string | null = null;
let imagePath: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--member" && args[i + 1]) {
    targetMember = args[++i];
  } else if (args[i] === "--prompt" && args[i + 1]) {
    customPrompt = args[++i];
  } else if (args[i] === "--image" && args[i + 1]) {
    imagePath = args[++i];
  }
}

// Validate image path if provided
if (imagePath && !existsSync(imagePath)) {
  console.error(`❌ Image file not found: ${imagePath}`);
  process.exit(1);
}

const toGenerate = targetMember
  ? prompts.filter((p) => p.name === targetMember)
  : prompts;

if (targetMember && toGenerate.length === 0) {
  console.error(`❌ Member "${targetMember}" not found`);
  console.error(`Available members: ${prompts.map((p) => p.name).join(", ")}`);
  process.exit(1);
}

console.error("🔥 Starting Flux member portrait generation...\n");
if (imagePath) console.error(`📸 Using image: ${imagePath}\n`);
if (customPrompt) console.error(`📝 Using custom prompt\n`);

for (const { name, text } of toGenerate) {
  try {
    const prompt = customPrompt || text;
    let imageBase64: string | undefined;

    if (imagePath) {
      console.error(`⏳ Reading image: ${imagePath}`);
      imageBase64 = imageToBase64(imagePath);
    }

    console.error(`⏳ Submitting: ${name}`);
    const pollingUrl = await submitJob(prompt, imageBase64);

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

console.error("🎨 Member portraits generated successfully!");
