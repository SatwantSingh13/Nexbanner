# Bunny.net CDN Deployment

NexBanner beta JS and assets can be published to Bunny.net by uploading them to a Bunny Storage Zone connected to a Bunny Pull Zone.

## Required Bunny.net Setup

Create or use an existing Bunny.net Storage Zone and Pull Zone.

You need:

- Storage zone name
- Storage zone password/access key
- Pull zone CDN hostname
- Storage region, only if the zone is not in the default region

## Environment Variables

Set these locally before deploying:

```powershell
$env:BUNNY_STORAGE_ZONE = "YOUR_STORAGE_ZONE_NAME"
$env:BUNNY_STORAGE_ACCESS_KEY = "YOUR_STORAGE_ZONE_PASSWORD"
$env:BUNNY_CDN_ROOT = "nexbanner/beta"
```

If your Bunny storage zone uses a regional endpoint, also set:

```powershell
$env:BUNNY_STORAGE_REGION = "ny"
```

Examples of regional prefixes are shown in Bunny.net storage docs. Leave `BUNNY_STORAGE_REGION` empty for the default `storage.bunnycdn.com` endpoint.

## Deploy

```bash
node scripts/deploy-bunny-cdn.js
```

The script uploads:

- `src/nexbanner-gam.js`
- `src/nexbanner-player.js`
- `assets/display-banner-1.png`
- `assets/display-banner-2.png`
- `assets/nexbanner-vast-tag.xml`
- `assets/nexbid-vast-tags.webm`

## Bunny CDN URL

If your Pull Zone hostname is:

```text
https://nexbid.b-cdn.net
```

Then the beta GAM script will be:

```text
https://nexbid.b-cdn.net/nexbanner/beta-v4/src/nexbanner-gam.js
```

## GAM Creative Tag

```html
<div id="nexbanner-slot-%%CACHEBUSTER%%"></div>
<script
  src="https://nexbid.b-cdn.net/nexbanner/beta-v4/src/nexbanner-gam.js"
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

## Cache Recommendation

For beta:

- Use short cache on JS while testing.
- Use longer cache on images/video.
- Keep path versioned as `/nexbanner/beta/`.

For production:

- Publish immutable versions like `/nexbanner/v1.0.0/`.
- Keep `/nexbanner/latest/` only for controlled testing.




