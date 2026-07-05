/* eslint-disable no-console */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = Number(process.env.PORT || 8080);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "server", "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.jsonl");
const ONE_BY_ONE_GIF = Buffer.from(
  "R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64"
);

fs.mkdirSync(DATA_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const route = parsed.pathname || "/";

  addCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (route === "/health") return sendJson(res, 200, { ok: true, product: "NexBanner Beta" });
    if (route === "/api/v1/auction") return handleAuction(req, res, parsed.query);
    if (route === "/api/v1/vast") return handleVast(req, res, parsed.query);
    if (route === "/api/v1/track") return handleTrack(req, res, parsed.query);
    if (route === "/api/v1/report") return handleReport(req, res);
    if (route === "/") return sendText(res, 200, "NexBanner Beta server is running.");
    return serveStatic(res, route);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "server_error" });
  }
});

server.listen(PORT, () => {
  console.log(`NexBanner Beta server running on http://localhost:${PORT}`);
  console.log(`Beta demo: http://localhost:${PORT}/demo/beta.html`);
});

function handleAuction(req, res, query) {
  const layer = String(query.layer || "premium-display");
  const host = `http://${req.headers.host}`;

  recordEvent("auction_request", query, {
    layer,
    page: query.page || "",
  });

  const decision = runBetaAuction(layer, host);
  if (!decision) return sendJson(res, 204, {});

  sendJson(res, 200, {
    ...decision,
    decisionId: decisionId(),
  });
}

function runBetaAuction(layer, host) {
  if (layer === "premium-display") {
    return {
      adType: "display",
      imageUrl: `${host}/assets/display-banner-1.png`,
      clickUrl: "https://nexbid.uk",
      impressionUrl: `${host}/api/v1/track?event=partner_impression&layer=premium-display&cpm=0.42`,
      cpm: 0.42,
      currency: "USD",
      layer: "premium-display",
      buyer: "nexbanner-beta-display",
    };
  }

  if (layer === "remnant-ortb") {
    return {
      adType: "display",
      imageUrl: `${host}/assets/display-banner-2.png`,
      clickUrl: "https://nexbid.uk",
      impressionUrl: `${host}/api/v1/track?event=partner_impression&layer=remnant-ortb&cpm=0.12`,
      cpm: 0.12,
      currency: "USD",
      layer: "remnant-ortb",
      buyer: "nexbanner-beta-remnant",
    };
  }

  return null;
}

function handleVast(req, res, query) {
  recordEvent("vast_request", query, { layer: "premium-vast" });

  const host = `http://${req.headers.host}`;
  const vast = `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.2">
  <Ad id="nexbanner-beta-vast">
    <InLine>
      <AdSystem>NexBanner</AdSystem>
      <AdTitle>NexBanner Beta Video</AdTitle>
      <Impression><![CDATA[${host}/api/v1/track?event=partner_impression&layer=premium-vast&cpm=1.25]]></Impression>
      <Creatives>
        <Creative id="nexbanner-beta-video" sequence="1">
          <Linear>
            <Duration>00:00:07</Duration>
            <TrackingEvents>
              <Tracking event="start"><![CDATA[${host}/api/v1/track?event=vast_start&layer=premium-vast]]></Tracking>
              <Tracking event="firstQuartile"><![CDATA[${host}/api/v1/track?event=vast_q1&layer=premium-vast]]></Tracking>
              <Tracking event="midpoint"><![CDATA[${host}/api/v1/track?event=vast_mid&layer=premium-vast]]></Tracking>
              <Tracking event="thirdQuartile"><![CDATA[${host}/api/v1/track?event=vast_q3&layer=premium-vast]]></Tracking>
              <Tracking event="complete"><![CDATA[${host}/api/v1/track?event=vast_complete&layer=premium-vast]]></Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough><![CDATA[https://nexbid.uk]]></ClickThrough>
            </VideoClicks>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/webm" width="1280" height="720" bitrate="700" scalable="true" maintainAspectRatio="true"><![CDATA[${host}/assets/nexbid-vast-tags.webm]]></MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;

  res.writeHead(200, {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(vast);
}

function handleTrack(req, res, query) {
  recordEvent(String(query.event || "unknown"), query, {
    layer: query.layer || "",
    reason: query.reason || "",
    cpm: query.cpm || "",
  });

  res.writeHead(200, {
    "content-type": "image/gif",
    "cache-control": "no-store",
    "content-length": ONE_BY_ONE_GIF.length,
  });
  res.end(ONE_BY_ONE_GIF);
}

function handleReport(req, res) {
  const events = readEvents();
  sendJson(res, 200, summarize(events));
}

function summarize(events) {
  const byEvent = {};
  const byLayer = {};
  let revenue = 0;
  let impressions = 0;

  for (const item of events) {
    byEvent[item.event] = (byEvent[item.event] || 0) + 1;
    byLayer[item.layer || "unknown"] = (byLayer[item.layer || "unknown"] || 0) + 1;

    if (item.event === "impression" || item.event === "partner_impression") {
      impressions += 1;
      const cpm = Number(item.cpm || 0);
      if (Number.isFinite(cpm)) revenue += cpm / 1000;
    }
  }

  return {
    product: "NexBanner Beta",
    generatedAt: new Date().toISOString(),
    totalEvents: events.length,
    impressions,
    estimatedRevenueUsd: Number(revenue.toFixed(6)),
    estimatedEcpmUsd: impressions ? Number(((revenue / impressions) * 1000).toFixed(4)) : 0,
    byEvent,
    byLayer,
    recentEvents: events.slice(-25).reverse(),
  };
}

function recordEvent(event, query, extra) {
  const row = {
    ts: new Date().toISOString(),
    event,
    publisherId: query.publisher_id || "",
    placementId: query.placement_id || "",
    layer: query.layer || extra.layer || "",
    cpm: query.cpm || extra.cpm || "",
    reason: query.reason || extra.reason || "",
    width: query.w || "",
    height: query.h || "",
    page: query.page || extra.page || "",
  };

  fs.appendFileSync(EVENTS_FILE, JSON.stringify(row) + "\n");
}

function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  return fs
    .readFileSync(EVENTS_FILE, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function serveStatic(res, route) {
  const cleanRoute = route.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, cleanRoute);
  if (!filePath.startsWith(ROOT)) return sendText(res, 403, "Forbidden");

  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  const finalPath = stat && stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
  if (!finalPath || !fs.existsSync(finalPath)) return sendText(res, 404, "Not found");

  const ext = path.extname(finalPath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".webm": "video/webm",
    ".xml": "application/xml; charset=utf-8",
  };

  res.writeHead(200, {
    "content-type": types[ext] || "application/octet-stream",
    "cache-control": "no-store",
  });
  fs.createReadStream(finalPath).pipe(res);
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body, null, 2));
}

function sendText(res, status, body) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function addCors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

function decisionId() {
  return `nbx_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}
