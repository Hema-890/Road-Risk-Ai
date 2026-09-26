# RoadRisk AI — Comprehensive Technical Audit Report

**Date:** September 19, 2026  
**Auditor:** Antigravity Autonomous Systems Engineer  
**Scope:** Full repository inspection, installed dependencies, environment variables, backend, database, API integrations, map renderers, runtime behaviors, and production build verification.

---

## 1. Executive Summary

| Category | Finding |
|---|---|
| **Active Map Renderer at Runtime** | `src/App.tsx` (line 143) was hardcoding `<LeafletMapView />` (Leaflet 1.9.4 + CartoDB/OSM 2D Raster PNG Tiles). MapLibre GL JS was installed in `package.json` (`maplibre-gl@^4.7.1`) and implemented in `MapContainer.tsx`, but bypassed. |
| **Visual Quality Root Cause** | Raster tiles (256x256 pixel images) lack vector road hierarchy, crisp vector typography, 3D building geometry, smooth perspective pitch/bearing, and smooth vector animation. |
| **Fallback Map Root Cause** | `MapContainer.tsx` contained a silent fallback to `TacticalFallbackMap.tsx` with a diagnostic banner when WebGL checks failed or `mapEnginePreference === 'leaflet_2d'`. |
| **Backend & Persistence** | Real native Node.js HTTP server (`server/index.cjs`) backed by native SQLite (`roadrisk.db`) running on port 3001. No external Express or Supabase dependencies currently required for base operation. |
| **Routing & Geocoding** | Real OSRM routing engine (`osrmService.ts`) querying public/self-hosted OSRM endpoints; real OpenStreetMap Photon geocoding API + curated emergency trauma facilities in `geocodingService.ts`. |
| **RoadRisk Intelligence** | Deterministic multi-factor predictive risk engine (`src/engines/riskEngine.ts`) with segment hazard scoring, incident injection, audio synthesizers, and dynamic rerouting. |

---

## 2. Component-by-Component System Audit Matrix

| Component | Status | Current Implementation | Expected Implementation | Problem & Root Cause | Required Action |
|---|---|---|---|---|---|
| **Map Rendering Pipeline** | ❌ BROKEN UX | `LeafletMapView.tsx` (Raster Leaflet) rendered by `App.tsx` | High-fidelity Vector MapLibre GL JS with custom styles | Raster tiles look static, blurry on zoom, no road hierarchy, no pitch | Migrate primary map view to `MapContainer.tsx` with vector tiles |
| **MapLibre Vector Styles** | ⚠️ PARTIAL | `MapContainer.tsx` was configured with Carto raster tile source | True Vector Tiles (OpenFreeMap Liberty/Bright or MapTiler Streets) | Style definition in `MapContainer.tsx` was using `type: 'raster'` | Switch to vector tile style JSON (`tiles.openfreemap.org` / MapTiler API) |
| **Tactical Fallback Map** | ⚠️ FALLBACK | `TacticalFallbackMap.tsx` replaced map when WebGL flag was toggled | Clear runtime error overlay if WebGL fails; never silent fake map | Degraded user experience, confusing yellow banner | Remove from primary path; show explicit WebGL error state if needed |
| **Mouse Wheel Interaction** | ⚠️ PARTIAL | Wheel scrolling zoomed the map or fought trackpad | Wheel scrolling pans/moves map; `+`/`-` handles explicit zoom | MapLibre `scrollZoom` enabled by default | Disable `scrollZoom`, attach `wheel` event handler with `map.panBy()` |
| **Initial Map State** | ✅ WORKING | Clean map on initial load (zero routes, zero polylines, no HUD card) | Clean standby map | Verified contract in state management and E2E test | Keep verified state contract |
| **Destination Search Bar** | ⚠️ PARTIAL | Floating search input in `EmergencyRouteControl.tsx` | Sleek compact floating search bar (Google Maps/Rapido style) | Top-left positioning can clip on smaller viewports | Add responsive auto-width, sleek shadow, glassmorphism |
| **Geocoding & Hubs** | ✅ WORKING | `src/services/geocodingService.ts` with OSM Photon + Trauma Hubs | Real geocoding + local emergency facilities | Fully operational with debounce and query badges | Verified |
| **OSRM Routing Engine** | ✅ WORKING | `src/services/osrmService.ts` querying OSRM endpoints | Multi-route alternatives with real geometry | Operational | Add fallback endpoints & timeout resilience |
| **Risk Prediction Engine** | ✅ WORKING | `src/engines/riskEngine.ts` evaluating 6 dynamic factors | Segment-level risk index (0–100) and color gradients | Operational | Verified |
| **Telemetry & Ambulance** | ✅ WORKING | `telemetry.ts` and 60fps interpolation in `AppContext.tsx` | Smooth vehicle movement, heading rotation | Operational | Verified |
| **Dynamic Rerouting** | ✅ WORKING | `DynamicRerouteModal.tsx` + route re-evaluation | Real-time hazard rerouting triggers | Operational | Verified |
| **Backend REST API** | ✅ WORKING | `server/index.cjs` (port 3001) | REST endpoints for roads, risk-map, events, hazards, vehicles | Native Node.js HTTP + SQLite | Verified |
| **SQLite Database** | ✅ WORKING | `server/roadrisk.db` (90 KB native SQLite) | 9 tables with seed emergency vehicles and roads | Operational | Verified |
| **Audio Synthesizer** | ✅ WORKING | `src/services/audioSynth.ts` (Web Audio API) | Code 3 sirens, horn, radio chirp, priority chimes | Zero external audio asset dependencies | Verified |
| **Demo / Lab Isolation** | ✅ WORKING | `⚡ Demo` button in `Header.tsx` loads Route Bravo on demand | Demo strictly isolated from default initial state | Fully isolated | Verified |
| **Production Build** | ✅ WORKING | Vite 6.0.3 + TypeScript 5.7.2 | `npm run build` completes in ~1.3s with 0 errors | Operational | Verified |

---

## 3. Map Renderer Architecture Evaluation

### Can Leaflet + Raster Tiles Achieve Rapido / Modern Navigation Quality?
- **Verdict: NO.**
- **Technical Reasoning:**
  1. **Tile Format:** Leaflet renders static 256×256 PNG raster images. Street labels, road outlines, and icons are baked into pixels, causing pixelation and blurry text at intermediate zoom levels.
  2. **Camera Controls:** Leaflet has no true 3D pitch/perspective camera (it is restricted to a top-down 2D orthographic projection). Modern navigation applications (Google Maps, Rapido, Uber) rely on dynamic 45°–60° perspective tilting for driving visibility.
  3. **Bearing & Rotation:** Rotating a raster Leaflet map causes severe raster tearing and jagged aliasing. Vector maps rotate seamlessly while keeping street and place labels oriented horizontally and legible.
  4. **Dynamic Styling:** Vector tiles allow road casings, lane widths, traffic layers, and 3D buildings to be rendered dynamically on the GPU via WebGL shaders.

### Selected Architecture: MapLibre GL JS + Vector Tiles
- **Engine:** `maplibre-gl` version 4.7.1 (already installed).
- **Default Vector Style:** OpenFreeMap Liberty / Bright (`https://tiles.openfreemap.org/styles/liberty` and `https://tiles.openfreemap.org/styles/bright`) — Fast Cloudflare-backed vector tiles with full OpenMapTiles road hierarchy, 3D buildings, water, parks, and clean typography.
- **Enhanced Provider Option:** MapTiler (`https://api.maptiler.com/maps/streets-v2/style.json?key=${VITE_MAPTILER_KEY}`) enabled automatically when `VITE_MAPTILER_KEY` is configured in environment variables.
- **Interaction Contract:**
  - **Drag:** Pans map (`dragPan.enable()`).
  - **Mouse Wheel:** Pans map via `map.panBy([e.deltaX, e.deltaY])` with `scrollZoom.disable()`.
  - **Explicit Zoom:** Compact `+` and `−` controls with keyboard shortcuts (`+`, `-`).
  - **Touch:** Two-finger pinch zooms; single-finger drag pans.

---

## 4. Root Cause of Previous Static/Degraded Map Experience
1. `App.tsx` rendered `<LeafletMapView />` instead of `<MapContainer />`.
2. `MapContainer.tsx` contained raster Carto tile sources instead of vector tile styles.
3. `MapContainer.tsx` was configured with a conditional fallback to `TacticalFallbackMap.tsx`, which displayed a yellow warning banner and rendered raster tiles.
4. Top-left HUD controls and search bar lacked CSS media query constraints for smaller viewports, causing overlap.

---

## 5. Remediation Plan
1. **Promote MapContainer to Primary Map View:** Replace `<LeafletMapView />` in `App.tsx` with `<MapContainer />`.
2. **Implement Vector Map Style in MapContainer:** Use high-performance vector tile style URLs (OpenFreeMap vector tiles by default, MapTiler if key provided).
3. **Enforce Mouse Wheel = Pan:** Disable `scrollZoom`; add `wheel` pan listener on map container canvas.
4. **Remove Silent Fallbacks:** Remove `TacticalFallbackMap` as an automatic silent replacement. If WebGL is unavailable, display a crisp diagnostic modal with actionable error info.
5. **Streamline Search & UI Hierarchy:** Polish `EmergencyRouteControl` search bar into a compact, responsive floating bar with zero viewport clipping.
6. **Preserve All RoadRisk Intelligence:** Retain OSRM routing, multi-factor risk scoring, hazards, vehicle telemetry, dynamic reroute triggers, and debrief modals.
7. **Document Secrets & Configuration:** Provide `.env.example` and `docs/API_KEY_REQUIREMENTS.md`.
8. **Automated Verification:** Update test scripts and verify build.
