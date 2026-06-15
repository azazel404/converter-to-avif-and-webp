# Asset Optimizer — Frontend Image Conversion Microservice

Convert PNG, JPEG, GIF, TIFF, BMP, WebP, AVIF → **WebP / AVIF** (smart auto-pick per file), and **SVG → optimized SVG** via SVGO. Upload a `.zip` of your frontend assets, download a smaller `.zip` with mirrored folder structure and a `manifest.json` savings report.

---

## Monorepo Structure

```
converter-img-to-webp/
├── apps/
│   ├── api/          # Fastify REST API (Node.js 20 + sharp + svgo)
│   └── web/          # Vite + React 18 + TypeScript + shadcn/ui dashboard
├── packages/
│   └── shared/       # Shared TypeScript types (Job, Manifest, FileResult…)
├── docker-compose.yml
└── tsconfig.base.json
```

---

## Prerequisites

- **Node.js 20+**
- **npm 10+** — ships with Node 20 (no extra install needed)

---

## Quick Start (Local Dev)

```bash
# 1. Install all workspace deps
npm install

# 2. Build shared types (needed before running either app)
npm run build --workspace=packages/shared

# 3. Start API + Web in parallel
npm run dev
```

- **API**: http://localhost:3001
- **Dashboard**: http://localhost:5173

---

## API Reference

### `GET /health`
Returns service status, sharp/libvips versions.

### `POST /convert` — Single-file sync conversion
Upload one image, get back the optimized binary.

**Query params** (all optional):
| Param | Default | Description |
|-------|---------|-------------|
| `format` | `auto` | `webp` \| `avif` \| `auto` |
| `quality` | `82` | 1–100 |
| `lossless` | `false` | `true` for lossless WebP |

**Response headers**: `X-Original-Size`, `X-Converted-Size`, `X-Saved-Bytes`, `X-Saved-Percent`, `X-Chosen-Format`

```bash
curl -X POST "http://localhost:3001/convert?format=auto" \
  -F "file=@logo.png" \
  -o logo.webp
```

### `POST /jobs` — Zip batch conversion (primary flow)
Upload a `.zip` archive, receive a `jobId`.

```bash
curl -X POST "http://localhost:3001/jobs" \
  -F "file=@assets.zip" \
  | jq .jobId
```

### `GET /jobs/:id` — Poll job status
Returns `queued | processing | completed | failed` + progress, file counts, manifest on completion.

### `GET /jobs/:id/download` — Download result zip
Streams `assets-optimized.zip` with mirrored folder structure + `manifest.json`.

```bash
curl "http://localhost:3001/jobs/<JOB_ID>/download" -o assets-optimized.zip
```

---

## Configuration

Copy `apps/api/.env.example` to `apps/api/.env` and adjust:

```env
PORT=3001
MAX_ZIP_SIZE=524288000        # 500 MB
MAX_FILES_PER_ZIP=500
DEFAULT_QUALITY=82
QUALITY_THRESHOLD=0.95
WORKER_CONCURRENCY=4
JOB_TTL_MS=3600000            # 1 hour
CORS_ORIGINS=http://localhost:5173
```

---

## Docker

```bash
# Build & run API only
docker compose up --build

# API will be available at http://localhost:3001
```

---

## CI Integration (GitHub Actions example)

```yaml
- name: Optimize frontend assets
  run: |
    cd apps/your-frontend
    zip -r assets.zip src/assets/
    JOB=$(curl -s -X POST http://localhost:3001/jobs -F "file=@assets.zip" | jq -r .jobId)
    # Poll until done
    while true; do
      STATUS=$(curl -s http://localhost:3001/jobs/$JOB | jq -r .status)
      [ "$STATUS" = "completed" ] && break
      [ "$STATUS" = "failed" ] && exit 1
      sleep 2
    done
    curl -s http://localhost:3001/jobs/$JOB/download -o assets-optimized.zip
    unzip -o assets-optimized.zip -d src/assets/
```

---

## Output zip structure

Given input:
```
assets.zip
  icons/logo.jpg
  images/hero.png
  brand/logo.svg
```

Output `assets-optimized.zip`:
```
  icons/logo.webp          ← or .avif, whichever is smaller
  images/hero.avif
  brand/logo.svg           ← minified via SVGO
  manifest.json            ← per-file + aggregate savings report
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API runtime | Node.js 20, TypeScript, ESM |
| API framework | Fastify 4 |
| Image conversion | sharp (libvips) |
| SVG optimization | svgo |
| Zip handling | unzipper + archiver |
| Concurrency | p-limit |
| Frontend | Vite 5 + React 18 + TypeScript |
| UI components | shadcn/ui (Radix UI) + Tailwind CSS |
| Icons | lucide-react |
| Toasts | sonner |
| Container | Docker (node:20-slim) |
# converter-to-avif-and-webp
