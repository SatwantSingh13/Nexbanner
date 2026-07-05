# NexBanner Demand Flow

This is the beta product flow.

```text
1. VAST tags
   - Try all configured VAST tags in order.
   - If any VAST returns valid media, deliver video in the 300x250 player.

2. Prebid parameters
   - If VAST has no fill, pass Prebid parameters to the Prebid/auction endpoint.
   - If a valid display winner is returned, deliver it.

3. Ad Manager / MI accounts
   - If Prebid has no fill, try configured ad-server JS tags.
   - Multiple MI/account tags can be added and tried in order.

4. ORTB AdExchange fallback
   - If ad-server demand has no fill, pass the impression to ORTB fallback.
   - If no ORTB winner exists, return no-fill/collapse.
```

## Publisher Tag Attributes

Multiple VAST tags:

```html
data-vast-tags="https://vast1.com/tag|https://vast2.com/tag"
```

Prebid:

```html
data-prebid-endpoint="https://api.nexbanner.com/api/v1/auction"
data-prebid-params='{"bidder":"partner","params":{"placementId":"123"}}'
```

Multiple Display JS tags:

```html
data-display-script-urls="https://display1.com/tag.js|https://display2.com/tag.js"
```

Multiple ad-server / MI tags:

```html
data-adserver-script-urls="https://mi1.com/tag.js|https://mi2.com/tag.js"
```

ORTB fallback:

```html
data-ortb-endpoint="https://api.nexbanner.com/api/v1/auction"
```
