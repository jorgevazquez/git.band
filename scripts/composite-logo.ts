#!/usr/bin/env node
import sharp from "sharp";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const logoPath = resolve(here, "..", "images", "gitmetal.png");
const extrudedLogoPath = resolve(here, "..", "images", "gitmetal-extruded.png");
const imagePath = resolve(here, "..", "images", "members", "saved", "mister-forged.jpg");
const outputPath = resolve(here, "..", "images", "members", "saved", "mister-forged-with-logo.jpg");

async function createExtrudedLogo(): Promise<Buffer> {
  const logoMetadata = await sharp(logoPath).metadata();
  const logoWidth = logoMetadata.width || 300;
  const logoHeight = logoMetadata.height || 300;
  const extrusionDepth = 60;

  // Canvas size: width = logo width + depth, height = logo height + depth
  const canvasWidth = logoWidth + extrusionDepth;
  const canvasHeight = logoHeight + extrusionDepth;

  // Step 1: Create the right side face (vertical edge on the right)
  const rightSide = await sharp({
    create: {
      width: extrusionDepth,
      height: logoHeight,
      channels: 3,
      background: { r: 40, g: 40, b: 40 }, // Dark gray for depth
    },
  })
    .toFormat("png")
    .toBuffer();

  // Step 2: Create the bottom side face (horizontal edge on the bottom)
  const bottomSide = await sharp({
    create: {
      width: logoWidth + extrusionDepth,
      height: extrusionDepth,
      channels: 3,
      background: { r: 50, g: 50, b: 50 }, // Slightly lighter than right
    },
  })
    .toFormat("png")
    .toBuffer();

  // Step 3: Composite everything cleanly
  // Start with transparent canvas
  let extruded = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .toFormat("png")
    .toBuffer();

  // Layer 1: Right side at position (logoWidth, 0)
  extruded = await sharp(extruded)
    .composite([
      {
        input: rightSide,
        left: logoWidth,
        top: 0,
        blend: "over" as const,
      },
    ])
    .toFormat("png")
    .toBuffer();

  // Layer 2: Bottom side at position (0, logoHeight)
  extruded = await sharp(extruded)
    .composite([
      {
        input: bottomSide,
        left: 0,
        top: logoHeight,
        blend: "over" as const,
      },
    ])
    .toFormat("png")
    .toBuffer();

  // Layer 3: Logo on top at position (0, 0)
  extruded = await sharp(extruded)
    .composite([
      {
        input: logoPath,
        left: 0,
        top: 0,
        blend: "over" as const,
      },
    ])
    .toFormat("png")
    .toBuffer();

  return extruded;
}

async function saveExtrudedLogo() {
  try {
    console.error("🔨 Creating clean Z-axis extruded logo...");
    const extrudedLogo = await createExtrudedLogo();

    await sharp(extrudedLogo)
      .toFile(extrudedLogoPath);

    console.error(`✅ Extruded logo saved to: ${extrudedLogoPath}`);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

async function composite() {
  try {
    console.error("🔨 Creating extruded 3D logo...");
    const extrudedLogo = await createExtrudedLogo();

    console.error("📐 Reading base image...");
    const baseImage = await sharp(imagePath).metadata();
    const baseWidth = baseImage.width || 800;
    const baseHeight = baseImage.height || 1440;

    // Calculate size for the logo - make it substantial
    const logoDisplayWidth = Math.floor(baseWidth / 2.5);

    console.error("📏 Resizing extruded logo...");
    const resizedLogo = await sharp(extrudedLogo)
      .resize(logoDisplayWidth, logoDisplayWidth, {
        withoutEnlargement: false,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();

    // Position in the center, lower on the image (floor level)
    const logoLeft = Math.floor((baseWidth - logoDisplayWidth) / 2);
    const logoTop = Math.floor(baseHeight * 0.6); // Lower on the image

    console.error("✨ Compositing 3D logo onto scene...");
    await sharp(imagePath)
      .composite([
        {
          input: resizedLogo,
          left: logoLeft,
          top: logoTop,
          blend: "over",
        },
      ])
      .toFile(outputPath);

    console.error(`✅ Done! Saved to: ${outputPath}`);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

// Test just the extrusion first
const args = process.argv.slice(2);
if (args.includes("--test-extrusion")) {
  saveExtrudedLogo();
} else {
  composite();
}
