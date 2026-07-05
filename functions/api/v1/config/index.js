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
  const displayTags = Array.isArray(body.displayTags) ? body.displayTags : [];
  const prebid = Array.isArray(body.prebid) ? body.prebid : [];
  const adserverTags = Array.isArray(body.adserverTags) ? body.adserverTags : [];
  const apiBase = trimSlash(setup.apiBase || "https://nexbid.uk");
  const prebidItem = prebid[0] || {};

  return {
    configId,
    publisherId: setup.publisherId || "",
    placementId: setup.placementId || "",
    width: Number(setup.width || 300),
    height: Number(setup.height || 250),
    mode: "video-first",
    vastTags: demand.filter((item) => item.type === "vast").map((item) => item.endpoint).filter(Boolean),
    prebidEndpoint: prebidItem.endpoint || `${apiBase}/api/v1/auction`,
    prebidParams: prebidItem.params || "",
    displayScriptUrls: displayTags.map((item) => item.endpoint).filter(Boolean),
    adserverScriptUrls: adserverTags.filter((item) => item.tagType === "script").map((item) => item.endpoint).filter(Boolean),
    adserverHtmlTags: adserverTags.filter((item) => item.tagType === "html").map((item) => encodeURIComponent(item.html || "")).filter(Boolean),
    displayEndpoint: (demand.find((item) => item.type === "display") || {}).endpoint || "",
    ortbEndpoint: (demand.find((item) => item.type === "ortb") || {}).endpoint || `${apiBase}/api/v1/auction`,
    auctionEndpoint: `${apiBase}/api/v1/auction`,
    trackUrl: `${apiBase}/api/v1/track`,
    logoText: "N",
    clickUrl: "https://nexbid.uk",
  };
}

function shortTag(configId, config) {
  const cdnScript = "https://nexbid.b-cdn.net/nexbanner/final/src/nexbanner-gam.js";
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
