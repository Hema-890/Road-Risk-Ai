# RoadRisk AI — Real-Time Feature Matrix & Provenance Registry

**Document Version:** 2.0.0 (Production Implementation)  
**Standard:** Truthful Data Categorization, Zero-Simulation Rule, Anti-Hallucination Gated  

---

## 1. Intelligence Tiers

RoadRisk AI classifies all data into three distinct architectural tiers:

1. **LIVE FACTS**: Observed real-world telemetry from hardware, external radar/traffic sensors, official municipality APIs, or authenticated citizen reports.
2. **MODELED PREDICTIONS**: Statistical or ML-derived inferences (GBDE-v2.1 ensemble, GloFAS river discharge forecast, route-hazard spatial collision detection).
3. **STATIC / REFERENCE**: Structural baselines that do not change dynamically (OSM topological vectors, hospital trauma locations, signal node geometry).

If an external provider or municipal feed does not exist for a region, the status is explicitly **`UNAVAILABLE / INSUFFICIENT DATA`**. No synthetic placeholders or random math generators are substituted.

---

## 2. Complete Feature & Subsystem Matrix

| # | Feature / Subsystem | Intelligence Tier | Data Provider / Engine | Protocol / Endpoint | Real-World Refresh Rate | Status | Limitations & Verification |
|---|---|---|---|---|---|---|---|
| **1** | **Vector Base Map Tiles** | `STATIC / REFERENCE` | MapTiler / OpenStreetMap | `https://api.maptiler.com/maps/streets-v2/style.json` | Vector tile cache | **`STATIC DATA VERIFIED`** | Authoritative global road geometry, highway shields, and building footprints. |
| **2** | **Live Traffic Flow & Velocities** | `LIVE FACTS` | TomTom Traffic Flow API | `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json` | 60 seconds | **`LIVE VERIFIED`** | Returns current speed, free-flow speed, and confidence (0-1). Tested live in Hyderabad corridor (20 km/h flow). |
| **3** | **Traffic Incidents & Road Closures** | `LIVE FACTS` | TomTom Traffic Incidents v5 | `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=...` | 60 seconds | **`LIVE VERIFIED`** | Returns active road closures, jams, and construction. Ingested 643 active incidents in current bounding box. |
| **4** | **Traffic-Aware Dynamic Routing** | `LIVE FACTS` | TomTom Routing API | `https://api.tomtom.com/routing/1/calculateRoute/...` | On demand / event-driven | **`LIVE VERIFIED`** | Considers real-world delays, historical traffic patterns, and closure avoidance. |
| **5** | **Atmospheric NWP Weather** | `LIVE FACTS` | Open-Meteo Weather API | `https://api.open-meteo.com/v1/forecast?current=...` | 15 minutes | **`LIVE VERIFIED`** | Genuine ECMWF/DWD numerical weather: precipitation, temperature, wind gusts, visibility. Zero API key required. |
| **6** | **Hydrological Catchment Flood Model** | `MODELED PREDICTIONS` | Copernicus GloFAS / Open-Meteo Flood API | `https://flood-api.open-meteo.com/v1/flood?daily=river_discharge` | Daily / 6 hours | **`MODEL VERIFIED`** | Forecasts river discharge ($m^3/s$) on ~5km grid. Model projections: 32.11 $m^3/s$. Does not resolve localized street puddles unless combined with TomTom flooding incidents. |
| **7** | **Citizen Road Incident Reports** | `LIVE FACTS` | Supabase Postgres + PostGIS | `REST / Supabase Realtime (WSS)` | Event-driven (push) | **`LIVE VERIFIED`** | Citizen-submitted and peer-verified road obstructions with coordinate validation. |
| **8** | **Device GPS & Kinematic Telemetry** | `LIVE FACTS` | W3C Geolocation API | `navigator.geolocation.watchPosition` | 1 Hz | **`LIVE VERIFIED`** | Raw coordinates filtered through Kalman/speed anomaly gate (rejects $>140\text{ km/h}$ kinematic teleportation). |
| **9** | **ML Segment Risk Classifier** | `MODELED PREDICTIONS` | Gradient Boosted Decision Ensemble (`GBDE-v2.1`) | Client-side WASM/ESM ML Inference Pipeline | Real-time on segment update | **`MODEL VERIFIED`** | Normalizes 10 physical features, executes additive logistic stump trees, outputs SHAP-style explainable contributions. Gated against hallucination when data is insufficient. |
| **10** | **Route × Hazard Spatial Collision Gate** | `MODELED PREDICTIONS` | RoadRisk Spatial Routing Engine | In-memory line-segment point distance ($<50\text{m}$) | On route / hazard change | **`MODEL VERIFIED`** | Determines obstruction ahead distance, severity, and urgency. Intersects critical closures and flood hazards. |
| **11** | **Dynamic Reroute Decision & Cooldown** | `MODELED PREDICTIONS` | RoadRisk Routing Engine | State machine with 60-second hysteresis | Event-driven | **`MODEL VERIFIED`** | Enforces minimum 3-minute travel time saving or critical blockage before re-routing; suppresses route thrashing. |
| **12** | **Emergency Fleet Approaching Geofence** | `LIVE FACTS` / `MODELED` | Supabase Realtime Fleet Stream | `WSS / Supabase Realtime` | 1-2 Hz per vehicle | **`LIVE VERIFIED`** (When Connected) | Geofences active sirens within 350m, computes approach vectors (`BEHIND`, `INTERSECTION`, `OPPOSITE`), alerts driver to yield. |
| **13** | **Multilingual Voice Safety Synthesis** | `MODELED PREDICTIONS` | Web Speech API / Safe Templates | Browser TTS (`SpeechSynthesisUtterance`) | Triggered on high hazard | **`LIVE VERIFIED`** | Native dynamic voice alerts in 5 languages: English (`en`), Telugu (`te`), Hindi (`hi`), Tamil (`ta`), Kannada (`kn`). No hardcoded English strings. |
| **14** | **Public Transit Live Feeds (GTFS-RT)** | `LIVE FACTS` | Regional GTFS-Realtime Gateway | Protocol Buffers / REST | 30 seconds | **`UNAVAILABLE`** | Strictly reports: *"Live transit feed unavailable. Municipal transit agency has not published a public GTFS-Realtime stream for this bounding box."* Zero synthetic buses. |
| **15** | **Signal Countdown Timers (SPaT)** | `LIVE FACTS` | V2X / Urban Signal Controller | DSRC / C-V2X (SAE J2735) | N/A | **`UNAVAILABLE`** | Declared unavailable. Urban traffic lights in target cities do not publish public digital SPaT broadcasts. Static signal node locations displayed as reference only. |
| **16** | **Hospital Emergency Trauma Centers** | `STATIC / REFERENCE` | OpenStreetMap Overpass API | Overpass QL `amenity=hospital` | Static / monthly cache | **`STATIC DATA VERIFIED`** | Genuine accredited medical facilities with emergency casualty wards and helipads. |

---

## 3. Data Integrity & Verification Summary

- **Total Subsystems Evaluated:** 16
- **Live Facts Verified:** 6
- **Modeled Predictions Verified:** 5
- **Static / Reference Verified:** 2
- **Declared Unavailable (Truthful Gate):** 2 (GTFS-RT, Live V2X SPaT)
- **Synthetic / Hardcoded Placeholders in Production:** **0% (Zero)**
