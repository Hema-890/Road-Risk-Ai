-- ==============================================================================
-- ROADRISK AI — MASTER PRODUCTION POSTGIS SCHEMA
-- All 25 Canonical Tables with Spatial (GIST) Indexes, Time Indexes & Status Indexes
-- Target: PostgreSQL 15+ with PostGIS / Supabase
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. ROAD SEGMENTS
CREATE TABLE IF NOT EXISTS public.road_segments (
    id TEXT PRIMARY KEY,
    road_name TEXT NOT NULL,
    city_id TEXT DEFAULT 'andhra_pradesh' NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    risk_score INTEGER DEFAULT 20 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level TEXT DEFAULT 'LOW' NOT NULL,
    hard_braking_events INTEGER DEFAULT 0 NOT NULL,
    sudden_swerving_events INTEGER DEFAULT 0 NOT NULL,
    abnormal_slowdown_events INTEGER DEFAULT 0 NOT NULL,
    traffic_level DOUBLE PRECISION DEFAULT 0.2 NOT NULL,
    accident_reports INTEGER DEFAULT 0 NOT NULL,
    flooding_level DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
    road_blockage BOOLEAN DEFAULT FALSE NOT NULL,
    speed_limit_kmh INTEGER DEFAULT 60 NOT NULL,
    data_source TEXT DEFAULT 'real' NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_road_segments_geom ON public.road_segments USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_road_segments_risk ON public.road_segments (risk_score);

-- 2. ROAD INCIDENTS
CREATE TABLE IF NOT EXISTS public.road_incidents (
    incident_id TEXT PRIMARY KEY,
    provider_id TEXT DEFAULT 'tomtom',
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    road_name TEXT,
    from_location TEXT,
    to_location TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    geometry_json JSONB,
    delay_seconds INTEGER DEFAULT 0,
    length_meters INTEGER DEFAULT 0,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    number_of_reports INTEGER DEFAULT 1,
    last_report_time TIMESTAMPTZ,
    source TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    status TEXT DEFAULT 'LIVE' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_geom ON public.road_incidents USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.road_incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_observed ON public.road_incidents (observed_at DESC);

-- 3. TRAFFIC CURRENT
CREATE TABLE IF NOT EXISTS public.traffic_current (
    segment_id TEXT PRIMARY KEY,
    road_name TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    current_speed DOUBLE PRECISION NOT NULL,
    free_flow_speed DOUBLE PRECISION NOT NULL,
    traffic_ratio DOUBLE PRECISION NOT NULL,
    congestion_level TEXT NOT NULL,
    confidence DOUBLE PRECISION DEFAULT 1.0,
    coordinates_json JSONB,
    source TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    status TEXT DEFAULT 'LIVE' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_traffic_current_geom ON public.traffic_current USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_traffic_current_status ON public.traffic_current (status);

-- 4. TRAFFIC SNAPSHOTS
CREATE TABLE IF NOT EXISTS public.traffic_snapshots (
    id BIGSERIAL PRIMARY KEY,
    segment_id TEXT,
    traffic_model_id TEXT,
    current_speed DOUBLE PRECISION NOT NULL,
    free_flow_speed DOUBLE PRECISION NOT NULL,
    traffic_ratio DOUBLE PRECISION NOT NULL,
    snapshot_time TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_time ON public.traffic_snapshots (snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_segment ON public.traffic_snapshots (segment_id);

-- 5. WEATHER OBSERVATIONS
CREATE TABLE IF NOT EXISTS public.weather_observations (
    id TEXT PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    temperature_c DOUBLE PRECISION,
    precipitation_mm DOUBLE PRECISION,
    wind_speed_kmh DOUBLE PRECISION,
    visibility_meters DOUBLE PRECISION,
    weather_code INTEGER,
    condition_label TEXT,
    source TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    status TEXT DEFAULT 'LIVE' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_weather_geom ON public.weather_observations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_weather_time ON public.weather_observations (observed_at DESC);

-- 6. FLOOD EVENTS
CREATE TABLE IF NOT EXISTS public.flood_events (
    flood_id TEXT PRIMARY KEY,
    level TEXT NOT NULL, -- LEVEL 1: CONFIRMED ROAD FLOODING, LEVEL 2: REGIONAL FLOOD MODEL, LEVEL 3: USER REPORTED
    label TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    polygon_json JSONB,
    river_discharge_m3s DOUBLE PRECISION,
    depth_meters DOUBLE PRECISION,
    source TEXT NOT NULL,
    confidence DOUBLE PRECISION DEFAULT 1.0,
    observed_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'LIVE' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flood_geom ON public.flood_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_flood_status ON public.flood_events (status);

-- 7. DISASTER ALERTS
CREATE TABLE IF NOT EXISTS public.disaster_alerts (
    alert_id TEXT PRIMARY KEY,
    source TEXT DEFAULT 'NDMA SACHET' NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    headline TEXT NOT NULL,
    description TEXT NOT NULL,
    official_reference TEXT,
    affected_geometry_json JSONB,
    issued_at TIMESTAMPTZ NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'ACTIVE' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_disaster_alerts_status ON public.disaster_alerts (status);
CREATE INDEX IF NOT EXISTS idx_disaster_alerts_expires ON public.disaster_alerts (expires_at);

-- 8. TRANSIT STOPS
CREATE TABLE IF NOT EXISTS public.transit_stops (
    stop_id TEXT PRIMARY KEY,
    stop_name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    feed_id TEXT,
    source TEXT DEFAULT 'GTFS' NOT NULL,
    status TEXT DEFAULT 'STATIC' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transit_stops_geom ON public.transit_stops USING GIST (geom);

-- 9. TRANSIT ROUTES
CREATE TABLE IF NOT EXISTS public.transit_routes (
    route_id TEXT PRIMARY KEY,
    agency_id TEXT,
    route_short_name TEXT,
    route_long_name TEXT,
    route_type INTEGER,
    source TEXT DEFAULT 'GTFS' NOT NULL
);

-- 10. TRANSIT VEHICLE POSITIONS
CREATE TABLE IF NOT EXISTS public.transit_vehicle_positions (
    vehicle_id TEXT PRIMARY KEY,
    trip_id TEXT,
    route_id TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    bearing DOUBLE PRECISION,
    speed_kmh DOUBLE PRECISION,
    current_stop_sequence INTEGER,
    current_status TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    source TEXT DEFAULT 'GTFS-Realtime' NOT NULL,
    status TEXT DEFAULT 'LIVE' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transit_vehicles_geom ON public.transit_vehicle_positions USING GIST (geom);

-- 11. TRANSIT TRIP UPDATES
CREATE TABLE IF NOT EXISTS public.transit_trip_updates (
    trip_id TEXT PRIMARY KEY,
    route_id TEXT,
    delay_seconds INTEGER DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL,
    source TEXT DEFAULT 'GTFS-Realtime' NOT NULL
);

-- 12. TRANSIT SERVICE ALERTS
CREATE TABLE IF NOT EXISTS public.transit_service_alerts (
    alert_id TEXT PRIMARY KEY,
    cause TEXT,
    effect TEXT,
    header_text TEXT NOT NULL,
    description_text TEXT,
    source TEXT DEFAULT 'GTFS-Realtime' NOT NULL,
    status TEXT DEFAULT 'ACTIVE' NOT NULL
);

-- 13. EMERGENCY VEHICLE POSITIONS
CREATE TABLE IF NOT EXISTS public.emergency_vehicle_positions (
    vehicle_id TEXT PRIMARY KEY,
    vehicle_type TEXT NOT NULL,
    callsign TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    heading DOUBLE PRECISION DEFAULT 0,
    speed_kmh DOUBLE PRECISION DEFAULT 0,
    route_geometry_json JSONB,
    active_mission_id TEXT,
    status TEXT DEFAULT 'AVAILABLE' NOT NULL,
    source TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emergency_vehicles_geom ON public.emergency_vehicle_positions USING GIST (geom);

-- 14. USER HAZARD REPORTS
CREATE TABLE IF NOT EXISTS public.user_hazard_reports (
    report_id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    road_name TEXT,
    reported_by TEXT DEFAULT 'Citizen',
    status TEXT DEFAULT 'USER_REPORTED' NOT NULL,
    corroboration_count INTEGER DEFAULT 1,
    reported_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    source TEXT DEFAULT 'Citizen Report' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_hazards_geom ON public.user_hazard_reports USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_user_hazards_status ON public.user_hazard_reports (status);

-- 15. ROAD RISK SNAPSHOTS
CREATE TABLE IF NOT EXISTS public.road_risk_snapshots (
    id TEXT PRIMARY KEY,
    road_segment_id TEXT NOT NULL,
    road_name TEXT,
    risk_score INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    contributors_json JSONB NOT NULL,
    model_version TEXT NOT NULL,
    feature_timestamp TIMESTAMPTZ NOT NULL,
    confidence DOUBLE PRECISION DEFAULT 1.0,
    data_sufficiency TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_segment ON public.road_risk_snapshots (road_segment_id);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_time ON public.road_risk_snapshots (calculated_at DESC);

-- 16. ROUTE EVENTS
CREATE TABLE IF NOT EXISTS public.route_events (
    id BIGSERIAL PRIMARY KEY,
    route_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    reason TEXT,
    distance_km DOUBLE PRECISION,
    eta_minutes DOUBLE PRECISION,
    risk_score INTEGER,
    payload_json JSONB,
    timestamp TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 17. ROUTE HISTORY
CREATE TABLE IF NOT EXISTS public.route_history (
    id BIGSERIAL PRIMARY KEY,
    mission_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    reroute_sequence INTEGER NOT NULL,
    trigger_reason TEXT,
    start_lat DOUBLE PRECISION NOT NULL,
    start_lng DOUBLE PRECISION NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL,
    duration_seconds DOUBLE PRECISION NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 18. FUEL STATIONS
CREATE TABLE IF NOT EXISTS public.fuel_stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    fuel_types_json JSONB,
    opening_hours TEXT,
    distance_meters DOUBLE PRECISION,
    source TEXT DEFAULT 'OSM' NOT NULL,
    status TEXT DEFAULT 'STATIC' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fuel_stations_geom ON public.fuel_stations USING GIST (geom);

-- 19. EMERGENCY SERVICES
CREATE TABLE IF NOT EXISTS public.emergency_services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    phone TEXT,
    address TEXT,
    source TEXT DEFAULT 'OSM' NOT NULL,
    status TEXT DEFAULT 'STATIC' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emergency_services_geom ON public.emergency_services USING GIST (geom);

-- 20. TRAFFIC SIGNALS
CREATE TABLE IF NOT EXISTS public.traffic_signals (
    id TEXT PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    road_name TEXT,
    signal_timing_available BOOLEAN DEFAULT FALSE,
    source TEXT DEFAULT 'OSM' NOT NULL,
    status TEXT DEFAULT 'STATIC' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_traffic_signals_geom ON public.traffic_signals USING GIST (geom);

-- 21. DATA SOURCE HEALTH
CREATE TABLE IF NOT EXISTS public.data_source_health (
    provider_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    last_success TIMESTAMPTZ,
    last_failure TIMESTAMPTZ,
    latency_ms INTEGER DEFAULT 0,
    http_status INTEGER,
    freshness TEXT NOT NULL,
    records_received INTEGER DEFAULT 0,
    records_rejected INTEGER DEFAULT 0,
    error TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 22. TELEMETRY EVENTS
CREATE TABLE IF NOT EXISTS public.telemetry_events (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION NOT NULL,
    acceleration DOUBLE PRECISION,
    timestamp TIMESTAMPTZ NOT NULL
);

-- 23. EVENT HISTORY
CREATE TABLE IF NOT EXISTS public.event_history (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    road_segment_id TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT NOT NULL,
    payload_json JSONB,
    observed_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_event_history_type ON public.event_history (event_type);
CREATE INDEX IF NOT EXISTS idx_event_history_time ON public.event_history (observed_at DESC);

-- 24. OFFLINE REGIONS
CREATE TABLE IF NOT EXISTS public.offline_regions (
    region_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bounding_box_json JSONB NOT NULL,
    size_mb DOUBLE PRECISION NOT NULL,
    coverage_description TEXT,
    features_available_json JSONB,
    download_status TEXT DEFAULT 'AVAILABLE',
    last_updated TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 25. MAP DOWNLOADS
CREATE TABLE IF NOT EXISTS public.map_downloads (
    download_id TEXT PRIMARY KEY,
    region_id TEXT REFERENCES public.offline_regions(region_id) ON DELETE CASCADE,
    user_id TEXT,
    status TEXT DEFAULT 'COMPLETED' NOT NULL,
    downloaded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable RLS & Read Policies for Public Clients
ALTER TABLE public.road_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flood_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disaster_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hazard_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Allow public read access to active incidents" ON public.road_incidents FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public read access to current traffic" ON public.traffic_current FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public read access to weather" ON public.weather_observations FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public read access to disaster alerts" ON public.disaster_alerts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public read access to user hazard reports" ON public.user_hazard_reports FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
