# ROADRISK AI — Master Mode Architecture Audit
**Document ID:** RRAI-AUDIT-MODES-2026-V1  
**Classification:** Product Architecture Audit  
**Phase:** 0 — Mandatory Codebase & Architecture Inspection  
**Standard:** Truth in Engineering & Non-Destructive Extension  

---

## 1. Executive Summary & Audit Mandate

This architecture audit establishes the operational baseline and integration blueprint for adding three intelligent user modes to RoadRisk AI:
1. **Accessibility Mode (♿)**
2. **Campus Mode (🎓)**
3. **Tourist Mode (🧳)**

### Architectural Invariants:
- **No Replacement of Working Systems:** All existing routing, navigation, voice, traffic, risk scoring, cost intelligence, public transit, and emergency response architectures remain intact and authoritative.
- **Unified Mode Paradigm:** The three modes must not be built as three separate siloed applications. They must plug into a centralized **Unified User Mode Architecture** extending the canonical `RoadRiskOrchestrator`, `AppContext`, `routingService`, `searchService`, `aiCopilotService`, and `navigationVoiceService`.
- **Zero Fabricated Data:** If accessibility data (e.g., tactile paving, elevator operational status, ramp gradient), campus transit schedules, or tourist attraction prices/hours are missing or unverified, the system must explicitly present `"Accessibility information unavailable"`, `"Campus transit data unavailable"`, or `"Opening hours not verified"`. No fake live telemetry.
- **Map-First Experience:** Overlays and drawers must remain non-intrusive; map canvas and real-time guidance remain primary.

---

## 2. Existing Architecture & Reusable Assets

RoadRisk AI operates on a modern, decoupled, provider-agnostic, and event-driven architecture centered around TypeScript, React 18, MapLibre GL / OpenStreetMap, and local/remote geospatial reasoning engines.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              ROADRISK AI                               │
│                         UNIFIED USER MODES                             │
│         [ STANDARD | ACCESSIBILITY | CAMPUS | TOURIST ]                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        MODE CONTEXT & STORE                            │
│  - Mode state, preferences, constraints, layers, voice & risk profiles │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CENTRAL ROADRISK ORCHESTRATOR                        │
│            `roadRiskOrchestrator.ts` (Single Source of Truth)          │
└─────────┬──────────────┬──────────────┬──────────────┬─────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────┐
│ SEARCH & POI │ │ ROUTING      │ │ RISK &     │ │ COST &       │
│ `search-     │ │ `routing-    │ │ TRAFFIC    │ │ MOBILITY     │
│ Service.ts`  │ │ Service.ts`  │ │ `risk-     │ │ `mobility-   │
│              │ │ (ranking)    │ │ Engine.ts` │ │ IntelService`│
└──────────────┘ └──────────────┘ └────────────┘ └──────────────┘
          │              │              │              │
          └──────────────┴──────┬───────┴──────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 CITIZEN NAVIGATION CONTROL & MAP HUD                   │
│   MapLibre GL Vector Canvas + Contextual Drawers + Voice Guidance      │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME EVENT BUS (`eventBus.ts`)                 │
│      Dynamic rerouting, hazard interception, voice alerts, telemetry   │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Reusable Core Services

| Service | Primary File | Core Capabilities & Reusability |
| :--- | :--- | :--- |
| **RoadRisk Orchestrator** | `src/services/roadRiskOrchestrator.ts` | Central state machine coordinating search, corridor planning, canonical trip state (`RoadRiskTripState`), navigation lifecycle, and reroute cooldowns. |
| **Routing Service** | `src/services/routingService.ts` | Multi-modal provider abstraction (TomTom, OSRM, Offline Graph). Computes polylines, sub-segments, corridor hazard intersections, and transparent composite ranking. |
| **Search & Geocoding** | `src/services/searchService.ts` | Multi-provider search (TomTom, Photon, Nominatim). Natural language query parser extracts categories, dietary tags, budget, distance, and facilities (`wheelchair_accessible`, `parking`). |
| **Navigation Voice** | `src/services/navigationVoiceService.ts` | Robust, priority-preemptive speech engine across 5 languages (`en`, `te`, `hi`, `ta`, `kn`) with Chromium race-condition guards and maneuver synthesis. |
| **AI Copilot** | `src/services/aiCopilotService.ts` | Conversational multi-turn assistant converting natural speech/text to structured operations (`CopilotOperation`). |
| **AI Trip Planner** | `src/services/aiTripPlannerService.ts` | Multi-stop itinerary builder with budget optimization, category routing, and seamless handoff to navigation. |
| **Mobility Intelligence** | `src/services/mobilityIntelligenceService.ts` | Journey cost calculations (fuel, tolls, parking, transit, EV charging, CO2) with explicit `isEstimate: true` provenance. |
| **Public Transit** | `src/services/transitService.ts` | GTFS relational schedule query engine with strict fallback guards when data is missing. |
| **Event Bus** | `src/services/eventBus.ts` | Type-safe pub/sub engine handling `ROUTE_CHANGED`, `ROAD_CLOSED`, `HAZARD_REPORTED`, `WEATHER_CHANGED`, etc. |
| **Location & GPS** | `src/services/locationService.ts` | High-frequency GPS tracking with anomaly filtering, heading calculation, and state transition handling. |
| **Corridor Features** | `src/services/corridorFeaturesService.ts` | Geospatial milestone and POI analysis along active route corridors (signals, hospitals, schools). |

### 2.2 Reusable State & UI Components

- **`AppContext.tsx`**: Central application React context managing active portal, selected vehicle, origin/destination coords, calculated routes, active route, navigation telemetry, dynamic reroute prompts, and UI drawers.
- **`CitizenNavigationControl.tsx`**: Primary user-facing navigation interface including search bar, mode selector, route comparison cards, navigation HUD, and bottom sheets.
- **`MapContainer.tsx`**: WebGL/Raster map component rendering base tiles, route polylines, corridor segments, hazard markers, signals, and POIs.
- **`CostIntelligenceCard.tsx`** & **`AiTripPlannerDrawer.tsx`**: Existing modular drawer and card components that can be activated contextually based on mode.

---

## 3. Mode Architecture Integration Points

### 3.1 Unified Mode Concept (`RoadRiskMode`)
The system will introduce `src/types/modes.ts` defining:
```typescript
export type RoadRiskMode = 'STANDARD' | 'ACCESSIBILITY' | 'CAMPUS' | 'TOURIST';
```
with an integrated configuration object:
- `routeConstraints`: Mode-specific route filtering and ranking penalties
- `preferredPOIs`: Prioritized categories for discovery
- `avoidedFeatures`: Stairs, steep gradients, highways, tolls, unlit paths
- `mapLayers`: Active visual layers (accessible entrances, elevators, campus buildings, tourist attractions)
- `navigationPreferences`: Specific audio and prompt profiles
- `accessibilityProfile`: Wheelchair, avoid stairs, prefer elevators, step-free, low gradient, high contrast, reduced motion
- `campusProfile`: Active campus entity, department lookup, pedestrian routing, emergency facilities
- `touristProfile`: Travel style (solo, family, photography, culture, food), duration, budget, sequence optimization

### 3.2 Accessibility Mode Integration
- **Routing Engine Extension:** Instead of a second routing engine, `routingService.ts` receives `modeConstraints`. The composite ranking score:
  $$\text{Score} = w_{\text{time}} \cdot \text{ETA} + w_{\text{traffic}} \cdot \text{Delay} + w_{\text{risk}} \cdot \text{Risk} + w_{\text{access}} \cdot \text{AccessibilityPenalty}$$
  penalizes routes with detected stairs, steep elevation, or unverified crossings for wheelchair users, ranking verified step-free corridors first.
- **POI Search:** Extends `searchService.ts` to surface wheelchair-accessible entrances, restrooms, and parking. Explicitly annotates `"Accessibility status not verified"` if tags are missing in OSM/TomTom.
- **UI & A11y:** Accessible settings drawer (high contrast, large touch targets, reduced motion), keyboard accessibility, and screen reader labels.
- **Voice Guidance:** Localized accessibility cues ("Stairs detected ahead on pedestrian path", "Use ramp entrance on the right").

### 3.3 Campus Mode Integration
- **Entity Model:** `Campus`, `Building`, `CampusPOI`, `CampusPath`, and `CampusEvent`.
- **Pre-loaded Verified Campuses:** Andhra University, IIT Hyderabad, KL University, GITAM Visakhapatnam, SRM University AP.
- **Campus Search:** Natural language resolution of departments ("AI & DS Dept", "Central Library", "CSE Block", "Cafeteria").
- **Routing & Safety:** Building-to-building, gate-to-building, and emergency navigation using pedestrian paths and internal campus road corridors. Listens to `EventBus` for campus path closures, temporary construction, or unsafe zones to reroute dynamically.
- **Emergency Integration:** Instant routing to campus medical center, security post, or emergency gate.

### 3.4 Tourist Mode Integration
- **Itinerary Engine Reuse:** Integrates directly with `aiTripPlannerService.ts`.
- **Cost Engine Reuse:** Computes realistic trip costs (fuel, parking, entry, transit) using `mobilityIntelligenceService.ts` with `isEstimate: true`.
- **Risk Assessment:** Applies `roadRiskOrchestrator` corridor risk to tourist itineraries (e.g., road closures, weather advisories).
- **Multi-Stop Navigation & Skip:** Supports sequential attraction discovery and allows skipping stops with on-the-fly itinerary recalculation.
- **Multilingual Voice:** Sights explanations, cost summaries, and next-stop announcements.

---

## 4. Potential Conflicts & Pitfalls to Avoid

1. **Duplicate Routing Engines:** Creating `accessibilityRoutingEngine.ts` or `campusRoutingEngine.ts` would duplicate polyline geometry and break TomTom/OSRM provider fallback. **Solution:** Parameterize the canonical `routingService.ts` and rank via mode constraints.
2. **Fake Accessibility Telemetry:** Claiming a sidewalk is wheelchair-friendly without OSM `wheelchair=yes` or verified slope data violates safety principles. **Solution:** Clearly state `"Accessibility status not verified"` when data is unconfirmed.
3. **Re-render Thrashing:** Adding mode states to `AppContext.tsx` could cause excessive re-renders of the map canvas if not memoized. **Solution:** Use memoized selectors, decoupled state stores (`modeService.ts`), and localized subscription patterns.
4. **Speech Synthesis Overlap:** Multiple services invoking `window.speechSynthesis` simultaneously causes dropped speech or audio stuttering. **Solution:** All spoken output routes strictly through the priority queue in `navigationVoiceService.ts`.
5. **Overloaded Map UI:** Simultaneous display of campus buildings, accessible ramps, and tourist attractions would clutter the viewport. **Solution:** Map layers are conditionally rendered based on active `userMode` and toggleable category filters.

---

## 5. File Modification & Preservation Strategy

### Files to NOT Modify Unnecessarily:
- `src/services/osrmService.ts`: Core network caller for OSRM geometry.
- `src/services/trafficService.ts`: Direct TomTom traffic flow provider.
- `src/services/floodService.ts`: GloFAS hydrological model consumer.
- `src/services/weatherService.ts`: Open-Meteo weather client.
- `src/services/telemetryService.ts`: Telemetry buffer.
- `src/services/networkStatusService.ts`: Online/offline ping checker.

### Files to Extend Cleanly:
- `src/types/index.ts` & `src/types/modes.ts`: Add `RoadRiskMode`, `ModeConfiguration`, `AccessibilityProfile`, `CampusEntity`, `TouristProfile`.
- `src/services/roadRiskOrchestrator.ts`: Bind active mode, expose mode switcher, pass constraints to routing.
- `src/services/routingService.ts`: Accept mode-aware ranking options and accessibility/campus path constraints.
- `src/services/searchService.ts`: Enhance natural-language query parser for campus entities and accessibility filters.
- `src/services/navigationVoiceService.ts`: Add accessibility, campus, and tourist voice announcements in EN, TE, HI, TA, KN.
- `src/services/aiCopilotService.ts`: Handle mode-specific actions (`SWITCH_MODE`, `FIND_ACCESSIBLE_ROUTE`, `CAMPUS_NAVIGATE`, `PLAN_TOURIST_TRIP`).
- `src/components/navigation/CitizenNavigationControl.tsx`: Add clean, floating User Mode Selector, contextual mode settings drawers, and accessible controls.
- `src/components/map/MapContainer.tsx`: Add lightweight vector/marker layers for accessible features, campus footprints, and tourist POIs.

---

## 6. Audit Conclusion & Next Phase Authorization

The architecture is clean, highly modular, and ideally structured for a non-destructive extension.
- **Phase 0 Audit is Complete.**
- Proceeding to **Phase 1: Unified Mode Architecture Implementation**.
