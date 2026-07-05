(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var config = readConfig(script);
  var target = resolveTarget(config, script);
  if (!target) return;

  target.style.width = config.width + "px";
  target.style.height = config.height + "px";
  target.style.overflow = "hidden";

  loadPlayer(script.src, function () {
    if (!window.NexBannerPlayer) return;
    window.NexBannerPlayer.mount(target, config);
  });

  function readConfig(node) {
    var data = node.dataset || {};
    return {
      publisherId: data.publisherId || "",
      placementId: data.placementId || "",
      target: data.target || "",
      width: numberOr(data.width, 300),
      height: numberOr(data.height, 250),
      mode: data.mode || "video-first",
      vastUrl: data.vastUrl || "",
      videoUrl: data.videoUrl || "",
      auctionEndpoint: data.auctionEndpoint || "",
      displayEndpoint: data.displayEndpoint || "",
      displayScriptUrl: data.displayScriptUrl || "",
      ortbEndpoint: data.ortbEndpoint || "",
      displayImageUrl: data.displayImageUrl || "",
      remnantImageUrl: data.remnantImageUrl || "",
      clickUrl: data.clickUrl || "",
      logoUrl: data.logoUrl || "",
      logoText: data.logoText || "N",
      trackUrl: data.trackUrl || "",
      impressionUrl: data.impressionUrl || "",
      errorUrl: data.errorUrl || "",
      timeoutMs: numberOr(data.timeoutMs, 1800),
      cachebuster: String(Date.now()) + Math.floor(Math.random() * 1000000)
    };
  }

  function resolveTarget(config, node) {
    if (config.target) {
      var found = document.getElementById(config.target);
      if (found) return found;
    }

    var fallback = document.createElement("div");
    fallback.id = "nexbanner-slot-" + config.cachebuster;
    node.parentNode.insertBefore(fallback, node);
    return fallback;
  }

  function loadPlayer(currentScriptUrl, done) {
    if (window.NexBannerPlayer) {
      done();
      return;
    }

    var playerUrl = new URL("nexbanner-player.js", currentScriptUrl).toString();
    var playerScript = document.createElement("script");
    playerScript.async = true;
    playerScript.src = playerUrl;
    playerScript.onload = done;
    playerScript.onerror = done;
    document.head.appendChild(playerScript);
  }

  function numberOr(value, fallback) {
    var parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
})();
