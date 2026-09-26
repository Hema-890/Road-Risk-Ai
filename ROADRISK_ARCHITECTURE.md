# RoadRisk AI — Comprehensive System Architecture Document
**Version:** 3.0.0-PROD  
**Author:** Lead Principal Engineer & Product Architect  
**Classification:** Core System Specification  

---

## 1. System Overview

RoadRisk AI is an enterprise-grade, real-time AI navigation, road-risk intelligence, and multi-modal transit coordination platform. The system operates across three primary user tiers:
1. **Citizen Navigation**: High-reliability turn-by-turn guidance across Car, Motorcycle, Bicycle, and Pedestrian modes, with explainable AI risk scoring, real-time incident detection, and multi-lingual voice interaction.
2. **Emergency Operations (Ops)**: Preemptive corridor clearance, signal preemption orchestration, siren proximity alerts, and live multi-vehicle telemetry for emergency response units.
3. **Traffic Authority / Fleet Management**: Regional congestion analytics, hazard injection/validation, GTFS transit management, and municipal corridor health monitoring.

---

## 2. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                   USER INTERFACE                                  |
|   +--------------------------+  +-------------------------+  +-----------------+  |
|   | CitizenNavigationControl |  |  EmergencyRouteControl  |  | AuthorityPortal |  |
|   +--------------------------+  +-------------------------+  +-----------------+  |
|              ^                               ^                        ^           |
+--------------|-------------------------------|------------------------|-----------+
               v                               v                        v
+-----------------------------------------------------------------------------------+
|                        APPLICATION CONTEXT & STATE ENGINE                         |
|                                (AppContext.tsx)                                   |
|   - Active Transport Mode (CAR, BIKE, BICYCLE, WALK, TRANSIT)                     |
|   - Navigation State Machine (IDLE, ROUTING, GUIDANCE, ARRIVED)                   |
|   - GPS Signal State (AVAILABLE, STALE, LOST, RECOVERING, RECOVERED)              |
|   - Route Corridors & Active Selection (FASTEST, SAFEST, BALANCED)                |
+-----------------------------------------------------------------------------------+
               |                               |                        |
               v                               v                        v
+-----------------------------+ +-----------------------------+ +-------------------+
|      ROUTING SUBSYSTEM      | |    RISK & INCIDENT SUBSYSTEM | |   LOCATION ENGINE |
| (routingService/routingEngine)| | (incidentService/riskEngine)| | (locationService)|
|  - Multi-profile TomTom API | |  - Spatio-temporal matching | | - Anomaly Filter  |
|  - OpenRouteService fallback| |  - Severity weighting       | | - Teleport Gate   |
|  - OSRM high-speed fallback | |  - Cooldown gate (60s)      | | - Clock-skew gate |
|  - Synthetic offline engine | |  - Explainable contributors | | - Dead reckoning  |
+-----------------------------+ +-----------------------------+ +-------------------+
               |                               |                        |
               +-----------------------+-------+                        |
                                       v                                v
+-----------------------------------------------------------------------------------+
|                              MAP & RENDERING SUBSYSTEM                            |
|                                    (MapLibre GL)                                  |
|   - Vector tiles (Carto Positron / Dark Matter / OpenStreetMap)                   |
|   - Dynamic GeoJSON route corridors & safety heatmaps                             |
|   - Dynamic 3D vehicle puck with compass-bearing smoothing                        |
|   - Emergency vehicle radar blips and pulse animations                            |
+-----------------------------------------------------------------------------------+
               |                                                        |
               v                                                        v
+-----------------------------------------------------------------------------------+
|                           EXTERNAL PROVIDER INTEGRATIONS                          |
|   - TomTom Routing & Traffic Flow API                                             |
|   - OpenRouteService Directions API                                               |
|   - MapLibre / OpenStreetMap Geocoding (Nominatim / Photon)                       |
|   - Web Speech API (SpeechRecognition + SpeechSynthesis)                          |
|   - GTFS Static Engine + GTFS-Realtime Ingestion Gateway                          |
+-----------------------------------------------------------------------------------+
```

---

## 3. Subsystem Breakdown

### 3.1 Routing & Multi-Modal Corridors
- **Primary Live Routing:** TomTom Routing API v1 with realtime speed flows, historical travel patterns, and live delay injection.
- **Provider Fallback Chain:**
  1. TomTom Online API (when API key is valid).
  2. OpenRouteService API (secondary live corridor provider).
  3. OSRM High-Speed Engine (deterministic routing without vendor dependency).
  4. Local Geometric Engine (fallback during complete network blackout).
- **Transport Mode Isolation:**
  - `CAR`: Highway-permitted, multi-lane routing, vehicle turning radii, speed limit modeling.
  - `BIKE`: Two-wheeler routing, shortcut modeling, filtered from limited-access expressways.
  - `BICYCLE`: Low-stress neighborhood ways, dedicated cycling trails, elevation-penalized slopes.
  - `WALK`: Pedestrian footpaths, crosswalks, stairs, pedestrian-only zones, 4.5 km/h base speed.
  - `TRANSIT`: GTFS static schedule lookups with transfer penalty calculation.

### 3.2 Real-Time GPS & Position Ingestion
- `src/services/locationService.ts` implements a multi-layer physical validation gate:
  - **Null-Island Filter:** Rejects `[0, 0]` coordinates emitted during uninitialized GPS daemon states.
  - **Boundary Filter:** Discards values exceeding latitude [-90, +90] or longitude [-180, +180].
  - **Teleportation Gate:** Rejects position jumps exceeding 220 km/h (61.1 m/s) relative to preceding timestamp.
  - **Clock-Skew Defense:** Discards GPS packets stamped >15s in the future or >5s older than previous reading.
  - **Signal Lifecycle Management:** Transitions between `AVAILABLE`, `STALE`, `LOST`, `RECOVERING`, and `RECOVERED` without resetting active turn-by-turn guidance or user destination.

### 3.3 Dynamic Incident Decision Gate & Reroute Engine
- `src/services/incidentService.ts` and `src/engines/routingEngine.ts`:
  - Correlates incoming incidents against active route geometry using 150-meter buffer envelopes.
  - Enforces a 60-second cooldown gate between non-critical recalculations to eliminate guidance thrashing.
  - Immediately triggers reroute upon `ROAD_CLOSURE`, `ACCIDENT`, or `FLOOD` blocking the current corridor.
  - Preserves user travel mode during dynamic recalculations.

### 3.4 Explainable AI Road Risk Engine
- Calculates composite risk scores (0–100) along every candidate corridor:
  - Base road-class risk (motorway vs undivided secondary road).
  - Time-of-day risk (nighttime driving penalty).
  - Weather risk (precipitation, visibility reduction).
  - Dynamic incident penalty (active hazards, construction, congestion delays).
- Generates transparent, human-readable risk contributor breakdowns (e.g., *"+12 pts Traffic Congestion", "+25 pts Flash Flood Hazard"*).

### 3.5 GTFS Static & Realtime Transit Architecture
- Compliant with GTFS Reference Specification (November 2022).
- Validates 6 core static tables (`agency.txt`, `routes.txt`, `stops.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`).
- Features an honest GTFS-Realtime Protocol Gateway that returns explicit `UNAVAILABLE` status when no live agency feed is configured, strictly preventing ghost transit predictions.

### 3.6 Multimodal Voice Command Subsystem
- Integrates browser Web Speech Recognition and SpeechSynthesis with offline keyword matching.
- Supports 11 intents: `NAVIGATE_TO`, `FIND_POI`, `SWITCH_MODE`, `SHOW_TRAFFIC`, `AVOID_HIGHWAYS`, `AVOID_TOLLS`, `SAFEST_ROUTE`, `FASTEST_ROUTE`, `CANCEL_ROUTE`, `START_NAVIGATION`, `STOP_NAVIGATION`.
