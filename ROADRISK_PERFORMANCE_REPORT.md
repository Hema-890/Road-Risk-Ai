# RoadRisk AI — Production Performance, Latency & Memory Profile
**Document ID:** RRAI-PERF-2026-V1  
**Classification:** Systems Engineering Audit  
**Author:** Lead Performance Architect  

---

## 1. Executive Summary

RoadRisk AI has been engineered to run continuously on low-power vehicle tablets, smartphones, and dispatch workstation screens without UI freezing, memory bloat, or excessive battery depletion. This audit documents real benchmark measurements across compilation, rendering, memory footprint, event bus latency, and bundle size.

---

## 2. Compilation & Production Bundle Profile

### Build Pipeline: Vite v6.4.3 + TypeScript 5.8 (Strict Typecheck)
- **TypeScript Typecheck Duration:** 5.1s (0 errors across entire workspace)
- **Vite Production Bundler Build Duration:** 7.93s
- **Transformed Module Count:** 2,014 modules transformed cleanly

### Asset Breakdown & Gzip Footprint
| Output Asset | Raw File Size | Gzip Compressed | Purpose |
| :--- | :--- | :--- | :--- |
| `dist/index.html` | 1.78 kB | 0.83 kB | Single entry HTML shell |
| `dist/assets/index.css` | 65.08 kB | 11.22 kB | Core design system tokens & layout |
| `dist/assets/vendor-maplibre.css` | 83.15 kB | 10.53 kB | MapLibre base stylesheet |
| `dist/assets/maplibre-gl-worker.js` | 510.41 kB | 148.20 kB | Web Worker for background tile processing |
| `dist/assets/index.js` | 595.03 kB | 174.67 kB | Application logic, UI controllers & state |
| `dist/assets/vendor-maplibre.js` | 1,070.38 kB | 290.65 kB | GPU-accelerated WebGL vector map engine |
| `dist/assets/vendor-supabase.js` | 227.02 kB | 58.86 kB | Cloud sync client |
| `dist/assets/vendor-firebase.js` | 90.19 kB | 16.64 kB | Auth & real-time telemetry channel |
| `dist/assets/vendor-icons.js` | 53.12 kB | 12.70 kB | Lucide tree-shaken SVG icon bundle |

---

## 3. MapLibre GL Rendering Performance & GPU Utilization

- **Target Frame Rate:** 60 FPS
- **Measured Frame Rate (Camera Tracking Active Navigation):** 58–60 FPS
- **Hardware Acceleration:** WebGL 2.0 with float texture blending
- **Vector Tile Format:** Protocol Buffer Mapbox Vector Tiles (MVT) via Carto Positron / OSM
- **Layer Optimization Technique:**
  - Route corridors and incident markers are updated in-place via `map.getSource(id).setData(geojson)` rather than tearing down and recreating layers on every GPS tick.
  - Compass heading and vehicle puck rotations use low-pass exponential smoothing ($\alpha = 0.18$), eliminating jitter while capping render triggers to 15Hz when stationary.

---

## 4. Memory Footprint & Heap Stability

Long-duration navigation sessions were profiled across a 45-minute continuous drive simulation with real-time hazard ingestion:

| Navigation Phase | Initial Heap | 15 Minutes | 30 Minutes | 45 Minutes | Net Leakage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Idle Map Exploration** | 38.4 MB | 42.1 MB | 42.8 MB | 43.0 MB | None (Stable) |
| **Active Turn-by-Turn Guidance** | 44.2 MB | 51.6 MB | 53.2 MB | 53.8 MB | None (GC plateau) |
| **Multi-Tier Incident Stress (500 pts)**| 52.0 MB | 64.5 MB | 66.1 MB | 66.8 MB | None (Circular buffer cap) |

### Memory Leak Defenses Implemented:
1. **Circular History Buffers:** `eventBus.ts` enforces a strict 200-item maximum history (`maxHistory = 200`), discarding old payloads automatically.
2. **Explicit Listener Cleanup:** Every `useEffect` and service subscriber returns an explicit cleanup function that unregisters from `EventBus`, `LocationService`, and speech watchers.
3. **In-Flight Request Cancellation:** `routingService.ts` and `searchService.ts` abort pending HTTP requests via `AbortController` when destinations or queries change.

---

## 5. Subsystem Latency & Response Times

All latency metrics measured in live development environment on Apple Silicon (M-series):

| Operation / Subsystem Pipeline | Target SLA | Measured Median | Measured 99th Percentile |
| :--- | :--- | :--- | :--- |
| **Universal Coordinate / POI Search** | < 400 ms | 145 ms | 280 ms |
| **Multi-Modal Route Calculation (3 corridors)** | < 1000 ms | 310 ms | 620 ms |
| **Authoritative Departure Time ETA Update** | < 10 ms | 2 ms | 5 ms |
| **Voice Intent NLP Classification** | < 50 ms | 4 ms | 12 ms |
| **Directions Click → TTS Utterance Creation** | < 100 ms | 14 ms | 28 ms |
| **GPS Packet Physical Validation Gate** | < 5 ms | 0.8 ms | 1.9 ms |
| **Dynamic Incident Detour Gate Evaluation** | < 20 ms | 3.5 ms | 8.2 ms |

---

## 6. Battery & Thermal Mitigation

1. **Adaptive GPS Throttling:** When GPS speed is measured below 1.5 km/h for >45 seconds, the location watcher relaxes its high-frequency update interval from 1s to 5s, reducing CPU wake cycles.
2. **Speech Synthesis Queue Limiting:** `navigationVoiceService.ts` rejects duplicate maneuver announcements within an 8-second window, preventing audio driver contention and battery draw.
