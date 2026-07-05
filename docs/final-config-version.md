# NexBanner Final Config Version

The final product uses a short publisher tag and stores demand setup in the backend database.

## Publisher Tag

```html
<script
  src="https://nexbid.b-cdn.net/nexbanner/final/src/nexbanner-gam.js"
  data-config-id="NBX-12345"
  data-api-base="https://nexbid.uk">
</script>
```

## API

- `POST /api/v1/config` saves a dashboard configuration and returns a `configId`.
- `GET /api/v1/config/:id` returns the saved demand configuration.
- `GET /api/v1/vast` demo VAST endpoint.
- `GET /api/v1/auction` demo display/prebid/ORTB endpoint.
- `GET /api/v1/track` tracking pixel endpoint.

## Cloudflare Bindings

The Cloudflare Pages project needs:

- `NEXBANNER_CONFIGS` KV namespace for saved configs
- Optional `NEXBANNER_EVENTS` KV namespace for tracking events
