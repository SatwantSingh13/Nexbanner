export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const event = {
    ts: new Date().toISOString(),
    event: url.searchParams.get("event") || "unknown",
    publisherId: url.searchParams.get("publisher_id") || "",
    placementId: url.searchParams.get("placement_id") || "",
    layer: url.searchParams.get("layer") || "",
    cpm: url.searchParams.get("cpm") || "",
    reason: url.searchParams.get("reason") || "",
  };

  if (context.env.NEXBANNER_EVENTS && context.env.NEXBANNER_EVENTS.put) {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await context.env.NEXBANNER_EVENTS.put(key, JSON.stringify(event), { expirationTtl: 60 * 60 * 24 * 30 });
  }

  const pixel = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,255,255,255,0,0,0,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);
  return new Response(pixel, {
    headers: { "content-type": "image/gif", "cache-control": "no-store", ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}
