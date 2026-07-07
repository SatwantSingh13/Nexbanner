export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const configId = body.configId || makeConfigId();
    const config = normalizeConfig(configId, body);

    const store = context.env.NEXBANNER_CONFIGS;
    if (!store || !store.put) {
      return json({ ok: false, error: "missing_NEXBANNER_CONFIGS_binding" }, 500);
    }

    await store.put(configId, JSON.stringify(config));

    return json({
      ok: true,
      configId,
      tag: shortTag(configId, config),
    });
  } catch (error) {
    return json({ ok: false, error: error.message || "invalid_config" }, 400);
  }
}

function normalizeConfig(configId, body) {
  const setup = body.setup || {};
  const demand = Array.isArray(body.demand) ? body.demand : [];
  const vast = Array.isArray(body.vast) ? body.vast : [];
  const displayTags = Array.isArray(body.displayTags) ? body.displayTags : [];
  const prebid = Array.isArray(body.prebid) ? body.prebid : [];
  const adserverTags = Array.isArray(body.adserverTags) ? body.adserverTags : [];
  const apiBase = trimSlash(setup.apiBase || "https://nexbid.uk");
  const vastDemand = demand.filter((item) => item.type === "vast").concat(vast);
  const prebidDemand = prebid.map((item) => ({
    name: item.name || "",
    endpoint: endpointOf(item) || `${apiBase}/api/v1/auction`,
    params: item.params || "",
    floorCpm: item.floorCpm || "",
    timeoutMs: item.timeoutMs || "",
  })).filter((item) => item.endpoint || item.params);
  const vastDemandItems = vastDemand.map((item) => ({
    name: item.name || "",
    endpoint: endpointOf(item),
    floorCpm: item.floorCpm || "",
    timeoutMs: item.timeoutMs || "",
  })).filter((item) => item.endpoint);
  const displayScriptDemand = displayTags.map((item) => ({
    name: item.name || "",
    endpoint: endpointOf(item),
    floorCpm: item.floorCpm || "",
    timeoutMs: item.timeoutMs || "",
  })).filter((item) => item.endpoint);
  const adserverScriptDemand = adserverTags
    .filter((item) => item.tagType === "script")
    .map((item) => ({
      name: item.name || "",
      endpoint: endpointOf(item),
      floorCpm: item.floorCpm || "",
      timeoutMs: item.timeoutMs || "",
    }))
    .filter((item) => item.endpoint);
  const adserverHtmlDemand = adserverTags
    .filter((item) => item.tagType === "html")
    .map((item) => ({
      name: item.name || "",
      html: encodeURIComponent(item.html || ""),
      floorCpm: item.floorCpm || "",
      timeoutMs: item.timeoutMs || "",
    }))
    .filter((item) => item.html);
  const ortbEndpoints = demand
    .filter((item) => item.type === "ortb")
    .map(endpointOf)
    .filter(Boolean);
  const ortbDemand = demand
    .filter((item) => item.type === "ortb")
    .map((item) => ({
      name: item.name || "",
      endpoint: endpointOf(item),
      floorCpm: item.floorCpm || "",
      timeoutMs: item.timeoutMs || "",
    }))
    .filter((item) => item.endpoint);

  return {
    configId,
    productVersion: "Version 1",
    publisherId: setup.publisherId || "",
    placementId: setup.placementId || "",
    width: Number(setup.width || 300),
    height: Number(setup.height || 250),
    mode: "video-first",
    vastDemand: vastDemandItems,
    vastTags: vastDemandItems.map((item) => item.endpoint),
    prebidDemand,
    prebidEndpoint: (prebidDemand[0] || {}).endpoint || `${apiBase}/api/v1/auction`,
    prebidParams: (prebidDemand[0] || {}).params || "",
    displayScriptDemand,
    displayScriptUrls: displayScriptDemand.map((item) => item.endpoint),
    adserverScriptDemand,
    adserverScriptUrls: adserverScriptDemand.map((item) => item.endpoint),
    adserverHtmlDemand,
    adserverHtmlTags: adserverHtmlDemand.map((item) => item.html),
    displayEndpoint: endpointOf(demand.find((item) => item.type === "display") || {}) || "",
    ortbDemand,
    ortbEndpoints,
    ortbEndpoint: ortbEndpoints[0] || `${apiBase}/api/v1/auction`,
    auctionEndpoint: `${apiBase}/api/v1/auction`,
    trackUrl: `${apiBase}/api/v1/track`,
    rotationMs: Number(body.rotationMs || setup.rotationMs || 10000),
    logoText: "N",
    clickUrl: "https://nexbid.uk",
  };
}

function endpointOf(item) {
  return item.endpoint || item.url || item.tag || "";
}

function shortTag(configId, config) {
  const cdnScript = "https://nexbid.uk/nexbanner/final/src/nexbanner-gam.js";
  return `<script src="${cdnScript}" data-config-id="${configId}" data-api-base="https://nexbid.uk"></script>`;
}

function makeConfigId() {
  return `NBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10000)}`;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
