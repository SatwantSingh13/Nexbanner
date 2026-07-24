// NexBanner Version 3 commercial-auction tracking fields and events.
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  const event = {
    ts: new Date().toISOString(),
    event: url.searchParams.get("event") || "unknown",
    configId: url.searchParams.get("config_id") || "",
    productVersion: url.searchParams.get("product_version") || "",
    rotationMode: url.searchParams.get("rotation_mode") || "",
    publisherId: url.searchParams.get("publisher_id") || "",
    publisherDomain: url.searchParams.get("publisher_domain") || "",
    placementId: url.searchParams.get("placement_id") || "",
    layer: url.searchParams.get("layer") || "",
    requestId: url.searchParams.get("request_id") || "",
    partnerName: url.searchParams.get("partner_name") || "",
    cpm: url.searchParams.get("cpm") || "",
    auctionId: url.searchParams.get("auction_id") || "",
    demandType: url.searchParams.get("demand_type") || "",
    bidMode: url.searchParams.get("bid_mode") || "",
    currency: url.searchParams.get("currency") || "",
    responseTimeMs: url.searchParams.get("response_time_ms") || "",
    intersectionRatio: url.searchParams.get("intersection_ratio") || "",
    reason: url.searchParams.get("reason") || "",
  };

  const queue = context.env.EVENTS_QUEUE;

  if (!queue || typeof queue.send !== "function") {
    console.error("Missing EVENTS_QUEUE binding");
    return pixelResponse(503, "missing-binding");
  }

  try {
    await queue.send(event);
    return pixelResponse(200, "queued");
  } catch (error) {
    console.error("Failed to enqueue NexBanner event", {
      event: event.event,
      configId: event.configId,
      requestId: event.requestId,
      message: error instanceof Error ? error.message : String(error),
    });

    return pixelResponse(503, "queue-error");
  }
}

function pixelResponse(status, queueStatus) {
  const pixel = Uint8Array.from([
    71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 255, 255, 255,
    0, 0, 0, 33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1,
    0, 0, 2, 2, 68, 1, 0, 59,
  ]);

  return new Response(pixel, {
    status,
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-nexbanner-event-status": queueStatus,
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}
