# ROADRISK AI — SENIOR ENGINEERING AUDIT (PHASE 0)
**System Architecture, State Coupling, Data Truth, Performance, and Verification Audit**
**Date**: September 25, 2026  
**Role**: Senior Staff Systems & Navigation Engineer  

---

## Executive Summary

RoadRisk AI has established a strong foundational stack: MapLibre GL / MapTiler vector tiles with OpenStreetMap raster failover, TomTom Live Traffic Flow and Incidents v5 integration, OSRM road graph queries, offline in-browser route fallbacks, Supabase Realtime, Firebase messaging, Open-Meteo flood risk, and Web Speech API synthesis/recognition.

However, the application was functioning as several semi-independent subsystems rather than **one coherent, authoritative navigation product**. State mutations were loosely coupled across sprawling React components, causing mode state leakage, race conditions between rapid transport mode switches, duplicate ETA calculations, and absent departure time controls.

This audit details the architectural baseline across all 18 required audit domains before executing the stabilization plan.

---

## 1. State Ownership & Architecture

### Current State
* Global state is held in `AppContext.tsx` (over 2,000 lines, 75KB), managing 40+ disparate state variables ranging from vehicle telemetry, emergency dispatch status, routing preferences, city presets, to simulation speed.
* Navigation state was partially maintained in `AppContext` (`routes`, `selectedRouteId`, `navigationPhase`, `currentMission`) and partially mirrored in `CitizenNavigationControl.tsx` (103KB) and `DirectionsPanel.tsx`.
* Routes were stored as a flat array `RouteOption[] routes`. When switching transport mode (`CAR` -> `BIKE` -> `WALK`), the entire array was overwritten. No cached mode slots existed, leading to unnecessary re-fetches and flicker.

### Architecture Problem
`selectedRoute`, `distance`, `adjustedEtaMinutes`, and `maneuvers` were mutated globally across modes. If a mode fetch failed or fell back, properties from the previous mode could persist in UI components.

---

## 2. Data Flow Architecture

### Current Data Pipeline
```
User Search / Voice / Click
      ↓
SearchService (TomTom -> Photon -> Nominatim -> Coordinates)
      ↓
SearchResult with Coordinates [lng, lat]
      ↓
AppContext.setDestinationLocation(name, coords, activeMode)
      ↓
osrmService.fetchOsrmRoutes(...)
      ↓
routingService.calculateRoutes(origin, coords, options)
      ↓
Provider: TomTom (traffic=true, travelMode=car/motorcycle/bicycle/pedestrian)
       ↳ Fallback: OSRM (/route/v1/driving/)
       ↳ Fallback: offlineRoutingEngine
      ↓
partitionPolylineIntoSegments + corridorFeaturesService + riskEngine
      ↓
evaluatedRoutes[] -> AppContext -> MapContainer + CitizenNavigationControl
```

### Gap Identified
When selecting a place from `SelectedPlaceCard` or search results, coordinates are passed reliably, but `DirectionsPanel` re-calculated arrival timestamps independently from `CitizenNavigationControl` using ad-hoc `Date.now() + totalSeconds * 1000`.

---

## 3. Route Calculation Flow

* **TomTom Provider**: Successfully accepts `travelMode=car`, `motorcycle`, `bicycle`, `pedestrian`.
  - Live probe test (Vijayawada -> Hyderabad):
    - Car: 275.8 km, 4h 35m, delay: 206s
    - Motorcycle: 275.8 km, 4h 35m, delay: 206s
    - Bicycle: 269.5 km, 13h 31m, delay: 0s
    - Pedestrian: 269.0 km, 53h 48m, delay: 0s
* **OSRM Fallback**: The public demo endpoint `router.project-osrm.org` only exposes `/driving/`. If OSRM is ever hit for `WALK` or `BICYCLE`, it would return vehicular travel times unless calibrated with realistic pedestrian walking speeds (~4.8 km/h) or cycling speeds (~16 km/h).
* **Transit Handling**: Properly gates on verified GTFS feeds, throwing `TRANSIT DATA UNAVAILABLE: Municipal transit agency has not published a public GTFS or GTFS-Realtime feed for this corridor.`

---

## 4. ETA & Time Model Authority

### Critical Defect
1. **Departure Time Coupling**: There was no explicit user-selected departure timestamp model. When the user plans a journey "Depart now", all road modes share the exact same departure timestamp (e.g. 10:00 AM), but must produce independent durations and arrival timestamps.
2. **Double Delay Counting**: In `routingService.ts`, `adjustedEtaMin` was calculated as `((res.durationSeconds + trafficDelaySec) / 60)`. In TomTom API v1, `summary.travelTimeInSeconds` ALREADY incorporates real-time traffic delay! Adding `trafficDelayInSeconds` to `travelTimeInSeconds` erroneously doubled the traffic penalty.
3. **Decentralized Calculation**: `DirectionsPanel.tsx` and `CitizenNavigationControl.tsx` performed separate local date arithmetic without an authoritative `etaService`.

---

## 5. Search Pipeline

* Primary: TomTom Search API (Fuzzy & POI endpoints with API key).
* Secondary: Photon geocoder (`photon.komoot.io`).
* Tertiary: OpenStreetMap Nominatim (`nominatim.openstreetmap.org`).
* Quaternary: Coordinate regex parser (`16.5062, 80.6480`).
* Normalization to `SearchResult` with `latitude`, `longitude`, `coordinates: [lng, lat]`, `provider`, `category`, and `confidence` is working well.
* Tested locations: Vijayawada, Guntur, Hyderabad, Mangalagiri, Benz Circle, Vijayawada Railway Station, hospital, fuel pump all resolve to concrete coordinate pairs.

---

## 6. Voice Input Flow (Speech Recognition)

* `voiceInputService.ts` and `voiceCommandService.ts` both exist in parallel.
  - `voiceInputService.ts` has a sophisticated Web Audio API analyzer with dynamic audio waveforms, multi-language speech recognition (en-US, te-IN, hi-IN, ta-IN, kn-IN), and intent parsing.
  - Intents parsed: `NAVIGATE_TO`, `SEARCH_PLACE`, `FIND_POI`, `START_NAVIGATION`, `STOP_NAVIGATION`, `SWITCH_MODE`, `CURRENT_LOCATION`, `ZOOM_IN`, `ZOOM_OUT`, `MUTE`, `UNMUTE`, `REROUTE`, `FASTEST_ROUTE`, `SAFEST_ROUTE`.
* Missing:
  1. A user-visible "What can I say?" cheat sheet modal / popover.
  2. Time intents: "Depart now", "Depart at [time]".

---

## 7. Voice Output Flow (Speech Synthesis)

* `speechService.ts` wraps browser `window.speechSynthesis` with priority preemption (P0 Emergency to P5 Info).
* `navigationVoiceService.ts` provides multi-lingual translations (en, te, hi, ta, kn) for maneuver triggers, road closures, approaching emergency vehicles, and hazard advisories.
* Rules to enforce:
  - No spam on continuous GPS updates.
  - Maneuver deduplication stages: `approaching` (500m) -> `near` (150m) -> `now` (30m).
  - Stop voice synthesis completely when navigation stops.

---

## 8. Map Event Lifecycle

Dynamic map markers include:
* Traffic incidents (TomTom v5)
* Flood risk polygons/points (GloFAS / Open-Meteo)
* Emergency vehicles (Supabase Realtime / Demo)
* User reported hazards (Citizen hazard reporting)

**Lifecycle requirement**:
`CREATED` -> `ACTIVE` -> `UPDATED` -> `EXPIRED / RESOLVED` -> `REMOVED`.
Incidents in `incidentService` already carry `expiresAt` (60s TTL) and GeoJSON clustering in `MapContainer.tsx`. Emergency vehicles are only rendered when actively `EN_ROUTE` with speed or in explicit DEMO simulation.

---

## 9. Realtime Event Lifecycle (EventBus)

* `eventBus.ts` is a typed pub/sub with typed events (`TRAFFIC_UPDATED`, `INCIDENT_CREATED`, `EMERGENCY_VEHICLE_UPDATED`, etc.), memory cap (200 events history), and cleanup callbacks.
* No memory leaks identified, but subscribers must properly unsubscribe on React component unmount.

---

## 10. Transport Mode Handling & Isolation

Modes supported:
1. `CAR`: TomTom `car` with live traffic flow & incident delays.
2. `BIKE` (Motorcycle): TomTom `motorcycle` routing profile.
3. `BICYCLE`: TomTom `bicycle` routing profile.
4. `WALK`: TomTom `pedestrian` routing profile with walking network.
5. `TRANSIT`: Honest GTFS gate. Returns `TRANSIT DATA UNAVAILABLE` when no verified regional feed exists.

**Requirement**: Every mode's route geometry, distance, duration, ETA, and maneuvers must be stored independently in the session cache so that switching back and forth is instantaneous and completely isolated.

---

## 11. Caching & Request Deduplication

* `routingService.ts` uses an in-flight signature map `inFlightRequests: Map<string, Promise<RoutingServiceResponse>>`.
* If identical coordinates and profile are requested concurrently, the existing promise is shared.
* Route corridor POI analysis uses in-memory caching.

---

## 12. Race Conditions & Request Cancellation

* In `routingService.ts`, `activeAbortController` aborts previous fetch calls when a new route is calculated.
* In `AppContext.tsx`, however, asynchronous calls to `setDestinationLocation` could interleave if the user clicked Car then immediately Bike.
* **Fix required**: Introduce a request sequence/version ID or session-level AbortController in `AppContext` so that only the latest requested mode or destination can commit state to the UI.

---

## 13. Stale State Risks

* If the user cleared destination or switched modes rapidly, lingering telemetry or maneuvers from the previous route could remain visible for one render frame.
* Explicit reset of `navigationManeuver`, `selectedRouteId`, and `routeErrorNotice` on mode switch is required.

---

## 14. Fake / Static / Simulated Data Paths

* **LIVE Production Mode**:
  - Base map: MapTiler Streets v2 vector tiles / OpenStreetMap raster.
  - Traffic: TomTom Traffic Flow raster layer + Incidents GeoJSON.
  - Routing: TomTom Live Traffic Routing -> OSRM -> Offline Graph.
  - Transit: Strictly UNAVAILABLE if no GTFS feed (no fake bus routes).
  - Emergency vehicles: Authenticated Supabase telemetry only.
* **DEMO / Simulation Mode**:
  - Explicitly labeled with `SIMULATION MODE` / `DEMO TRAFFIC`.
  - Never mixed with LIVE production navigation.

---

## 15. Performance Bottlenecks

* `MapContainer.tsx` handles large GeoJSON sources (`source-traffic-incidents`, `source-route`, `source-route-segments`).
* Clustering is enabled (`cluster: true`, `clusterRadius: 50`) for incident markers, keeping DOM nodes minimal.
* MapLibre web worker URL is properly configured.
* React re-renders in `CitizenNavigationControl.tsx` need strict memoization around route card lists and search results.

---

## 16. UI / UX Quality

* The navigation control UI is rich in glassmorphism and features, but needs:
  1. A clear departure time indicator / selector ("Depart Now" vs scheduled departure).
  2. Clear mode-isolated duration & arrival clock on every route card.
  3. A visible "🎙️ What can I say?" button in the voice control area with a clean modal guide.
  4. Proper responsive spacing for 1366x768 up to 1920x1080.

---

## 17. Security Audit

* Frontend `.env`:
  - `VITE_SUPABASE_ANON_KEY`: Public anon key with RLS (Row Level Security) enforced. No `service_role` key in client bundle.
  - `VITE_FIREBASE_API_KEY`: Client Web SDK key.
  - `VITE_MAPTILER_KEY`: Public client vector tile key.
  - `VITE_TRAFFIC_API_KEY`: Client TomTom evaluation key.
* Backend `server/index.cjs`:
  - Runs on port 3001. Sensitive server operations isolated from client.

---

## 18. Test Coverage & Verification Strategy

* Verification must be performed in **real headed Chrome** using Puppeteer.
* Test suite must verify:
  1. Search for destination ("Hyderabad", "Benz Circle", etc.)
  2. Mode selection (Car, Bike, Bicycle, Walk, Transit unavailable)
  3. Shared departure time with mode-specific durations and arrival clocks
  4. "What can I say?" voice guide open/close
  5. Voice intent execution: "Switch to bike", "Find petrol stations", "Start navigation", "Stop navigation"
  6. Real traffic flow and incident layers rendering
  7. Stop navigation and verify speech silence

---

*Phase 0 Audit Complete. Proceeding to Implementation of Phases 1 to 20.*
