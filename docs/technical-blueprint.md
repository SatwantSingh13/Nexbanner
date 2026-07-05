# NexBanner Technical Blueprint

## Product

NexBanner is a single GAM creative script for a 300x250 banner placement. It loads a branded mini player and monetizes video first, then display, then final ORTB/remnant fallback.

## Flow

```text
GAM creative
  -> nexbanner-gam.js
  -> nexbanner-player.js
  -> VAST video demand
  -> display demand
  -> ORTB/remnant fallback
  -> tracking and reporting
```

## Production Integrations

- Replace demo `data-vast-url` with the NexBanner premium VAST auction endpoint.
- Replace `data-display-image-url` with `data-display-endpoint` for premium display auction JSON.
- Replace `data-remnant-image-url` with `data-ortb-endpoint` for final NexBanner AdX fallback JSON.
- Add `data-logo-url` when a final Nexbid logo file is available.
- Keep video muted, inline, and lightweight for publisher acceptance.

## Tracking Events

- `load`
- `impression`
- `video_start`
- `video_firstQuartile`
- `video_midpoint`
- `video_thirdQuartile`
- `video_complete`
- `video_error`
- `display_no_fill`
- `final_no_fill`
- `no_ad`
