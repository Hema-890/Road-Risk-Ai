# RoadRisk AI — API Architecture Matrix

| Feature | Provider | API Protocol | Credential Variable | Required? | Free/Paid | Status | Notes |
|---|---|---|---|---|---|---|---|
| **Map Viewport** | MapLibre GL JS | WebGL Shader Pipeline | None | **YES** | Free (FOSS) | ✅ **ACTIVE** | Version 4.7.1 local client-side renderer |
| **Vector Tiles** | OpenFreeMap / MapTiler | Vector Tile Spec (PBF/MVT) | `VITE_MAPTILER_KEY` | **YES** | Free / Free Tier | ✅ **ACTIVE** | OpenFreeMap Liberty default; MapTiler optional |
| **Search & Autocomplete** | OSM Photon | REST / HTTPS JSON | None | **YES** | Free | ✅ **ACTIVE** | `https://photon.komoot.io/api/` + Local Curated Hubs |
| **Routing Engine** | OSRM v5 | REST / HTTPS JSON | `VITE_OSRM_BASE_URL` | **YES** | Free | ✅ **ACTIVE** | Public demo endpoint or local self-hosted instance |
| **Hospitals Directory** | RoadRisk DB | SQLite / REST | None | **YES** | Free | ✅ **ACTIVE** | Verified trauma facilities catalog |
| **Database Storage** | Node.js SQLite / Supabase | Native C++ / PostgreSQL | `DATABASE_URL` | **YES** | Free | ✅ **ACTIVE** | Local SQLite active; Supabase SQL migration ready |
| **Authentication** | Node.js Auth / Supabase | SHA-256 JWT / GoTrue | `SUPABASE_ANON_KEY` | **YES** | Free | ✅ **ACTIVE** | Local role-based session auth active |
| **Live Traffic Feed** | Simulated / HERE / TomTom | REST Flow Segment | `TRAFFIC_API_KEY` | **NO** | Optional Paid | ⚠️ **SIMULATED** | Explicitly labeled as simulated until key provided |
| **AI LLM Summary** | Deterministic / Gemini | REST GenerateContent | `GEMINI_API_KEY` | **NO** | Optional Free Tier | ✅ **ACTIVE (Math)** | Built-in algorithm handles debrief calculations |
| **Realtime Sync** | Node.js Telemetry Loop | 100Hz Event Stream | None | **YES** | Free | ✅ **ACTIVE** | In-process high-frequency 60–100Hz loop |
