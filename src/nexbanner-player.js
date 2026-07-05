(function () {
  "use strict";

  window.NexBannerPlayer = { mount: mount };

  function mount(target, config) {
    var root = buildShell(target, config);
    track(config, "load", { layer: "gam-entry" });
    runVideoFirst(root, config);
  }

  function runVideoFirst(root, config) {
    setStatus(root, "Checking video demand");
    fetchVast(config)
      .then(function (vast) {
        if (!vast || !vast.mediaUrl) throw new Error("no-valid-vast");
        renderVideo(root, config, vast);
      })
      .catch(function (error) {
        track(config, "video_no_fill", { reason: error.message });
        runPrebid(root, config);
      });
  }

  function runPrebid(root, config) {
    setStatus(root, "Checking Prebid demand");
    fetchPrebidDecision(config)
      .then(function (ad) {
        if (!ad) throw new Error("no-prebid-ad");
        renderDisplay(root, config, ad);
      })
      .catch(function (error) {
        track(config, "prebid_no_fill", { reason: error.message });
        runAdserver(root, config);
      });
  }

  function runAdserver(root, config) {
    setStatus(root, "Checking ad server demand");
    fetchAdserverDecision(config)
      .then(function (ad) {
        if (!ad) throw new Error("no-adserver-ad");
        renderDisplay(root, config, ad);
      })
      .catch(function (error) {
        track(config, "adserver_no_fill", { reason: error.message });
        runRemnant(root, config);
      });
  }

  function runDisplay(root, config) {
    setStatus(root, "Checking display demand");
    fetchDisplayDecision(config)
      .then(function (ad) {
        if (!ad) throw new Error("no-display-ad");
        renderDisplay(root, config, ad);
      })
      .catch(function (error) {
        track(config, "display_no_fill", { reason: error.message });
        runRemnant(root, config);
      });
  }

  function runRemnant(root, config) {
    setStatus(root, "Checking final fallback");
    fetchRemnantDecision(config)
      .then(function (ad) {
        if (!ad) throw new Error("no-remnant-ad");
        renderDisplay(root, config, ad);
      })
      .catch(function (error) {
        track(config, "final_no_fill", { reason: error.message });
        renderNoAd(root, config);
      });
  }

  function fetchVast(config) {
    if (config.videoUrl) {
      return Promise.resolve({
        mediaUrl: resolveUrl(config.videoUrl, window.location.href),
        clickUrl: config.clickUrl,
        impressionUrl: config.impressionUrl,
        tracking: {},
        layer: "premium-vast-demo"
      });
    }

    var vastTags = listFrom(config.vastTags);
    if (config.vastUrl) vastTags.push(config.vastUrl);
    if (!vastTags.length) return Promise.reject(new Error("missing-vast-url"));

    return tryVastTags(vastTags, config, 0);
  }

  function tryVastTags(vastTags, config, index) {
    if (index >= vastTags.length) return Promise.reject(new Error("all-vast-no-fill"));
    var vastUrl = vastTags[index];

    return withTimeout(fetch(vastUrl, { credentials: "omit" }), config.timeoutMs)
      .then(function (response) {
        if (!response.ok) throw new Error("vast-http-" + response.status);
        return response.text();
      })
      .then(function (xmlText) {
        var xml = new DOMParser().parseFromString(xmlText, "text/xml");
        if (xml.querySelector("parsererror")) throw new Error("vast-parse-error");

        var media = firstText(xml, "MediaFile");
        if (!media) throw new Error("vast-no-media");

        return {
          mediaUrl: resolveUrl(media, vastUrl),
          clickUrl: firstText(xml, "ClickThrough") || config.clickUrl,
          impressionUrl: firstText(xml, "Impression"),
          tracking: trackingEvents(xml),
          layer: "premium-vast",
          sourceUrl: vastUrl
        };
      })
      .catch(function (error) {
        track(config, "vast_tag_failed", { layer: "premium-vast", reason: error.message });
        return tryVastTags(vastTags, config, index + 1);
      });
  }

  function fetchPrebidDecision(config) {
    if (config.prebidEndpoint) return jsonEndpoint(config.prebidEndpoint, config, "prebid");
    if (config.auctionEndpoint && config.prebidParams) return jsonEndpoint(config.auctionEndpoint, config, "prebid");
    return Promise.reject(new Error("missing-prebid-demand"));
  }

  function fetchAdserverDecision(config) {
    var scripts = []
      .concat(listFrom(config.displayScriptUrls))
      .concat(listFrom(config.adserverScriptUrls));

    if (config.displayScriptUrl) scripts.unshift(config.displayScriptUrl);
    if (!scripts.length) return Promise.reject(new Error("missing-adserver-tags"));

    return tryScriptTags(scripts, 0);
  }

  function tryScriptTags(scripts, index) {
    if (index >= scripts.length) return Promise.reject(new Error("all-adserver-tags-failed"));
    return Promise.resolve({
      adType: "display-js",
      scriptUrl: scripts[index],
      layer: index === 0 ? "display-js-tag" : "adserver-js-tag"
    });
  }

  function fetchDisplayDecision(config) {
    if (config.displayScriptUrl) {
      return Promise.resolve({
        adType: "display-js",
        scriptUrl: config.displayScriptUrl,
        clickUrl: config.clickUrl,
        layer: "display-js-tag"
      });
    }

    if (config.auctionEndpoint) return jsonEndpoint(config.auctionEndpoint, config, "premium-display");
    if (config.displayEndpoint) return jsonEndpoint(config.displayEndpoint, config, "premium-display");
    if (!config.displayImageUrl) return Promise.reject(new Error("missing-display-demand"));
    return Promise.resolve({
      adType: "display",
      imageUrl: config.displayImageUrl,
      clickUrl: config.clickUrl,
      impressionUrl: config.impressionUrl,
      layer: "premium-display-demo"
    });
  }

  function fetchRemnantDecision(config) {
    if (config.auctionEndpoint) return jsonEndpoint(config.auctionEndpoint, config, "remnant-ortb");
    if (config.ortbEndpoint) return jsonEndpoint(config.ortbEndpoint, config, "remnant-ortb");
    if (!config.remnantImageUrl) return Promise.reject(new Error("missing-remnant-demand"));
    return Promise.resolve({
      adType: "display",
      imageUrl: config.remnantImageUrl,
      clickUrl: config.clickUrl,
      layer: "remnant-demo"
    });
  }

  function jsonEndpoint(endpoint, config, layer) {
    var url = new URL(endpoint, window.location.href);
    url.searchParams.set("publisher_id", config.publisherId);
    url.searchParams.set("placement_id", config.placementId);
    url.searchParams.set("w", config.width);
    url.searchParams.set("h", config.height);
    url.searchParams.set("cb", config.cachebuster);
    url.searchParams.set("layer", layer);
    url.searchParams.set("page", safePageUrl());
    if (layer === "prebid" && config.prebidParams) url.searchParams.set("prebid_params", config.prebidParams);

    return withTimeout(fetch(url.toString(), { credentials: "omit" }), config.timeoutMs)
      .then(function (response) {
        if (!response.ok) throw new Error(layer + "-http-" + response.status);
        return response.json();
      })
      .then(function (ad) {
        if (!ad || (!ad.imageUrl && !ad.html && !ad.scriptUrl)) throw new Error(layer + "-empty");
        ad.layer = ad.layer || layer;
        return ad;
      });
  }

  function renderVideo(root, config, vast) {
    clear(root);
    track(config, "impression", { layer: vast.layer });
    pixel(vast.impressionUrl);

    var link = document.createElement("a");
    link.href = vast.clickUrl || config.clickUrl || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "nbx-click";

    var video = document.createElement("video");
    video.src = vast.mediaUrl;
    video.width = config.width;
    video.height = config.height;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.controls = false;
    video.preload = "auto";
    video.className = "nbx-video";

    var label = document.createElement("div");
    label.className = "nbx-label";
    label.textContent = "Ad";

    var fired = {};
    video.addEventListener("play", function () { fireOnce(fired, "start", vast, config); });
    video.addEventListener("timeupdate", function () {
      var ratio = video.duration ? video.currentTime / video.duration : 0;
      if (ratio >= 0.25) fireOnce(fired, "firstQuartile", vast, config);
      if (ratio >= 0.5) fireOnce(fired, "midpoint", vast, config);
      if (ratio >= 0.75) fireOnce(fired, "thirdQuartile", vast, config);
    });
    video.addEventListener("ended", function () { fireOnce(fired, "complete", vast, config); });
    video.addEventListener("error", function () {
      track(config, "video_error", { layer: vast.layer });
      runDisplay(root, config);
    });

    link.appendChild(video);
    root.appendChild(link);
    root.appendChild(brandBadge(config));
    root.appendChild(label);

    var playResult = video.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(function () {
        track(config, "autoplay_blocked", { layer: vast.layer });
        runDisplay(root, config);
      });
    }
  }

  function renderDisplay(root, config, ad) {
    clear(root);
    track(config, "impression", { layer: ad.layer || "display" });
    pixel(ad.impressionUrl);

    if (ad.html) {
      var frame = document.createElement("iframe");
      frame.title = "NexBanner ad";
      frame.width = config.width;
      frame.height = config.height;
      frame.setAttribute("scrolling", "no");
      frame.setAttribute("frameborder", "0");
      frame.className = "nbx-frame";
      root.appendChild(frame);
      frame.contentWindow.document.open();
      frame.contentWindow.document.write(ad.html);
      frame.contentWindow.document.close();
      root.appendChild(brandBadge(config));
      return;
    }

    if (ad.scriptUrl) {
      renderDisplayScript(root, config, ad);
      return;
    }

    var link = document.createElement("a");
    link.href = ad.clickUrl || config.clickUrl || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "nbx-click";

    var image = document.createElement("img");
    image.src = ad.imageUrl;
    image.width = config.width;
    image.height = config.height;
    image.alt = "Advertisement";
    image.className = "nbx-image";
    image.onerror = function () {
      track(config, "display_error", { layer: ad.layer || "display" });
      if ((ad.layer || "").indexOf("remnant") === -1) runRemnant(root, config);
      else renderNoAd(root, config);
    };

    link.appendChild(image);
    root.appendChild(link);
    root.appendChild(brandBadge(config));
  }

  function renderDisplayScript(root, config, ad) {
    var frame = document.createElement("iframe");
    frame.title = "NexBanner display tag";
    frame.width = config.width;
    frame.height = config.height;
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("frameborder", "0");
    frame.className = "nbx-frame";
    root.appendChild(frame);

    var safeScriptUrl = escapeAttribute(ad.scriptUrl);
    var html = [
      "<!doctype html>",
      "<html><head><meta charset=\"utf-8\">",
      "<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}</style>",
      "</head><body>",
      "<script src=\"" + safeScriptUrl + "\"><\\/script>",
      "</body></html>"
    ].join("");

    frame.contentWindow.document.open();
    frame.contentWindow.document.write(html);
    frame.contentWindow.document.close();
    root.appendChild(brandBadge(config));
  }

  function renderNoAd(root, config) {
    clear(root);
    root.className += " nbx-empty";
    track(config, "no_ad", { layer: "empty" });
  }

  function buildShell(target, config) {
    target.innerHTML = "";
    var root = document.createElement("div");
    root.className = "nbx-root";
    root.style.width = config.width + "px";
    root.style.height = config.height + "px";

    var style = document.createElement("style");
    style.textContent = [
      ".nbx-root{position:relative;overflow:hidden;background:#f3f6fb;color:#102033;font-family:Arial,Helvetica,sans-serif;line-height:1;}",
      ".nbx-click{display:block;width:100%;height:100%;text-decoration:none;color:inherit;}",
      ".nbx-video,.nbx-image,.nbx-frame{display:block;width:100%;height:100%;border:0;object-fit:cover;}",
      ".nbx-label{position:absolute;top:6px;right:6px;background:rgba(0,0,0,.62);color:#fff;font-size:10px;padding:3px 5px;border-radius:3px;}",
      ".nbx-brand{position:absolute;top:6px;left:6px;z-index:2;width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.92);box-shadow:0 2px 8px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;overflow:hidden;font-weight:700;font-size:16px;color:#1769e0;letter-spacing:0;}",
      ".nbx-brand img{display:block;width:100%;height:100%;object-fit:contain;}",
      ".nbx-status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#536273;background:#f7f9fc;}",
      ".nbx-empty{background:transparent;}"
    ].join("");

    target.appendChild(style);
    target.appendChild(root);
    return root;
  }

  function brandBadge(config) {
    var badge = document.createElement("div");
    badge.className = "nbx-brand";
    badge.title = "NexBanner";

    if (config.logoUrl) {
      var image = document.createElement("img");
      image.src = config.logoUrl;
      image.alt = "Nexbid";
      image.onerror = function () { badge.textContent = config.logoText || "N"; };
      badge.appendChild(image);
      return badge;
    }

    badge.textContent = config.logoText || "N";
    return badge;
  }

  function setStatus(root, message) {
    clear(root);
    var status = document.createElement("div");
    status.className = "nbx-status";
    status.textContent = message;
    root.appendChild(status);
  }

  function clear(root) {
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  function withTimeout(promise, timeoutMs) {
    var timeout;
    var timer = new Promise(function (_, reject) {
      timeout = window.setTimeout(function () { reject(new Error("timeout")); }, timeoutMs);
    });
    return Promise.race([promise, timer]).finally(function () { window.clearTimeout(timeout); });
  }

  function firstText(xml, selector) {
    var node = xml.querySelector(selector);
    return node && node.textContent ? node.textContent.trim() : "";
  }

  function trackingEvents(xml) {
    var events = {};
    var nodes = xml.querySelectorAll("Tracking[event]");
    Array.prototype.forEach.call(nodes, function (node) {
      var event = node.getAttribute("event");
      if (!events[event]) events[event] = [];
      events[event].push((node.textContent || "").trim());
    });
    return events;
  }

  function fireOnce(fired, eventName, vast, config) {
    if (fired[eventName]) return;
    fired[eventName] = true;
    track(config, "video_" + eventName, { layer: vast.layer });
    (vast.tracking[eventName] || []).forEach(pixel);
  }

  function track(config, eventName, data) {
    var payload = data || {};
    var endpoint = config.trackUrl || (eventName.indexOf("error") >= 0 ? config.errorUrl : "");
    if (!endpoint) return;

    var url = new URL(endpoint, window.location.href);
    url.searchParams.set("event", eventName);
    url.searchParams.set("publisher_id", config.publisherId);
    url.searchParams.set("placement_id", config.placementId);
    url.searchParams.set("layer", payload.layer || "");
    url.searchParams.set("reason", payload.reason || "");
    url.searchParams.set("cpm", payload.cpm || "");
    url.searchParams.set("w", config.width);
    url.searchParams.set("h", config.height);
    url.searchParams.set("cb", String(Date.now()) + Math.floor(Math.random() * 100000));
    pixel(url.toString());
  }

  function pixel(url) {
    if (!url) return;
    var image = new Image();
    image.src = url;
  }

  function resolveUrl(value, base) {
    try { return new URL(value, base).toString(); } catch (_) { return value; }
  }

  function listFrom(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value || "")
      .split("|")
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  function escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function safePageUrl() {
    try { return window.top.location.href; } catch (_) { return window.location.href; }
  }
})();
