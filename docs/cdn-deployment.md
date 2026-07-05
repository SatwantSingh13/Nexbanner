# NexBanner CDN Deployment

## CDN Files

These files should be served through CDN:

- `src/nexbanner-gam.js`
- `src/nexbanner-player.js`
- `assets/display-banner-1.png`
- `assets/display-banner-2.png`
- `assets/nexbanner-vast-tag.xml`
- `assets/nexbid-vast-tags.webm`

## Recommended CDN Path

Use a versioned path:

```text
https://nexbid.b-cdn.net/nexbanner/beta-v5/src/nexbanner-gam.js
https://nexbid.b-cdn.net/nexbanner/beta-v5/src/nexbanner-player.js
```

For Bunny.net deployment instructions, see:

```text
docs/bunny-cdn.md
```

## GAM Creative Tag With CDN Script

```html
<div id="nexbanner-slot-%%CACHEBUSTER%%"></div>
<script
  src="https://nexbid.b-cdn.net/nexbanner/beta-v5/src/nexbanner-gam.js"
  data-target="nexbanner-slot-%%CACHEBUSTER%%"
  data-publisher-id="PUB_ID"
  data-placement-id="PLACEMENT_ID"
  data-width="300"
  data-height="250"
  data-mode="video-first"
  data-vast-url="https://api.nexbanner.com/api/v1/vast"
  data-auction-endpoint="https://api.nexbanner.com/api/v1/auction"
  data-track-url="https://api.nexbanner.com/api/v1/track"
  data-logo-text="N"
  data-click-url="https://nexbid.uk">
</script>
```

## Cache Rules

For beta:

- HTML/demo pages: `no-store` or short cache
- JS files: short cache until stable
- Assets/video: long cache

For production:

- Use immutable versioned paths like `/nexbanner/v1.0.0/`
- Keep `/nexbanner/latest/` only for controlled testing





