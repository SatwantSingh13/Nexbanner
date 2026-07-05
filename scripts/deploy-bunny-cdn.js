/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const CDN_ROOT = process.env.BUNNY_CDN_ROOT || "nexbanner/beta";
const STORAGE_ZONE = requiredEnv("BUNNY_STORAGE_ZONE");
const ACCESS_KEY = requiredEnv("BUNNY_STORAGE_ACCESS_KEY");
const STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || "";

const STORAGE_HOST = STORAGE_REGION
  ? `${STORAGE_REGION}.storage.bunnycdn.com`
  : "storage.bunnycdn.com";

const files = [
  ["src/nexbanner-gam.js", "src/nexbanner-gam.js", "application/javascript"],
  ["src/nexbanner-player.js", "src/nexbanner-player.js", "application/javascript"],
  ["assets/display-banner-1.png", "assets/display-banner-1.png", "image/png"],
  ["assets/display-banner-2.png", "assets/display-banner-2.png", "image/png"],
  ["assets/nexbanner-vast-tag.xml", "assets/nexbanner-vast-tag.xml", "application/xml"],
  ["assets/nexbid-vast-tags.webm", "assets/nexbid-vast-tags.webm", "video/webm"],
];

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  console.log(`Uploading NexBanner beta files to Bunny.net storage zone: ${STORAGE_ZONE}`);
  console.log(`CDN root path: ${CDN_ROOT}`);

  for (const [local, remote, contentType] of files) {
    const localPath = path.join(ROOT, local);
    const remotePath = cleanPath(`${CDN_ROOT}/${remote}`);
    await upload(localPath, remotePath, contentType);
    console.log(`Uploaded ${local} -> /${remotePath}`);
  }

  console.log("Bunny.net CDN upload complete.");
}

function upload(localPath, remotePath, contentType) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(localPath)) {
      reject(new Error(`Missing local file: ${localPath}`));
      return;
    }

    const body = fs.readFileSync(localPath);
    const request = https.request(
      {
        method: "PUT",
        hostname: STORAGE_HOST,
        path: `/${STORAGE_ZONE}/${remotePath}`,
        headers: {
          AccessKey: ACCESS_KEY,
          "Content-Type": contentType,
          "Content-Length": body.length,
        },
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
            return;
          }

          reject(
            new Error(
              `Bunny upload failed for /${remotePath}: ${response.statusCode} ${responseBody}`
            )
          );
        });
      }
    );

    request.on("error", reject);
    request.end(body);
  });
}

function cleanPath(value) {
  return value.replace(/^\/+/, "").replace(/\\/g, "/");
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
