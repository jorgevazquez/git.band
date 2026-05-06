#!/usr/bin/env node
import { config } from "dotenv";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolvePath(here, "..", ".env.local") });

import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import mime from "mime";

const S3_BUCKET = process.env.S3_BUCKET || "git-band-site";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID || "";
const DRY_RUN = process.env.DRY_RUN === "true";

interface FileInfo {
  path: string;
  key: string;
  size: number;
  mimeType: string;
}

const EXCLUDE_PATTERNS = [
  /^\.git\//,
  /^\.claude\//,
  /^node_modules\//,
  /^\.env/,
  /\.ts$/,
  /^tsconfig\.json$/,
  /^\.gitignore$/,
  /\.output$/,
  /^dist\//,
  /^scripts\//,
  /^video\//,
  /^DEPLOY(\.md)?$/i,
  /^README(\.md)?$/i,
  /\.DS_Store$/,
];

const CACHE_CONTROL_RULES: { [key: string]: string } = {
  "index.html": "public,max-age=300",
  ".html": "public,max-age=300",
  ".json": "public,max-age=300",
  ".css": "public,max-age=31536000",
  ".js": "public,max-age=31536000",
  ".jpg": "public,max-age=31536000",
  ".png": "public,max-age=31536000",
  ".mp3": "public,max-age=31536000",
  ".mp4": "public,max-age=31536000",
  ".woff2": "public,max-age=31536000",
};

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function getCacheControl(filePath: string): string {
  if (filePath === "index.html") return CACHE_CONTROL_RULES["index.html"];

  for (const [pattern, cacheControl] of Object.entries(CACHE_CONTROL_RULES)) {
    if (filePath.endsWith(pattern)) return cacheControl;
  }

  return "public,max-age=3600";
}

function getMimeType(filePath: string): string {
  const detected = mime.getType(filePath);
  if (detected) return detected;

  if (filePath.endsWith(".json")) return "application/json;charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html;charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css;charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript;charset=utf-8";

  return "application/octet-stream";
}

function getLocalFiles(dir: string, prefix = ""): FileInfo[] {
  const files: FileInfo[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    const relativePath = join(prefix, entry.name);

    if (shouldExclude(relativePath)) continue;

    if (entry.isDirectory()) {
      files.push(...getLocalFiles(fullPath, relativePath));
    } else {
      const stat = statSync(fullPath);
      files.push({
        path: fullPath,
        key: relativePath.replace(/\\/g, "/"),
        size: stat.size,
        mimeType: getMimeType(relativePath),
      });
    }
  }

  return files;
}

async function getS3Files(s3: S3Client): Promise<Set<string>> {
  const keys = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        ContinuationToken: continuationToken,
      })
    );

    result.Contents?.forEach((obj) => {
      if (obj.Key) keys.add(obj.Key);
    });

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

async function uploadFile(s3: S3Client, file: FileInfo): Promise<void> {
  const fileContent = readFileSync(file.path);

  if (!DRY_RUN) {
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: file.key,
        Body: fileContent,
        ContentType: file.mimeType,
        CacheControl: getCacheControl(file.key),
      })
    );
  }

  console.log(`📤 ${file.key} (${(file.size / 1024).toFixed(2)} KB)`);
}

async function deleteFile(s3: S3Client, key: string): Promise<void> {
  if (!DRY_RUN) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );
  }

  console.log(`🗑️  ${key}`);
}

async function createInvalidation(cf: CloudFrontClient): Promise<void> {
  if (!CLOUDFRONT_DISTRIBUTION_ID || DRY_RUN) return;

  const result = await cf.send(
    new CreateInvalidationCommand({
      DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
      InvalidationBatch: {
        Paths: {
          Quantity: 1,
          Items: ["/*"],
        },
        CallerReference: Date.now().toString(),
      },
    })
  );

  console.log(`\n✨ CloudFront invalidation created: ${result.Invalidation?.Id}`);
}

(async () => {
  try {
    console.log(`\n🚀 Deploying to S3 bucket: ${S3_BUCKET}`);
    console.log(`📍 Region: ${AWS_REGION}`);
    if (DRY_RUN) console.log(`⚠️  DRY RUN MODE (no changes will be made)\n`);
    else console.log("");

    const s3 = new S3Client({ region: AWS_REGION });

    // Get local files
    console.log("📂 Scanning local files...");
    const localFiles = getLocalFiles(process.cwd());
    const localKeys = new Set(localFiles.map((f) => f.key));

    // Get S3 files
    console.log("☁️  Scanning S3 files...");
    const s3Keys = await getS3Files(s3);

    // Upload/update files
    console.log(`\n📤 Uploading ${localFiles.length} files...`);
    for (const file of localFiles) {
      await uploadFile(s3, file);
    }

    // Delete removed files (but preserve excluded folders)
    const PRESERVE_PATTERNS = [/^audio\//, /^video\//];
    const filesToDelete = Array.from(s3Keys).filter((key) => {
      if (!localKeys.has(key)) {
        return !PRESERVE_PATTERNS.some((pattern) => pattern.test(key));
      }
      return false;
    });
    if (filesToDelete.length > 0) {
      console.log(`\n🗑️  Deleting ${filesToDelete.length} removed files...`);
      for (const key of filesToDelete) {
        await deleteFile(s3, key);
      }
    }

    // Invalidate CloudFront
    if (CLOUDFRONT_DISTRIBUTION_ID) {
      console.log("\n🔄 Invalidating CloudFront...");
      const cf = new CloudFrontClient({ region: AWS_REGION });
      await createInvalidation(cf);
    }

    console.log("\n✅ Deployment complete!");
  } catch (err) {
    console.error("\n❌ Deployment failed:");
    console.error(err);
    process.exit(1);
  }
})();
