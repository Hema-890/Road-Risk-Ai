# RoadRisk AI — GTFS Static & Realtime Implementation Specification
**Version:** 2.0.0-PROD  
**Author:** Lead Principal Engineer & Product Architect  
**Component:** `src/services/transitService.ts`  

---

## 1. Executive Summary

RoadRisk AI integrates a formal Public Transit Engine complying with the **General Transit Feed Specification (GTFS Reference Nov 2022)**. The engine distinguishes clearly between deterministic static schedule models and dynamic live telemetry, eliminating "ghost buses" or fabricated ETA promises when live municipal telemetry is unavailable.

---

## 2. GTFS Static Specification Data Models

The service defines first-class TypeScript interfaces for all foundational GTFS entities:

```typescript
// agency.txt
export interface TransitAgency {
  agency_id: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang?: string;
  agency_phone?: string;
}

// routes.txt
export interface TransitRoute {
  route_id: string;
  agency_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number; // 0=Tram, 1=Subway, 2=Rail, 3=Bus, 4=Ferry, 5=Cable, 6=Gondola, 7=Funicular
  route_color?: string;
  route_text_color?: string;
}

// stops.txt
export interface TransitStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  zone_id?: string;
  location_type?: number; // 0=Stop, 1=Station, 2=Entrance/Exit
  parent_station?: string;
  wheelchair_boarding?: number;
}

// trips.txt
export interface TransitTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign?: string;
  direction_id?: number; // 0=Outbound, 1=Inbound
  block_id?: string;
  shape_id?: string;
}

// stop_times.txt
export interface TransitStopTime {
  trip_id: string;
  arrival_time: string; // HH:MM:SS (may exceed 24:00:00 for trips past midnight)
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
  pickup_type?: number;
  drop_off_type?: number;
}

// calendar.txt
export interface TransitCalendar {
  service_id: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  start_date: string; // YYYYMMDD
  end_date: string;
}
```

---

## 3. Dataset Validation Pipeline (`validateGtfsDataset`)

Before parsing or storing any uploaded transit bundle, `transitService.validateGtfsDataset(files)` executes structural validation:

1. **Mandatory Table Check:**
   Verifies that `agency.txt`, `routes.txt`, `stops.txt`, `trips.txt`, and `stop_times.txt` are all present.
2. **Column Completeness:**
   Verifies that required header columns (e.g., `stop_id`, `stop_name`, `stop_lat`, `stop_lon` for `stops.txt`) exist in each CSV payload.
3. **Data Type and Coordinate Range Validation:**
   Ensures latitude and longitude coordinates fall strictly within valid geospatial bounds `[-90, 90]` and `[-180, 180]`.
4. **Relational Integrity:**
   - Validates that `route_id` referenced in `trips.txt` exists in `routes.txt`.
   - Validates that `stop_id` in `stop_times.txt` exists in `stops.txt`.
   - Validates that `service_id` in `trips.txt` resolves in `calendar.txt` or `calendar_dates.txt`.

---

## 4. Built-in Regional Transit Demo Dataset

To ensure immediate platform usability in demonstration environments without requiring external server dependencies, the service provides an embedded Vijayawada–Amaravati regional transit network:

- **Agencies:** APSRTC (Andhra Pradesh State Road Transport Corporation)
- **Routes:**
  - Route `100`: Vijayawada Central <-> Amaravati Secretariat Express
  - Route `200`: PNBS <-> Vijayawada Airport Shuttle
- **Key Transit Stations:**
  - Vijayawada Central (PNBS) `(16.5186, 80.6195)`
  - Benz Circle Intermodal Hub `(16.5003, 80.6480)`
  - Ramavarappadu Rail/Bus Crossing `(16.5180, 80.6720)`
  - Amaravati Secretariat Complex `(16.5412, 80.5158)`
  - Vijayawada International Airport (Gannavaram) `(16.5304, 80.7968)`
- **Schedules:** Continuous 15-minute headway departures configured across peak morning and evening corridors.

---

## 5. GTFS-Realtime Protocol Gateway & Honesty Protocol

The platform implements the standard GTFS-RT feed categories:
1. **TripUpdates:** Real-time delay offsets (+/- minutes) against scheduled `stop_times.txt`.
2. **VehiclePositions:** Real-time GPS coordinates, bearing, and speed of active fleet vehicles.
3. **Alerts:** Dynamic service cancellations, station closures, and severe weather delays.

### The Honesty Protocol Rule
When an agency or municipality has not provisioned a live Protocol Buffer feed (`.pb` / REST stream):
- The transit engine **strictly rejects synthesizing imaginary vehicles** or fabricating fake positions on the map.
- The UI status indicator transitions to `UNAVAILABLE` with the user-facing explanation:
  > *"Live GTFS-Realtime telemetry is not currently published by the local transit agency for this operational sector. Presenting static timetable departures only."*
- Scheduled departures are explicitly labeled `Scheduled (Timetable)` rather than `Live Tracking`.

---

## 6. Verification and Unit Test Coverage

The GTFS subsystem is tested continuously under `scripts/test-production-architecture.mjs`:
- Validation of valid and malformed GTFS bundles.
- Station departure extraction and schedule calculation.
- Honest absence of unconfigured live feeds without synthetic data leaks.
