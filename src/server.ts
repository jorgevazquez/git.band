#!/usr/bin/env node
import { config } from "dotenv";
config({ path: ".env.local" });

// MCP servers must keep stdout reserved for JSON-RPC. Anything imported
// (including @heyputer/puter.js) that writes to console.log would corrupt
// the stream — redirect to stderr so library logs don't break the protocol.
console.log = (...args: unknown[]) => console.error(...args);

// --- Polyfills required by @heyputer/puter.js when running under Node ---
// puter.ai.txt2img uses `new Image()` and `FileReader`, which Node lacks.
// Minimal shims that satisfy the AI module's transform path.
const g = globalThis as any;
if (typeof g.Image === "undefined") {
  g.Image = class {
    src = "";
  };
}
if (typeof g.FileReader === "undefined") {
  g.FileReader = class {
    result: string | null = null;
    onloadend: (() => void) | null = null;
    onload: ((e: { target: { result: string } }) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    readAsDataURL(blob: Blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          const b64 = Buffer.from(buf).toString("base64");
          const mime = (blob as { type?: string }).type || "application/octet-stream";
          this.result = `data:${mime};base64,${b64}`;
          this.onloadend?.();
          this.onload?.({ target: { result: this.result } });
        })
        .catch((err) => this.onerror?.(err));
    }
  };
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Polyfills must be installed before this import so puter.js sees them.
// @ts-expect-error - no published types
import puter from "@heyputer/puter.js";

const token = process.env.PUTER_AUTH_TOKEN;
if (!token) {
  console.error(
    "PUTER_AUTH_TOKEN is not set. Run `npm run get-token` for instructions, or paste a " +
      "token from puter.com → DevTools → Application → Local Storage → puter.auth.token."
  );
  process.exit(1);
}
(puter as { setAuthToken: (t: string) => void }).setAuthToken(token);

const here = dirname(fileURLToPath(import.meta.url));
const imagesDir = resolve(here, "..", "images");

function parseDataUrl(url: string): { mimeType: string; data: string } {
  const m = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  return { mimeType: m[1], data: m[2] };
}

async function fetchAsBase64(
  url: string
): Promise<{ data: string; mimeType: string }> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch ${url} failed: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  return {
    data: buf.toString("base64"),
    mimeType: resp.headers.get("content-type") || "image/png",
  };
}

async function normalizeImage(
  result: unknown
): Promise<{ data: string; mimeType: string }> {
  // Polyfilled Image instance: { src: "data:image/...;base64,..." | "https://..." }
  if (result && typeof (result as { src?: unknown }).src === "string") {
    const src = (result as { src: string }).src;
    if (src.startsWith("data:")) return parseDataUrl(src);
    if (/^https?:\/\//.test(src)) return fetchAsBase64(src);
  }
  if (typeof result === "string") {
    if (result.startsWith("data:")) return parseDataUrl(result);
    if (/^https?:\/\//.test(result)) return fetchAsBase64(result);
  }
  if (result instanceof Uint8Array) {
    return {
      data: Buffer.from(result).toString("base64"),
      mimeType: "image/png",
    };
  }
  if (result && typeof (result as { url?: unknown }).url === "string") {
    return fetchAsBase64((result as { url: string }).url);
  }
  throw new Error(
    `Unrecognized txt2img return shape: ${JSON.stringify(result)?.slice(0, 200)}`
  );
}

function saveImage(base64: string, mimeType: string): string {
  mkdirSync(imagesDir, { recursive: true });
  const ext = (mimeType.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = resolve(imagesDir, `${stamp}.${ext}`);
  writeFileSync(filePath, Buffer.from(base64, "base64"));
  return filePath;
}

const server = new McpServer({
  name: "puter-dalle",
  version: "0.1.0",
});

server.registerTool(
  "generate_image",
  {
    description:
      "Generate an image from a text prompt using Puter AI (DALL·E etc.). Returns the image inline.",
    inputSchema: {
      prompt: z
        .string()
        .min(1)
        .describe("Text description of the image to generate."),
      model: z
        .string()
        .optional()
        .describe(
          "Optional Puter image model id (e.g. 'gemini-2.5-flash-image-preview'). Omit for OpenAI default."
        ),
      testMode: z
        .boolean()
        .optional()
        .describe("If true, use Puter's free sample mode (no credits used)."),
      save: z
        .boolean()
        .default(true)
        .describe("Save the image to ./images/<timestamp>.<ext> on disk."),
    },
  },
  async ({ prompt, model, testMode, save }) => {
    const opts: Record<string, unknown> = { prompt };
    if (model) opts.model = model;

    // Per puter.js source, txt2img signature is (opts, testModeBool).
    const ai = puter as { ai: { txt2img: (...args: unknown[]) => Promise<unknown> } };
    const callArgs: unknown[] = [opts];
    if (testMode) callArgs.push(true);

    const raw = await ai.ai.txt2img(...callArgs);
    const { data, mimeType } = await normalizeImage(raw);

    const parts: Array<
      | { type: "image"; data: string; mimeType: string }
      | { type: "text"; text: string }
    > = [{ type: "image", data, mimeType }];

    if (save) {
      const filePath = saveImage(data, mimeType);
      parts.push({ type: "text", text: `Saved to ${filePath}` });
    }

    return { content: parts };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
