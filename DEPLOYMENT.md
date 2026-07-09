# AgroAI — Free-tier deployment guide

Deploy the full stack at **$0/month** using free tiers. This app needs three pieces:

| Layer | Free host | Why |
|-------|-----------|-----|
| **Git** | [GitHub](https://github.com) | Private repos, CI, connects to Vercel/Render |
| **Frontend** | [Vercel](https://vercel.com) or [Cloudflare Pages](https://pages.cloudflare.com) | Next.js, generous free bandwidth |
| **Database** | [Supabase](https://supabase.com) | PostgreSQL + **PostGIS** on free tier |
| **Backend + Python worker** | [Render](https://render.com) | Docker container with Node + Python + GDAL |

**Also free (no hosting):** Groq (chat), Copernicus CDSE + Earth Search STAC (satellite).

---

## Important limits on free tiers

| Service | Limit | Impact on AgroAI |
|---------|-------|------------------|
| **Supabase** | 500 MB DB, pauses after 1 week idle | Fine for demo; wake project from dashboard |
| **Supabase** | PostGIS included | Enable extension before migrations |
| **Render** | Web service sleeps after ~15 min idle | First API call after sleep takes 30–60 s |
| **Render** | No persistent disk on free | Satellite PNGs are **ephemeral** — refresh regenerates them |
| **Vercel Hobby** | Personal / non-commercial only | OK for portfolio & learning |
| **Railway** | No real free tier (~$5/mo) | Skip unless you can pay |
| **Fly.io** | No free tier for new accounts | ~$2–5/mo minimum |

**Recommendation:** Vercel (frontend) + Supabase (DB) + Render (API + worker). Total cost: **$0**.

---

## Architecture

```
Browser
   │
   ▼
Vercel (Next.js)  ──API──▶  Render (Express + python-worker)
   │                              │
   │                              ▼
   │                        Supabase Postgres + PostGIS
   │
   └── static assets, maps (MapLibre)
```

---

## Step 1 — Git + GitHub

```powershell
cd c:\Users\mmahd\crop-copilot
git init
git add .
git commit -m "Initial commit: AgroAI crop monitoring app"
```

Create a repo on GitHub (private is fine), then:

```powershell
git remote add origin https://github.com/YOUR_USER/crop-copilot.git
git branch -M main
git push -u origin main
```

Never commit `.env` files — they are in `.gitignore`.

---

## Step 2 — Supabase (database)

1. Sign up at [supabase.com](https://supabase.com) → **New project** (free).
2. **Database → Extensions** → enable **PostGIS**.
3. **Project Settings → Database** → copy the **Connection string** (URI mode).
   - Use the **Session pooler** URL (port `6543`) for Render.
   - Append `?sslmode=require` if not present.
4. Set `DATABASE_URL` locally and test migrations:

```powershell
cd backend
$env:DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require"
$env:DATABASE_SSL="true"
npm run db:migrate
```

---

## Step 3 — Render (backend + Python worker)

1. Sign up at [render.com](https://render.com) (no card needed for free tier).
2. **New → Blueprint** (or Web Service) → connect your GitHub repo.
3. Render reads `render.yaml` at repo root and builds the **Dockerfile**.
4. In the Render dashboard, set **secret** environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase connection string |
| `DATABASE_SSL` | `true` |
| `FRONTEND_URL` | `https://your-app.vercel.app` (set after Step 4) |
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |
| `CDSE_CLIENT_ID` | Optional — Copernicus Data Space |
| `CDSE_CLIENT_SECRET` | Optional |
| `EARTHSEARCH_FALLBACK` | `true` (works without CDSE keys) |
| `PYTHON_PATH` | `python3` (already in render.yaml) |

5. After deploy, note your API URL: `https://crop-copilot-api.onrender.com`
6. Hit `GET /health` — should return `{ "status": "ok", "database": "connected" }`.

**Cold starts:** On the free plan, the service sleeps when idle. The first request wakes it up (expect ~30–60 s). Satellite refresh can take 1–6 minutes regardless.

---

## Step 4 — Vercel (frontend)

1. Sign up at [vercel.com](https://vercel.com) → **Add New Project** → import GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Environment variable:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://crop-copilot-api.onrender.com` (no trailing slash) |

4. Deploy. Copy the Vercel URL (e.g. `https://crop-copilot.vercel.app`).
5. Go back to **Render** → set `FRONTEND_URL` to that Vercel URL → redeploy (for CORS).

---

## Step 5 — Verify

1. Open the Vercel URL.
2. Add a field on the map → Save.
3. Click **Refresh satellite** — first run may be slow (cold start + download).
4. Check chat with a Groq key configured.

---

## Alternative: Cloudflare Pages (frontend)

If you prefer Cloudflare over Vercel:

1. [Cloudflare Pages](https://pages.cloudflare.com) → connect GitHub repo.
2. Framework: **Next.js**, root: `frontend`.
3. Build: `npm run build`, output: `.next` (or use their Next.js preset).
4. Set `NEXT_PUBLIC_API_URL` as above.

Cloudflare free tier has generous bandwidth and no cold-start on static/edge assets.

---

## Optional upgrades (still cheap)

| Need | Option | Cost |
|------|--------|------|
| Persistent satellite images | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) (10 GB free) or Supabase Storage (1 GB) | $0 within limits |
| Always-on API (no sleep) | Render Starter plan | ~$7/mo |
| More DB space | Supabase Pro | $25/mo |
| Custom domain | Cloudflare DNS (free) + Vercel/Render | $0 |

---

## Local Docker test (optional)

```powershell
docker build -t crop-copilot-api .
docker run --rm -p 8000:8000 --env-file backend/.env crop-copilot-api
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `database: disconnected` on `/health` | Check `DATABASE_URL`, enable PostGIS, set `DATABASE_SSL=true` |
| CORS errors in browser | `FRONTEND_URL` on Render must exactly match Vercel URL (no trailing slash mismatch) |
| `Failed to start Python` | Render image includes Python + GDAL; `PYTHON_PATH=python3` |
| Satellite refresh 422 | Normal if no clear scene; try again or widen `MAX_CLOUD_COVER_PERCENT` |
| API very slow first time | Render free tier cold start — wait and retry |
| Imagery missing after restart | Expected on free Render — click Refresh again |
