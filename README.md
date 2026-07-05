# NexBanner

NexBanner is a 300x250 video-first monetization player designed to run inside a Google Ad Manager custom or third-party creative.

## Flow

```text
GAM serves NexBanner creative script
  -> NexBanner creates a 300x250 player
  -> Premium VAST video demand is tried first
  -> If video wins, muted outstream video plays in the banner
  -> If video fails, display demand renders
  -> If display fails, NexBanner ORTB/remnant fallback renders
  -> If all fail, the slot collapses or stays blank
```

## Files

- `src/nexbanner-gam.js` - single script used in GAM
- `src/nexbanner-player.js` - video-first player and fallback logic
- `demo/index.html` - local demo page
- `examples/gam-creative.html` - copy/paste GAM creative example
- `assets/` - demo display and VAST assets
- `docs/technical-blueprint.md` - product and integration notes

## GAM Creative Example

```html
<div id="nexbanner-slot-%%CACHEBUSTER%%"></div>
<script
  src="https://YOUR_DOMAIN/src/nexbanner-gam.js"
  data-target="nexbanner-slot-%%CACHEBUSTER%%"
  data-publisher-id="PUB_ID"
  data-placement-id="PLACEMENT_ID"
  data-width="300"
  data-height="250"
  data-mode="video-first"
  data-vast-url="https://YOUR_DOMAIN/assets/nexbanner-vast-tag.xml"
  data-display-image-url="https://YOUR_DOMAIN/assets/display-banner-1.png"
  data-remnant-image-url="https://YOUR_DOMAIN/assets/display-banner-2.png"
  data-logo-text="N"
  data-click-url="https://nexbid.uk">
</script>
```

## Production Hooks

Replace demo assets with live endpoints:

- `data-vast-url` - premium VAST auction endpoint
- `data-display-endpoint` - premium display endpoint returning JSON
- `data-ortb-endpoint` - final NexBanner ORTB fallback endpoint returning JSON
- `data-logo-url` - optional Nexbid logo image for the top-left badge

Expected JSON response:

```json
{
  "adType": "display",
  "imageUrl": "https://example.com/banner.png",
  "clickUrl": "https://advertiser.example",
  "impressionUrl": "https://track.example/imp",
  "cpm": 0.42,
  "layer": "premium-display"
}
```
