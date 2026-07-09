# Crop Health Copilot — MVP Project Specification (Student Edition, 100% Free Stack)

> **Purpose of this document:** A complete build spec to hand to Cursor. This version is optimized for: (1) an MVP a real farmer could actually use and understand, not just a technical demo, and (2) a 100% free / open-source stack suitable for a student with no budget — every paid tool has been swapped for a free alternative, and every place you need to sign up for something or download data manually is called out explicitly with exact steps.

---

## 1. Who This Is Actually For (read this first)

Before any code — the person using this is **not** a GIS expert. Design every screen and every chatbot reply around a farmer or field agronomist who:
- Doesn't know what "NDVI" or "z-score" means unless you explain it in one plain sentence
- Wants a fast yes/no/how-worried-should-I-be answer, not a dashboard full of numbers
- Trusts color (green/yellow/red) and simple words more than charts
- May be checking this on a phone in a field with a weak connection

**Design rule for the whole project:** every technical output (NDVI value, anomaly z-score, model confidence) must be translated into one of three things before it reaches the user:
1. A **color** (🟢 Healthy / 🟡 Monitor / 🔴 Needs attention)
2. A **one-sentence plain-language explanation** ("Your field's greenness is lower than usual for this time of year — worth checking the north side for water stress")
3. An optional **"why?" expand** for anyone curious, where the technical detail lives

This is what makes the difference between a GIS-nerd side project and something that reads as "I built something people would actually use" — say this explicitly in your README and resume framing.

---

## 2. The End-User Journey (non-technical walkthrough)

This is what the person actually experiences, screen by screen. Cursor should build the UI around this flow, not the other way around.

1. **Add a field** — Farmer draws their field boundary on a map (tap to draw corners) or types their village/area name to search and drop a pin, then draws around it. They name it ("North Wheat Field") and pick a crop from a simple dropdown (wheat, rice, cotton, maize, other).
2. **See a home screen with a color-coded card per field** — 🟢🟡🔴 dot, field name, one-line status ("Looking healthy" / "Slight stress detected"), last-updated date.
3. **Tap a field → simple health screen** — a colored badge, one plain sentence explanation, a simple trend line ("greener" vs "less green" over recent weeks — avoid the word NDVI on this screen, just call it a "greenness score"), and a map with the field colored by health.
4. **Chat with the assistant** — a text box: "How's my field doing?", "Should I be worried?", "What does this mean for my harvest?" The assistant replies in plain, warm, farmer-friendly language — never dumps raw numbers unless asked "why" or "show me the details."
5. **Optional: Refresh button** — "Check for latest satellite update" with a simple loading state ("Checking the sky for new pictures of your field...").

**Stretch/nice-to-have (mention in README even if not built for MVP):** a language toggle (e.g., Urdu, since this is very relevant if you're demoing in Pakistan/South Asia) and a "read this out loud" button for low-literacy accessibility — both are strong, genuine differentiators if you have time, and worth listing as a "future work" section even if unbuilt, since it shows real-world thinking.

---

## 3. Fully Free / Open-Source Tech Stack

Every single tool below is free, has a generous free tier, or is fully open-source with no card required. Paid alternatives (Mapbox, OpenAI, Airflow-managed-cloud, etc.) have been swapped out.

| Layer | Tool | Cost | Notes |
|---|---|---|---|
| Satellite imagery | **Element84 Earth Search STAC API** | Free, **no API key needed at all** | Public Sentinel-2 catalog, no signup |
| Raster processing | `rasterio` + `GDAL` | Free, open-source | Python libraries, no account needed |
| Vector/zonal stats | `geopandas` | Free, open-source | — |
| ML training data | `EuroSAT` via `torchgeo` | Free, auto-downloads | No manual download, no account — `torchgeo` fetches it for you (~2GB) |
| ML framework | `torch` + `torchgeo` | Free, open-source | Trains fine on a free Google Colab GPU if your laptop has no GPU |
| Backend API | `FastAPI` | Free, open-source | — |
| Database | **Supabase** (free tier, PostGIS built in) | Free (500MB DB, no card required) | Sign-up steps below |
| Conversational LLM | **Groq API** (Llama 3.3 70B) | Free tier, very generous, extremely fast | Sign-up steps below — this is also why responses will feel "instant," which matters for your "fast" requirement |
| Base map tiles | **OpenFreeMap** | Free, open-source, **no API key needed** | Alternative to Mapbox, zero signup |
| Map rendering | `MapLibre GL JS` + `deck.gl` | Free, open-source | — |
| Charts | `recharts` | Free, open-source | — |
| Frontend | `React` + `Vite` + `Tailwind CSS` | Free, open-source | — |
| Scheduling (MVP) | A simple Python script run via free GitHub Actions cron | Free | Skip Airflow entirely for MVP — it's overkill and adds setup pain for no user-facing benefit at this stage |
| Backend hosting | **Render.com free web service** | Free (sleeps after 15 min idle — fine for a portfolio demo) | Sign-up steps below |
| Frontend hosting | **Vercel free tier** | Free, no card required | Sign-up steps below |

**Total monthly cost: $0.** Everything above works within free-tier limits for a portfolio-scale MVP (a handful of demo fields, not thousands of real farmers).

---

## 4. Every Account You Need to Create (step-by-step)

Do these once, at the start, before writing any code. Save every key into a `.env` file (template in Section 9) — never commit this file to GitHub.

### 4.1 Groq API key (for the chatbot — free & fast)
1. Go to **https://console.groq.com**
2. Sign up with Google or GitHub (no credit card required)
3. Go to **API Keys** in the left sidebar → **Create API Key**
4. Copy the key immediately (it's only shown once) → paste into your `.env` as `GROQ_API_KEY`
5. Free tier gives you a generous number of requests per day — more than enough for building and demoing an MVP. Model to use: `llama-3.3-70b-versatile`

### 4.2 Supabase (database — free, includes PostGIS)
1. Go to **https://supabase.com** → Sign up (Google/GitHub, no card required)
2. Click **New Project** → give it a name (e.g., `crop-health-copilot`) → choose a free region close to you → set a database password (save it somewhere safe)
3. Once the project is created, go to **Database → Extensions** in the sidebar → search for `postgis` → click to **enable** it
4. Go to **Project Settings → Database → Connection string** → copy the URI (looks like `postgresql://postgres:[YOUR-PASSWORD]@...supabase.co:5432/postgres`) → paste into `.env` as `DATABASE_URL`

### 4.3 Element84 Earth Search (satellite imagery — no signup needed)
- Nothing to do here. The endpoint `https://earth-search.aws.element84.com/v1` is public. Just use it directly in `stac_client.py`.

### 4.4 Render.com (backend hosting — free, for when you deploy)
1. Go to **https://render.com** → Sign up with GitHub (no card required)
2. When ready to deploy: **New → Web Service** → connect your GitHub repo → Render auto-detects Python → set the start command to `uvicorn app.main:app --host 0.0.0.0 --port 10000`
3. Add your `.env` values under **Environment** in the Render dashboard
4. Note: free tier services "sleep" after 15 minutes of no traffic and take ~30-60 seconds to wake up on the next request — completely fine for a portfolio demo, just mention it in your README so reviewers aren't confused by a slow first load

### 4.5 Vercel (frontend hosting — free, for when you deploy)
1. Go to **https://vercel.com** → Sign up with GitHub (no card required)
2. **Add New Project** → import your repo → set the root directory to `frontend/` → deploy
3. Add `VITE_API_URL` (pointing to your Render backend URL) as an environment variable in Vercel's project settings

### 4.6 Google Colab (optional — only if your laptop has no GPU for training)
1. Go to **https://colab.research.google.com** → sign in with any Google account, nothing else needed
2. Free GPU (T4) is available with usage limits reset daily — plenty for training a small ResNet-18 on EuroSAT
3. Upload your `train.py` and `dataset.py`, run there, download the resulting `.ckpt` checkpoint file, and place it in `backend/ml/checkpoints/` in your local repo

**That's the complete list. Five free accounts, zero credit cards, zero paid tiers.**

---

## 5. Data — What Downloads Automatically vs. What You Do Manually

**Good news for an MVP: nothing requires a manual download.**

- **Satellite imagery (Sentinel-2):** pulled live and automatically through the Earth Search STAC API each time you request it for a field — no download step, no account.
- **Model training data (EuroSAT):** `torchgeo.datasets.EuroSAT(root="data/", download=True)` fetches and unpacks it automatically the first time your training script runs (~2GB, takes a few minutes depending on connection). You don't manually download or unzip anything.
- **Field boundaries for your demo:** since you won't have real farmer data yet, you have two options:
  1. **Draw them yourself** — use the field-draw tool you're building, drawing 3-5 sample rectangles over real farmland (e.g., use Google Maps satellite view to find visible farm plots near you, in Punjab, and roughly trace their shape) — this is the fastest option and genuinely fine for a portfolio MVP.
  2. **Use an open boundary dataset** — if you want real-world boundary data, search **https://data.apps.fao.org** (FAO's open geospatial data portal) or **https://gadm.org** for regional agricultural/admin boundaries you could adapt. This is optional and not required to get a working demo.

**If you later want real disease-labeled imagery for a more advanced model (stretch goal, not MVP):** the **PlantVillage dataset** (leaf disease images, not satellite, but useful for a future "upload a leaf photo" feature) is free and manually downloadable from **https://www.kaggle.com/datasets/emmarex/plantdisease** — requires a free Kaggle account and clicking "Download." Not needed for the MVP described here.

---

## 6. Simplified Architecture (MVP version)

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite, hosted free on Vercel)          │
│  - Simple color-coded field cards (no jargon)             │
│  - Map (MapLibre + OpenFreeMap, no API key)                │
│  - Chat box (plain language, farmer-friendly)               │
└───────────────────────┬───────────────────────────────────┘
                         │ REST API
┌───────────────────────▼───────────────────────────────────┐
│  BACKEND (FastAPI, hosted free on Render)                   │
│  - /fields          → create/view field boundaries          │
│  - /analysis/latest → returns color + plain-language status │
│  - /chat            → Groq LLM, function-calling over data   │
└───────────────────────┬───────────────────────────────────┘
                         │
┌───────────────────────▼───────────────────────────────────┐
│  DATA LAYER                                                  │
│  - Supabase (Postgres + PostGIS, free)                        │
│  - Earth Search STAC (Sentinel-2, free, no key)                │
│  - rasterio/GDAL/geopandas (NDVI + zonal stats)                 │
│  - Trained ResNet-18 on EuroSAT (crop/land classification)       │
└───────────────────────┬───────────────────────────────────┘
                         │
┌───────────────────────▼───────────────────────────────────┐
│  SCHEDULING (simple, free)                                    │
│  - A Python script run via free GitHub Actions cron            │
│    (e.g., daily) instead of a full Airflow deployment            │
└─────────────────────────────────────────────────────────────┘
```

**What changed from a "full production" version, and why:** Airflow, Docker Compose with 5 services, and paid map tiles all add real setup time without improving what a farmer actually experiences. For an MVP/student project, a GitHub Actions scheduled workflow (free, built into any GitHub repo, no extra account) does the same job — pull new imagery, run inference, update the database — with a fraction of the setup complexity. You can always upgrade to Airflow later and mention "designed to scale to Airflow orchestration" in your README as a forward-looking note.

---

## 7. Translating Technical Results Into Farmer Language (this is the core UX logic)

This is the single most important function in the whole app — it's what makes it "for people," not just a technical demo. Implement this as one clear, well-commented function in the backend:

```python
def to_farmer_status(anomaly_zscore: float) -> dict:
    """
    Converts a raw NDVI anomaly z-score into a farmer-facing status.
    This function is the bridge between the ML/GIS layer and a
    non-technical end user — keep the language warm, short, and
    non-alarming even for bad news.
    """
    if anomaly_zscore > 0.5:
        return {
            "color": "green",
            "label": "Looking healthy",
            "message": "Your field's greenness is above average for this time of year. No action needed."
        }
    elif -0.5 <= anomaly_zscore <= 0.5:
        return {
            "color": "green",
            "label": "Normal",
            "message": "Your field looks about as green as expected for this time of year."
        }
    elif -1.5 <= anomaly_zscore < -0.5:
        return {
            "color": "yellow",
            "label": "Worth a look",
            "message": "Your field is a bit less green than usual. This can mean early water or nutrient stress — a quick field visit is a good idea."
        }
    else:
        return {
            "color": "red",
            "label": "Needs attention",
            "message": "Your field is notably less green than usual for this time of year. We'd recommend checking it soon — this can indicate significant water stress, disease, or another issue."
        }
```

The LLM chat layer should always use this translated status (never the raw z-score) as its source of truth, and should be instructed via its system prompt to **never use words like "NDVI," "z-score," or "anomaly" unless the user explicitly asks "what does that mean technically" or "show me the numbers."**

---

## 8. Backend API (same core design, described plainly)

| Endpoint | What it does, in plain terms |
|---|---|
| `POST /fields` | Save a new field the farmer drew |
| `GET /fields/{id}` | Get a field's saved info and shape |
| `GET /fields/{id}/analysis/latest` | Get the current color + one-line status for a field |
| `GET /fields/{id}/history` | Get a simple "greenness over time" trend for the chart |
| `POST /fields/{id}/refresh` | "Check for the latest satellite update" button |
| `POST /chat` | The conversational assistant — always answers using real field data, never guesses |

The LLM should have exactly these tools available via function-calling, matching the endpoints above (`get_field_status`, `get_field_history`, `get_field_info`). System prompt for the agent:

> "You are a friendly assistant helping a farmer understand their field's health. Always use the tools to check real data before answering — never make up numbers. Explain things simply and warmly, like you're talking to someone in their field, not a scientist. Avoid technical jargon unless the farmer specifically asks for the technical details."

---

## 9. `.env.example` (fill this in using Section 4's steps)

```
# Groq (chat)
GROQ_API_KEY=your_groq_key_here
LLM_MODEL=llama-3.3-70b-versatile

# Supabase (database)
DATABASE_URL=your_supabase_connection_string_here

# Satellite imagery — no key needed
STAC_API_URL=https://earth-search.aws.element84.com/v1

# App
BACKEND_PORT=8000
FRONTEND_PORT=5173
VITE_API_URL=http://localhost:8000
```

---

## 10. Repository Structure

```
crop-health-copilot/
├── README.md
├── .env.example
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── fields.py
│   │   │   ├── analysis.py
│   │   │   └── chat.py
│   │   ├── services/
│   │   │   ├── stac_client.py        # pulls Sentinel-2 imagery, no key needed
│   │   │   ├── raster_processing.py  # NDVI calculation
│   │   │   ├── zonal_stats.py        # per-field averages
│   │   │   ├── model_inference.py    # loads trained checkpoint, runs prediction
│   │   │   ├── farmer_translate.py   # THE key function from Section 7
│   │   │   └── llm_agent.py          # Groq-powered chat agent
│   │   └── db/
│   │       ├── models.py
│   │       └── session.py
│   ├── ml/
│   │   ├── train.py                  # trains on EuroSAT (auto-downloads)
│   │   ├── model.py
│   │   └── checkpoints/
│   └── scripts/
│       └── daily_refresh.py          # replaces Airflow for MVP, run via GitHub Actions
├── .github/
│   └── workflows/
│       └── daily-refresh.yml         # free scheduled job, replaces Airflow
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FieldCard.tsx         # color-coded home screen card
│   │   │   ├── MapView.tsx           # MapLibre + OpenFreeMap, no key
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── HealthBadge.tsx       # 🟢🟡🔴 badge component
│   │   │   ├── GreennessChart.tsx    # recharts, labeled in plain language
│   │   │   └── FieldDrawTool.tsx
│   │   └── api/client.ts
└── docs/
    ├── architecture.md
    └── model-card.md
```

---

## 11. Build Plan — Phased (MVP-first order for Cursor)

### Phase 1: Accounts + Foundation (Day 1)
- [ ] Complete all sign-ups in Section 4, fill in `.env`
- [ ] Scaffold repo structure above
- [ ] `POST /fields` + `GET /fields/{id}` working against Supabase with one hardcoded test field

### Phase 2: Real Data, No Manual Downloads (Day 2-4)
- [ ] `stac_client.py` — pull a real Sentinel-2 scene for your test field (no key needed)
- [ ] `raster_processing.py` + `zonal_stats.py` — compute real NDVI for that field
- [ ] Sanity-check: NDVI values should land roughly 0.3–0.8 for healthy vegetation
- [ ] Save results to Supabase

### Phase 3: Train the Model (Day 5-7)
- [ ] `train.py` using `torchgeo.datasets.EuroSAT(download=True)` — no manual download step
- [ ] Train on Google Colab free GPU if needed (Section 4.6)
- [ ] Record accuracy/F1 in `docs/model-card.md`
- [ ] `model_inference.py` to load the checkpoint and classify new imagery

### Phase 4: The Farmer-Language Layer (Day 8) — don't skip this, it's the core idea
- [ ] Implement `farmer_translate.py` exactly as in Section 7
- [ ] Test it against a range of z-scores to make sure the language always sounds warm and clear, never alarming or robotic

### Phase 5: Chat (Day 9-10)
- [ ] `llm_agent.py` using Groq, with function-calling tools from Section 8
- [ ] Test real questions: "How's my field?", "Should I be worried?", "What does yellow mean?"
- [ ] Confirm the agent never invents numbers and always calls a tool first

### Phase 6: Frontend, Built for a Non-Technical User (Day 11-15)
- [ ] `FieldCard.tsx` + `HealthBadge.tsx` — the color-coded home screen, this is the first impression
- [ ] `MapView.tsx` with OpenFreeMap (no key) + `FieldDrawTool.tsx`
- [ ] `ChatPanel.tsx`
- [ ] `GreennessChart.tsx` — label the axis "Greenness score" not "NDVI"
- [ ] Usability check: show it to someone who isn't technical (a friend, family member) and watch if they understand the home screen without you explaining anything

### Phase 7: Free Scheduling Instead of Airflow (Day 16)
- [ ] `daily_refresh.py` script that pulls new imagery + runs inference for all active fields
- [ ] Wire it into `.github/workflows/daily-refresh.yml` as a free scheduled GitHub Action (runs on GitHub's infrastructure, no server needed)

### Phase 8: Deploy + Polish for Portfolio (Day 17-19)
- [ ] Deploy backend to Render (Section 4.4), frontend to Vercel (Section 4.5)
- [ ] Seed 3-5 demo fields with real processed data so the deployed demo works instantly without needing a live pull
- [ ] Write `README.md`: what it does, who it's for, screenshots, architecture diagram, live demo link, setup instructions
- [ ] Write `docs/model-card.md`: training data, accuracy, honest limitations (e.g., "trained on general land-cover data, not disease-specific — future work would use labeled crop-stress imagery")
- [ ] Record a 2-3 minute demo video showing the farmer-facing flow (not code) — this is what most people will actually watch

---

## 12. Resume / Portfolio Framing

**Suggested resume bullet points:**
- "Designed and built an end-to-end crop health platform translating satellite imagery and a trained land-cover classification model into plain-language guidance for non-technical users, using a fully open-source/free stack."
- "Built an NDVI anomaly detection pipeline (Sentinel-2 via STAC, rasterio, GeoPandas) and a farmer-facing conversational interface (Groq/Llama 3.3) that explains field health in accessible language rather than raw geospatial metrics."
- "Automated satellite data ingestion and model inference via a free, serverless scheduled pipeline (GitHub Actions), deployed on a zero-cost hosting stack (Render + Vercel + Supabase)."

**Interview talking points to prepare:**
- Why you prioritized "translate to plain language" as its own explicit layer instead of just showing raw output
- Why you chose a free/open stack and what you'd swap in at real scale (e.g., Airflow instead of GitHub Actions, dedicated GPU inference instead of on-request)
- How you validated the model given the constraint of no disease-labeled satellite data (the honest limitation, and how you'd address it with more time — e.g., PlantVillage leaf-photo integration as a v2 feature)

---

## 13. Future Work (mention in README even if unbuilt — shows real-world thinking)
- Local language support (e.g., Urdu) for the chat and status messages
- A "read aloud" option for accessibility
- SMS/WhatsApp-based alerts for farmers without reliable smartphone/internet access, using a free trial tier like Twilio's
- A "photograph a leaf" feature using the PlantVillage dataset for closer-up disease detection, complementing the satellite-level view
- Multi-field comparison for farmers managing several plots
