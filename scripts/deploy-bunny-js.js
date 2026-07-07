/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const CDN_ROOT = process.env.BUNNY_CDN_ROOT || "nexbanner/final";
const STORAGE_ZONE = requiredEnv("BUNNY_STORAGE_ZONE");
const ACCESS_KEY = requiredEnv("BUNNY_STORAGE_ACCESS_KEY");
const STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || "";
const STORAGE_HOST = STORAGE_REGION
  ? `${STORAGE_REGION}.storage.bunnycdn.com`
  : "storage.bunnycdn.com";

const files = [
  ["src/nexbanner-gam.js", "src/nexbanner-gam.js"],
  ["src/nexbanner-player.js", "src/nexbanner-player.js"],
];

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  for (const [local, remote] of files) {
    const localPath = path.join(ROOT, local);
    const remotePath = `${CDN_ROOT}/${remote}`.replace(/^\/+/, "");
    await upload(localPath, remotePath);
    console.log(`Uploaded ${remotePath}`);
  }
}

function upload(localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const body = fs.readFileSync(localPath);
    const request = https.request(
      {
        method: "PUT",
        hostname: STORAGE_HOST,
        path: `/${STORAGE_ZONE}/${remotePath}`,
        headers: {
          AccessKey: ACCESS_KEY,
          "Content-Type": "application/javascript",
          "Content-Length": body.length,
        },
        timeout: 20000,
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { responseBody += chunk; });
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) resolve();
          else reject(new Error(`${response.statusCode} ${responseBody}`));
        });
      }
    );

    request.on("timeout", () => request.destroy(new Error("upload-timeout")));
    request.on("error", reject);
    request.end(body);
  });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
