# NexBanner Beta Product

## Product Definition

NexBanner Beta is a 300x250 video-first monetization product for Google Ad Manager placements.

It includes:

- Single GAM creative script
- Branded 300x250 mini player
- Premium VAST endpoint
- Premium display auction endpoint
- Final remnant ORTB fallback endpoint
- Tracking pixel endpoint
- Revenue and fill report endpoint

## Beta Flow

```text
GAM creative
  -> NexBanner script
  -> NexBanner player
  -> Premium VAST
  -> Premium display auction
  -> Remnant ORTB fallback
  -> Tracking and reporting
```

## Local Beta Server

Start:

```bash
node server/nexbanner-beta-server.js
```

Open:

```text
http://localhost:8080/demo/beta.html
```

Report:

```text
http://localhost:8080/api/v1/report
```

## Production Endpoints

Use these paths when deploying the beta API:

- `GET /health`
- `GET /api/v1/vast`
- `GET /api/v1/auction`
- `GET /api/v1/track`
- `GET /api/v1/report`

## CDN Recommendation

For beta testing with publishers, serve these files through a CDN:

- `src/nexbanner-gam.js`
- `src/nexbanner-player.js`
- logo/image assets

The API endpoints can run separately on `api.nexbanner.com` or another backend host.
