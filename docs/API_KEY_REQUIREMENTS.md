# RoadRisk AI — API Key & Service Credential Audit

**Application:** RoadRisk AI Platform  
**Audit Date:** September 19, 2026  
**Auditor:** Antigravity Autonomous Systems Engineer  

---

## 1. Master Service Credential Table

| Service | Feature | Required? | Provider | Credential | Frontend/Backend | Free/Paid | Status |
|---|---|---|---|---|---|---|---|
| **Map Rendering** | Base map canvas & viewport | **YES** | MapLibre GL JS | None (Open Source) | Frontend | Free (FOSS) | ✅ **ACTIVE** |
| **Vector Tiles** | Crisp roads, 3D buildings, typography | **YES** | OpenFreeMap / MapTiler | `VITE_MAPTILER_KEY` (Optional) | Frontend | Free (OpenFreeMap) / Free Tier (MapTiler) | ✅ **ACTIVE (OpenFreeMap)** / 🟡 Optional Key |
| **Geocoding** | Place & hospital search | **YES** | OSM Photon API + Trauma Hubs | None (Open API) | Frontend / Backend | Free | ✅ **ACTIVE** |
| **Routing** | Turn-by-turn navigation & alternatives | **YES** | OSRM v5 OpenStreetMap | None for Demo / Base URL | Frontend / Backend | Free (Demo / Self-hosted) | ✅ **ACTIVE** |
| **Hospitals / POIs** | Trauma facility discovery | **YES** | Built-in Verified Catalog + Photon | None | Frontend / Backend | Free | ✅ **ACTIVE** |
| **Live Traffic** | Real-time congestion speeds | **NO (Optional)** | Simulated Engine / HERE / TomTom | `TRAFFIC_API_KEY` | Backend | Simulated is Free / Live is Paid | ⚠️ **SIMULATED (No Live Key)** |
| **Database** | Persistent data storage | **YES** | Native SQLite / Supabase Postgres | `DATABASE_URL` / `SUPABASE_URL` | Backend | Free (Local SQLite) / Free Tier (Supabase) | ✅ **ACTIVE (Local SQLite)** / 🟡 Supabase Ready |
| **Authentication** | Operator login & session | **YES** | Native Session Auth / Supabase Auth | `SUPABASE_ANON_KEY` | Both | Free | ✅ **ACTIVE (Local Auth)** / 🟡 Supabase Ready |
| **AI Assessment** | Predictive risk debriefs | **NO (Optional)** | Deterministic Math Engine / Gemini | `GEMINI_API_KEY` | Backend Only | Math Engine is Free / Gemini Free Tier | ✅ **ACTIVE (Math Engine)** / 🟡 Gemini Ready |

---

## 2. In-Depth Service Analysis

### 1. Map & Vector Tiles
- **Why We Need It:** Provides the primary visual interface for vehicle dispatch, road inspection, and hazard display.
- **What Feature Uses It:** `MapContainer.tsx`, `LiveRiskMapView.tsx`.
- **Whether It Is Actually Required:** **YES**.
- **Whether a Key Is Required:** **NO for OpenFreeMap**; **YES if choosing MapTiler**.
- **Where Key Is Stored:** `.env.local` as `VITE_MAPTILER_KEY`.
- **Free/Paid:** OpenFreeMap is 100% Free (Cloudflare edge-cached). MapTiler has 100k requests/month free tier.
- **What Happens Without It:** System seamlessly uses OpenFreeMap Liberty/Bright vector tiles with zero degraded experience.

### 2. Geocoding & Destination Search
- **Why We Need It:** Allows operators to search any landmark, hospital, or street address.
- **What Feature Uses It:** `EmergencyRouteControl.tsx` search bar.
- **Whether It Is Actually Required:** **YES**.
- **Whether a Key Is Required:** **NO**.
- **Where Key Is Stored:** None required.
- **Free/Paid:** Free (OpenStreetMap Photon project).
- **What Happens Without It:** Falls back to the curated local emergency trauma care hubs catalog.

### 3. Routing Engine (OSRM)
- **Why We Need It:** Calculates shortest, fastest emergency paths and alternative routes with real coordinate geometry.
- **What Feature Uses It:** `osrmService.ts`, `AppContext.tsx`.
- **Whether It Is Actually Required:** **YES**.
- **Whether a Key Is Required:** **NO** (queries public demo instance `https://router.project-osrm.org` or self-hosted Docker OSRM).
- **Where Key Is Stored:** `VITE_OSRM_BASE_URL` in `.env.local`.
- **Free/Paid:** Free.
- **What Happens Without It:** The system generates deterministic fallback route corridors.

### 4. Database & Persistence
- **Why We Need It:** Persists operator missions, vehicle telemetry logs, citizen hazard reports, and audit trails.
- **What Feature Uses It:** `server/database.cjs`, `server/index.cjs`, `apiService.ts`.
- **Whether It Is Actually Required:** **YES**.
- **Whether a Key Is Required:** **NO for local development** (uses native Node.js SQLite file `roadrisk.db`). **YES for Supabase cloud deployment**.
- **Where Key Is Stored:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-side only).
- **Free/Paid:** SQLite is free; Supabase has a generous free tier (2 projects, 500MB DB).
- **What Happens Without It:** System operates fully on local SQLite file `roadrisk.db`.

### 5. Live Traffic Data
- **Why We Need It:** Real-time road speeds and congestion delay factors.
- **What Feature Uses It:** `riskEngine.ts`.
- **Whether It Is Actually Required:** **NO (Optional)**.
- **Whether a Key Is Required:** **YES if live external provider selected**.
- **Where Key Is Stored:** `TRAFFIC_API_KEY` (Backend only).
- **Free/Paid:** TomTom / HERE have free monthly request quotas; Google Routes is pay-as-you-go.
- **What Happens Without It:** The system uses its internal predictive heuristic engine and telemetry probes, explicitly labeled as `SIMULATED` (no fake live claims).

### 6. AI Assistant & Debrief Summaries
- **Why We Need It:** Generates natural language incident analysis and post-mission debrief reports.
- **What Feature Uses It:** `MissionDebriefModal.tsx`.
- **Whether It Is Actually Required:** **NO (Optional)**.
- **Whether a Key Is Required:** **YES if connecting Google Gemini or OpenAI**.
- **Where Key Is Stored:** `GEMINI_API_KEY` (Backend only).
- **Free/Paid:** Google AI Studio provides free Gemini 1.5 Flash API tier (15 RPM).
- **What Happens Without It:** The system uses its internal deterministic mathematical scoring engine (`riskEngine.ts`).
