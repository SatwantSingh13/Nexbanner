import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const playerSource = await readFile(new URL("../src/nexbanner-player.js", import.meta.url), "utf8");
const loaderSource = await readFile(new URL("../src/nexbanner-gam.js", import.meta.url), "utf8");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseConfig(overrides = {}) {
  return {
    requestId: "request-1",
    width: 300,
    height: 250,
    publisherId: "publisher",
    publisherDomain: "moneycontrol.com",
    placementId: "placement",
    currency: "USD",
    auctionTimeoutMs: 900,
    partnerTimeoutMs: 750,
    bidTtlMs: 5000,
    vastDemand: [],
    vastTags: [],
    displayDemand: [],
    displayScriptDemand: [],
    displayScriptUrls: [],
    adserverScriptDemand: [],
    adserverScriptUrls: [],
    adserverHtmlDemand: [],
    adserverHtmlTags: [],
    ...overrides
  };
}

function createHarness(fetchImpl) {
  const observers = [];
  const listeners = {};
  const fetchCalls = [];

  class FakeElement {
    constructor(tagName = "div") {
      this.tagName = String(tagName).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.firstChild = null;
      this.style = {};
      this.dataset = {};
      this.className = "";
      this.attributes = {};
      this.src = "";
      this.contentWindow = this.tagName === "IFRAME" ? {
        document: { open() {}, write() {}, close() {} }
      } : null;
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      this.firstChild = this.children[0] || null;
      triggerMedia(child);
      return child;
    }
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      this.firstChild = this.children[0] || null;
      return child;
    }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
    addEventListener(name, callback) {
      (this._listeners ||= {})[name] = callback;
    }
    play() {
      if (String(this.src).includes("fail-video")) return Promise.reject(new Error("autoplay blocked"));
      queueMicrotask(() => this._listeners?.playing?.());
      return Promise.resolve();
    }
  }

  function triggerMedia(node) {
    if (node.tagName === "IMG") {
      queueMicrotask(() => {
        if (String(node.src).includes("fail-image")) node.onerror?.();
        else node.onload?.();
      });
    }
    node.children.forEach(triggerMedia);
  }

  class FakeIntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.disconnected = false;
      observers.push(this);
    }
    observe(target) {
      this.target = target;
    }
    disconnect() {
      this.disconnected = true;
    }
    trigger(ratio) {
      this.callback([{
        isIntersecting: ratio > 0,
        intersectionRatio: ratio,
        target: this.target
      }]);
    }
  }

  class FakeDOMParser {
    parseFromString(text) {
      const mediaUrl = /<MediaFile[^>]*>([^<]+)<\/MediaFile>/i.exec(text)?.[1] || "";
      return {
        querySelector(selector) {
          if (selector === "parsererror") return null;
          const value = selector === "ClickThrough"
            ? /<ClickThrough[^>]*>([^<]+)<\/ClickThrough>/i.exec(text)?.[1]
            : selector === "Impression"
              ? /<Impression[^>]*>([^<]+)<\/Impression>/i.exec(text)?.[1]
              : "";
          return value ? { textContent: value } : null;
        },
        querySelectorAll(selector) {
          if (selector === "MediaFile" && mediaUrl) {
            return [{
              textContent: mediaUrl,
              getAttribute(name) {
                if (name === "type") return "video/mp4";
                if (name === "apiFramework") return "";
                return "";
              }
            }];
          }
          return [];
        }
      };
    }
  }

  const document = {
    visibilityState: "visible",
    head: new FakeElement("head"),
    body: new FakeElement("body"),
    referrer: "",
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    addEventListener(name, callback) {
      (listeners[name] ||= []).push(callback);
    },
    removeEventListener(name, callback) {
      listeners[name] = (listeners[name] || []).filter((item) => item !== callback);
    },
    dispatch(name) {
      (listeners[name] || []).slice().forEach((callback) => callback());
    }
  };

  const defaultFetch = async (url) => {
    fetchCalls.push(String(url));
    if (fetchImpl) return fetchImpl(String(url));
    return {
      ok: true,
      text: async () => "",
      json: async () => ({})
    };
  };

  const window = {
    __NEXBANNER_TEST__: true,
    document,
    location: { href: "https://publisher.example/page" },
    fetch: defaultFetch,
    setTimeout,
    clearTimeout,
    addEventListener() {},
    removeEventListener() {},
    Image: FakeElement,
    IntersectionObserver: FakeIntersectionObserver
  };
  window.window = window;
  window.self = window;
  window.top = window;

  const context = {
    window,
    document,
    IntersectionObserver: FakeIntersectionObserver,
    DOMParser: FakeDOMParser,
    Image: FakeElement,
    fetch: defaultFetch,
    URL,
    Promise,
    Number,
    Math,
    Date,
    setTimeout,
    clearTimeout,
    queueMicrotask
  };
  vm.runInNewContext(playerSource, context);
  return {
    hooks: window.NexBannerPlayer.__test,
    root: new FakeElement("div"),
    document,
    observers,
    fetchCalls
  };
}

test("1. No demand at 0% visibility", async () => {
  const harness = createHarness();
  const config = baseConfig({ displayEndpoint: "https://demand.example/bid" });
  harness.hooks.startCommercialAuction(harness.root, config);
  harness.observers[0].trigger(0);
  await delay(230);
  assert.equal(harness.fetchCalls.some((url) => url.includes("demand.example")), false);
});

test("2. No demand at 29% visibility", async () => {
  const harness = createHarness();
  const config = baseConfig({ displayEndpoint: "https://demand.example/bid" });
  harness.hooks.startCommercialAuction(harness.root, config);
  harness.observers[0].trigger(0.29);
  await delay(230);
  assert.equal(harness.fetchCalls.some((url) => url.includes("demand.example")), false);
});

test("3. Auction starts once at 30% after 200 ms", async () => {
  const harness = createHarness();
  const config = baseConfig();
  harness.hooks.startCommercialAuction(harness.root, config);
  const state = harness.root.__nbxCommercialAuction;
  harness.observers[0].trigger(0.3);
  await delay(180);
  assert.equal(state.auctionStarted, false);
  await delay(50);
  assert.equal(state.auctionStarted, true);
  const auctionId = state.auctionId;
  harness.observers[0].trigger(0.3);
  await delay(230);
  assert.equal(state.auctionId, auctionId);
});

test("4. Hidden tab does not start auction", async () => {
  const harness = createHarness();
  harness.document.visibilityState = "hidden";
  harness.hooks.startCommercialAuction(harness.root, baseConfig());
  harness.observers[0].trigger(1);
  await delay(230);
  assert.equal(harness.root.__nbxCommercialAuction.auctionStarted, false);
});

test("5. VAST and direct display requests start together", async () => {
  const starts = [];
  const harness = createHarness(async (url) => {
    starts.push({ url, time: Date.now() });
    if (url.includes("vast.example")) {
      return {
        ok: true,
        text: async () => "<VAST><Ad><InLine><Impression>https://track.example/i</Impression><Creatives><Creative><Linear><MediaFiles><MediaFile type=\"video/mp4\">https://cdn.example/ad.mp4</MediaFile></MediaFiles></Linear></Creative></Creatives></InLine></Ad></VAST>"
      };
    }
    return {
      ok: true,
      json: async () => ({
        partnerName: "Display",
        cpm: 0.42,
        currency: "USD",
        imageUrl: "https://cdn.example/ad.jpg"
      })
    };
  });
  const config = baseConfig({
    vastDemand: [{ name: "VAST", endpoint: "https://vast.example/tag", configuredBidCpm: 0.35 }],
    displayDemand: [{ name: "Display", endpoint: "https://display.example/bid" }]
  });
  const bids = await harness.hooks.runUnifiedAuction(config, {
    auctionId: "auction-1",
    intersectionRatio: 0.3,
    abortControllers: []
  });
  assert.equal(bids.length, 2);
  assert.ok(Math.abs(starts[0].time - starts[1].time) < 25);
});

test("6. Fixed GAM/MI candidate is ranked without execution", async () => {
  const harness = createHarness();
  const bids = await harness.hooks.runUnifiedAuction(baseConfig({
    adserverHtmlDemand: [{
      name: "GAM",
      html: encodeURIComponent("<script src=\"https://loser.example/tag.js\"></script>"),
      configuredBidCpm: 0.15,
      currency: "USD"
    }]
  }), { auctionId: "auction-1", intersectionRatio: 0.3, abortControllers: [] });
  assert.equal(bids[0].partnerName, "GAM");
  assert.equal(harness.fetchCalls.some((url) => url.includes("loser.example")), false);
});

test("7. Highest CPM candidate wins", () => {
  const harness = createHarness();
  const expiresAt = Date.now() + 5000;
  const ranked = harness.hooks.rankCandidates([
    { cpm: 0.15, bidMode: "fixed", responseTimeMs: 1, configOrder: 0, expiresAt },
    { cpm: 0.42, bidMode: "dynamic", responseTimeMs: 200, configOrder: 1, expiresAt }
  ]);
  assert.equal(ranked[0].cpm, 0.42);
});

test("8. Losing HTML/JS tag is not executed", async () => {
  const harness = createHarness();
  const bids = await harness.hooks.runUnifiedAuction(baseConfig({
    displayScriptDemand: [
      { name: "Winner", endpoint: "https://winner.example/tag.js", configuredBidCpm: 0.3, currency: "USD" },
      { name: "Loser", endpoint: "https://loser.example/tag.js", configuredBidCpm: 0.1, currency: "USD" }
    ]
  }), { auctionId: "auction-1", intersectionRatio: 0.3, abortControllers: [] });
  assert.equal(bids.length, 2);
  assert.equal(harness.fetchCalls.length, 0);
});

test("9. Winning fixed tag no fill triggers ranked fallback", async () => {
  const harness = createHarness();
  const config = baseConfig();
  const state = {
    destroyed: false,
    intersectionRatio: 0.3,
    rendering: false,
    filled: false,
    auctionCompleted: false,
    bids: [
      {
        partnerName: "Fail",
        demandType: "display-image",
        bidMode: "fixed",
        cpm: 0.3,
        currency: "USD",
        responseTimeMs: 0,
        configOrder: 0,
        expiresAt: Date.now() + 5000,
        creative: { type: "image", imageUrl: "https://cdn.example/fail-image.jpg" }
      },
      {
        partnerName: "Fallback",
        demandType: "display-image",
        bidMode: "fixed",
        cpm: 0.2,
        currency: "USD",
        responseTimeMs: 0,
        configOrder: 1,
        expiresAt: Date.now() + 5000,
        creative: { type: "image", imageUrl: "https://cdn.example/good.jpg" }
      }
    ],
    abortControllers: [],
    auctionId: "auction-1"
  };
  harness.hooks.renderRankedCandidates(harness.root, config, state);
  await delay(20);
  assert.equal(state.filled, true);
  assert.equal(config.__impressionTracked, true);
});

test("10. Video failure triggers ranked fallback", async () => {
  const harness = createHarness();
  const config = baseConfig();
  const state = {
    destroyed: false,
    intersectionRatio: 0.3,
    rendering: false,
    filled: false,
    auctionCompleted: false,
    bids: [
      {
        partnerName: "Video",
        demandType: "vast",
        bidMode: "fixed",
        cpm: 0.4,
        currency: "USD",
        responseTimeMs: 0,
        configOrder: 0,
        expiresAt: Date.now() + 5000,
        creative: {
          type: "video",
          ad: { adType: "vast-video", mediaUrl: "https://cdn.example/fail-video.mp4", tracking: {} }
        }
      },
      {
        partnerName: "Image",
        demandType: "display-image",
        bidMode: "fixed",
        cpm: 0.2,
        currency: "USD",
        responseTimeMs: 0,
        configOrder: 1,
        expiresAt: Date.now() + 5000,
        creative: { type: "image", imageUrl: "https://cdn.example/good.jpg" }
      }
    ],
    abortControllers: [],
    auctionId: "auction-1"
  };
  harness.hooks.renderRankedCandidates(harness.root, config, state);
  await delay(30);
  assert.equal(state.filled, true);
});

test("11. One request_filled maximum", () => {
  const events = [];
  const harness = createHarness(async (url) => {
    events.push(new URL(url).searchParams.get("event"));
    return { ok: true };
  });
  const config = baseConfig({ trackUrl: "https://track.example/pixel" });
  harness.hooks.recordDeliveredImpression(config, "display", "Winner", 0.4);
  harness.hooks.recordDeliveredImpression(config, "display", "Winner", 0.4);
  assert.equal(events.filter((event) => event === "request_filled").length, 1);
});

test("12. One impression maximum", () => {
  const events = [];
  const harness = createHarness(async (url) => {
    events.push(new URL(url).searchParams.get("event"));
    return { ok: true };
  });
  const config = baseConfig({ trackUrl: "https://track.example/pixel" });
  harness.hooks.recordDeliveredImpression(config, "display", "Winner", 0.4);
  harness.hooks.recordDeliveredImpression(config, "display", "Winner", 0.4);
  assert.equal(events.filter((event) => event === "impression").length, 1);
});

test("13. No rotation after 10 seconds", async () => {
  const harness = createHarness(async (url) => {
    if (url.includes("display.example")) {
      return {
        ok: true,
        json: async () => ({
          partnerName: "Display",
          cpm: 0.42,
          currency: "USD",
          imageUrl: "https://cdn.example/ad.jpg"
        })
      };
    }
    return { ok: true };
  });
  const config = baseConfig({ displayEndpoint: "https://display.example/bid" });
  harness.hooks.startCommercialAuction(harness.root, config);
  harness.observers[0].trigger(0.3);
  await delay(300);
  assert.equal(harness.root.__nbxCommercialAuction.filled, true);
  const demandCalls = harness.fetchCalls.filter((url) => url.includes("display.example")).length;
  await delay(10050);
  assert.equal(harness.fetchCalls.filter((url) => url.includes("display.example")).length, demandCalls);
});

test("14. Video completion does not show another ad", () => {
  const videoBody = /function renderVideo[\s\S]*?function renderDisplay/.exec(playerSource)?.[0] || "";
  const endedBody = /addEventListener\("ended"[\s\S]*?\}\);/.exec(videoBody)?.[0] || "";
  assert.doesNotMatch(endedBody, /onDone|advanceRotation|render/);
});

test("15. Prebid endpoint is not called by unified auction", () => {
  const unified = /function runUnifiedAuction[\s\S]*?function collectVastCandidate/.exec(playerSource)?.[0] || "";
  assert.doesNotMatch(unified, /prebid/i);
});

test("16. ORTB endpoint is not called by unified auction", () => {
  const unified = /function runUnifiedAuction[\s\S]*?function collectVastCandidate/.exec(playerSource)?.[0] || "";
  assert.doesNotMatch(unified, /ortb/i);
});

test("17. Current configuration shape remains readable", async () => {
  const module = await import("../functions/api/v1/config/index.js");
  const writes = new Map();
  const response = await module.onRequestPost({
    request: new Request("https://nexbid.uk/api/v1/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        configId: "compat-test",
        setup: { publisherDomain: "moneycontrol.com" },
        vast: [{ name: "VAST", endpoint: "https://vast.example/tag", floorCpm: "0.15" }],
        displayDemand: [{ name: "Direct", endpoint: "https://display.example/bid" }],
        displayTags: [{ name: "JS", endpoint: "https://display.example/tag.js", floorCpm: "0.15" }],
        adserverTags: [{ name: "GAM", tagType: "html", html: "<div>ad</div>", floorCpm: "0.15" }]
      })
    }),
    env: { NEXBANNER_CONFIGS: { put: async (key, value) => writes.set(key, value) } },
    waitUntil() {}
  });
  assert.equal(response.status, 200);
  const result = await response.clone().json();
  assert.match(result.tag, /v1\.js\?v=20260724-6/);
  assert.doesNotMatch(result.tag, /prebid|ortb|vast-tag|display-endpoint/i);
  const saved = JSON.parse(writes.get("compat-test"));
  assert.equal(saved.vastDemand[0].floorCpm, "0.15");
  assert.equal(saved.displayDemand[0].endpoint, "https://display.example/bid");
  assert.equal(saved.prebidDemand.length, 0);
  assert.equal(saved.ortbDemand.length, 0);
});

test("18. New Version 1 tag release loads the commercial player", () => {
  assert.match(loaderSource, /configVersion/);
  assert.match(loaderSource, /cache:\s*"default"/);
  assert.doesNotMatch(loaderSource, /nbx_cb/);
  assert.match(playerSource, /version-1-commercial-unified-auction/);
});
