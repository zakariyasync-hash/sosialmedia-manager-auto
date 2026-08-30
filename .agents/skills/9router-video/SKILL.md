---
name: 9router-video
description: Generate videos via 9Router /v1/videos/generations using xAI Grok Imagine (grok-imagine-video). Async job flow - submit, poll request_id until done, download MP4. Use when the user wants to create, generate, or render a video, text-to-video (txt2vid), or image-to-video.
---

# 9Router — Video Generation (xAI Grok Imagine)

Requires `NINEROUTER_URL` (and `NINEROUTER_KEY` if auth enabled).

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /v1/videos/generations` | text-to-video / image-to-video |
| `POST /v1/videos/edits` | edit an existing video |
| `POST /v1/videos/extensions` | extend an existing video |
| `GET /v1/videos/{request_id}` | poll job status |

## Examples

Submit a job:

```bash
curl -X POST "$NINEROUTER_URL/v1/videos/generations" \
  -H "Authorization: Bearer $NINEROUTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"xai/grok-imagine-video","prompt":"A cinematic tracking shot through a neon city at night","duration":8,"aspect_ratio":"16:9","resolution":"720p"}'
# → {"request_id":"abc123"}
```

Poll until done:

```bash
curl "$NINEROUTER_URL/v1/videos/abc123" \
  -H "Authorization: Bearer $NINEROUTER_KEY" \
  -H "x-connection-id: <id from create response>"
# → {"status":"done","video":{"url":"https://…mp4","duration":8},"model":"grok-imagine-video"}
```
