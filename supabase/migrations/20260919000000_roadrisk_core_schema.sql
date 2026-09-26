-- ==============================================================================
-- ROADRISK AI — CORE ENTERPRISE SCHEMA & ROW LEVEL SECURITY POLICIES
-- Target: PostgreSQL 15+ / Supabase
-- Version: 2.0.0
-- Migration: 20260919000000_roadrisk_core_schema.sql
-- ==============================================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('citizen', 'operator', 'dispatcher', 'medic', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE mission_status AS ENUM (
        'STANDBY', 'ASSIGNED', 'ROUTE_SELECTION', 'READY_TO_START',
        'EN_ROUTE', 'INCIDENT_DETECTED', 'RISK_RECALCULATING',
        'REROUTING', 'REROUTE_SELECTED', 'ROUTE_UPDATED',
        'GREEN_CORRIDOR_ACTIVE', 'ARRIVING', 'ARRIVED', 'ON_SCENE',
        'TRANSPORTING', 'COMPLETED', 'ABORTED', 'CANCELLED', 'PAUSED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE hazard_severity AS ENUM ('low', 'moderate', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE data_provenance AS ENUM ('real', 'operator_entry', 'sensor_telemetry', 'simulation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_status AS ENUM ('AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'HAZARD_ALERT', 'REROUTING', 'AT_SCENE', 'RETURNING', 'MAINTENANCE', 'OFFLINE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. USERS & PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    email TEXT,
    role user_role DEFAULT 'operator' NOT NULL,
    agency TEXT DEFAULT 'Emergency Medical Services',
    badge_number TEXT,
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. HOSPITALS & TRAUMA HUBS TABLE (Verified Only — Never Fake Bed Availability)
CREATE TABLE IF NOT EXISTS public.hospitals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'trauma_center' NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    phone TEXT,
    emergency_direct_line TEXT,
    trauma_level TEXT DEFAULT 'Level-1',
    verified_capabilities JSONB DEFAULT '{"icu": true, "cardiac": true, "burn_unit": false, "helipad": true}'::jsonb,
    bed_capacity_status TEXT DEFAULT 'Unknown' NOT NULL, -- Never fake bed availability
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    data_source data_provenance DEFAULT 'real' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hospitals_coords ON public.hospitals(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_hospitals_active ON public.hospitals(is_active);

-- 4. EMERGENCY VEHICLES TABLE
CREATE TABLE IF NOT EXISTS public.emergency_vehicles (
    id TEXT PRIMARY KEY,
    callsign TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    category TEXT DEFAULT 'medical' NOT NULL,
    status vehicle_status DEFAULT 'AVAILABLE' NOT NULL,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    current_heading DOUBLE PRECISION DEFAULT 0.0,
    speed_kmh DOUBLE PRECISION DEFAULT 0.0,
    max_speed_kmh DOUBLE PRECISION DEFAULT 120.0,
    weight_tons DOUBLE PRECISION DEFAULT 3.5,
    width_meters DOUBLE PRECISION DEFAULT 2.1,
    active_mission_id TEXT,
    assigned_agency TEXT DEFAULT 'Emergency Medical Services',
    data_source data_provenance DEFAULT 'real' NOT NULL,
    last_telemetry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.emergency_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_active_mission ON public.emergency_vehicles(active_mission_id);

-- 5. ROAD SEGMENTS & PREDICTIVE RISK SCORES
CREATE TABLE IF NOT EXISTS public.road_segments (
    id TEXT PRIMARY KEY,
    road_name TEXT NOT NULL,
    city_id TEXT DEFAULT 'hyderabad' NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    risk_score INTEGER DEFAULT 20 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level TEXT DEFAULT 'LOW' NOT NULL,
    hard_braking_events INTEGER DEFAULT 0 NOT NULL,
    sudden_swerving_events INTEGER DEFAULT 0 NOT NULL,
    abnormal_slowdown_events INTEGER DEFAULT 0 NOT NULL,
    traffic_density DOUBLE PRECISION DEFAULT 0.2,
    flooding_level DOUBLE PRECISION DEFAULT 0.0,
    is_blocked BOOLEAN DEFAULT FALSE NOT NULL,
    speed_limit_kmh INTEGER DEFAULT 60 NOT NULL,
    last_risk_update TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_road_segments_coords ON public.road_segments(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_road_segments_risk ON public.road_segments(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_road_segments_city ON public.road_segments(city_id);

-- 6. MISSIONS & DISPATCH SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.missions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    vehicle_id TEXT REFERENCES public.emergency_vehicles(id) ON DELETE SET NULL,
    origin_name TEXT NOT NULL,
    origin_lat DOUBLE PRECISION NOT NULL,
    origin_lng DOUBLE PRECISION NOT NULL,
    destination_name TEXT NOT NULL,
    destination_lat DOUBLE PRECISION NOT NULL,
    destination_lng DOUBLE PRECISION NOT NULL,
    selected_route_id TEXT,
    status mission_status DEFAULT 'STANDBY' NOT NULL,
    distance_km DOUBLE PRECISION DEFAULT 0.0,
    base_eta_minutes DOUBLE PRECISION DEFAULT 0.0,
    adjusted_eta_minutes DOUBLE PRECISION DEFAULT 0.0,
    time_saved_minutes DOUBLE PRECISION DEFAULT 0.0,
    risk_avoided_points INTEGER DEFAULT 0,
    reroute_count INTEGER DEFAULT 0,
    data_source data_provenance DEFAULT 'real' NOT NULL,
    is_simulation BOOLEAN DEFAULT FALSE NOT NULL,
    started_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_missions_status ON public.missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_user ON public.missions(user_id);
CREATE INDEX IF NOT EXISTS idx_missions_vehicle ON public.missions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_missions_created ON public.missions(created_at DESC);

-- 7. ROUTES TABLE
CREATE TABLE IF NOT EXISTS public.routes (
    id TEXT PRIMARY KEY,
    mission_id TEXT REFERENCES public.missions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    summary TEXT,
    distance_km DOUBLE PRECISION NOT NULL,
    base_eta_minutes DOUBLE PRECISION NOT NULL,
    adjusted_eta_minutes DOUBLE PRECISION NOT NULL,
    risk_score INTEGER DEFAULT 20 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level TEXT DEFAULT 'LOW' NOT NULL,
    coordinates_json JSONB NOT NULL,
    provider TEXT DEFAULT 'osrm',
    provider_metadata JSONB,
    is_active BOOLEAN DEFAULT FALSE NOT NULL,
    is_simulation BOOLEAN DEFAULT FALSE NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_routes_mission ON public.routes(mission_id);
CREATE INDEX IF NOT EXISTS idx_routes_active ON public.routes(is_active);

-- 8. ROUTE HISTORY (Durable Reroute Tracking)
CREATE TABLE IF NOT EXISTS public.route_history (
    id BIGSERIAL PRIMARY KEY,
    mission_id TEXT REFERENCES public.missions(id) ON DELETE CASCADE,
    previous_route_id TEXT,
    new_route_id TEXT,
    reason TEXT NOT NULL,
    trigger_event TEXT,
    old_risk INTEGER,
    new_risk INTEGER,
    vehicle_lat DOUBLE PRECISION,
    vehicle_lng DOUBLE PRECISION,
    is_simulation BOOLEAN DEFAULT FALSE NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_route_history_mission ON public.route_history(mission_id, recorded_at DESC);

-- 9. VEHICLE TELEMETRY STREAM TABLE (Durable Snapshots)
CREATE TABLE IF NOT EXISTS public.telemetry_stream (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id TEXT REFERENCES public.emergency_vehicles(id) ON DELETE CASCADE,
    mission_id TEXT REFERENCES public.missions(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    source TEXT DEFAULT 'gps',
    is_simulation BOOLEAN DEFAULT FALSE NOT NULL,
    metadata JSONB,
    recorded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_mission ON public.telemetry_stream(mission_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle ON public.telemetry_stream(vehicle_id, recorded_at DESC);

-- 10. HAZARDS & CITIZEN REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.hazard_reports (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity hazard_severity DEFAULT 'high' NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_name TEXT,
    reported_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reporter_name TEXT DEFAULT 'Citizen Reporter',
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    affected_route_ids TEXT[],
    data_source data_provenance DEFAULT 'real' NOT NULL,
    is_simulation BOOLEAN DEFAULT FALSE NOT NULL,
    reported_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hazards_coords ON public.hazard_reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_hazards_severity ON public.hazard_reports(severity);
CREATE INDEX IF NOT EXISTS idx_hazards_reported ON public.hazard_reports(reported_at DESC);

-- 11. RISK EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.risk_events (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT,
    event_type TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius DOUBLE PRECISION DEFAULT 100.0,
    road_segment_id TEXT REFERENCES public.road_segments(id) ON DELETE SET NULL,
    severity TEXT DEFAULT 'high',
    speed_before DOUBLE PRECISION,
    speed_after DOUBLE PRECISION,
    source_type TEXT DEFAULT 'real',
    is_simulation BOOLEAN DEFAULT FALSE NOT NULL,
    metadata JSONB,
    occurred_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_events_segment ON public.risk_events(road_segment_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_coords ON public.risk_events(latitude, longitude);

-- 12. RISK SCORES TABLE
CREATE TABLE IF NOT EXISTS public.risk_scores (
    id TEXT PRIMARY KEY,
    route_id TEXT,
    road_segment_id TEXT REFERENCES public.road_segments(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    model_version TEXT DEFAULT 'v1.0-deterministic',
    factors JSONB,
    source TEXT DEFAULT 'deterministic',
    explanation TEXT,
    is_simulation BOOLEAN DEFAULT FALSE NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_segment ON public.risk_scores(road_segment_id);

-- 13. SIMULATION SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.simulation_sessions (
    id TEXT PRIMARY KEY,
    mission_id TEXT REFERENCES public.missions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    scenario_title TEXT NOT NULL,
    incident_type TEXT NOT NULL,
    injected_events_count INTEGER DEFAULT 0 NOT NULL,
    hazards_count INTEGER DEFAULT 0 NOT NULL,
    weather_condition TEXT DEFAULT 'clear',
    traffic_density_multiplier DOUBLE PRECISION DEFAULT 1.0,
    configuration JSONB,
    state TEXT DEFAULT 'active',
    data_source data_provenance DEFAULT 'simulation' NOT NULL,
    is_simulation BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_simulation_user ON public.simulation_sessions(user_id);

-- 14. SYSTEM AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- 15. NOTIFICATIONS TABLE (Emergency & System Events)
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    mission_id TEXT REFERENCES public.missions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'CRITICAL_HAZARD', 'ROUTE_REROUTED', 'MISSION_STATUS', 'SYSTEM_ALERT'
    severity TEXT DEFAULT 'normal' NOT NULL, -- 'critical', 'high', 'normal'
    payload JSONB,
    read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_mission ON public.notifications(mission_id);

-- 16. DEVICE TOKENS TABLE (FCM Registration Tokens)
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    platform TEXT DEFAULT 'web' NOT NULL,
    browser_identifier TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id, active);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON public.device_tokens(token);

-- ==============================================================================
-- REALTIME PUBLICATION CONFIGURATION
-- ==============================================================================

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.missions;
EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_vehicles;
EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hazard_reports;
EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.telemetry_stream;
EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_object THEN null; END $$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_stream ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- 2. Hospitals Policies (Public Read, Admin Write)
CREATE POLICY "Hospitals viewable by everyone"
    ON public.hospitals FOR SELECT
    TO authenticated, anon
    USING (is_active = true);

CREATE POLICY "Only admins manage hospitals"
    ON public.hospitals FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Emergency Vehicles Policies
CREATE POLICY "Vehicles viewable by authenticated users"
    ON public.emergency_vehicles FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Authorized operators manage vehicle state"
    ON public.emergency_vehicles FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('operator', 'dispatcher', 'medic', 'admin')));

-- 4. Road Segments Policies (Public Read)
CREATE POLICY "Road segments viewable by everyone"
    ON public.road_segments FOR SELECT
    TO authenticated, anon
    USING (true);

-- 5. Missions Policies
CREATE POLICY "Users view authorized missions"
    ON public.missions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dispatcher', 'admin')));

CREATE POLICY "Operators create missions"
    ON public.missions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Operators update own or dispatched missions"
    ON public.missions FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dispatcher', 'admin')));

-- 6. Routes Policies
CREATE POLICY "Routes viewable by mission stakeholders"
    ON public.routes FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Operators manage mission routes"
    ON public.routes FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.missions m
        WHERE m.id = routes.mission_id
        AND (m.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('dispatcher', 'admin')))
    ));

-- 7. Route History Policies
CREATE POLICY "Route history viewable by authorized users"
    ON public.route_history FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.missions m
        WHERE m.id = route_history.mission_id
        AND (m.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('dispatcher', 'admin')))
    ));

CREATE POLICY "System inserts route history"
    ON public.route_history FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 8. Telemetry Stream Policies
CREATE POLICY "Telemetry stream viewable by mission stakeholders"
    ON public.telemetry_stream FOR SELECT
    TO authenticated
    USING (
        mission_id IS NULL OR EXISTS (
            SELECT 1 FROM public.missions m
            WHERE m.id = telemetry_stream.mission_id
            AND (m.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('operator', 'dispatcher', 'medic', 'admin')))
        )
    );

CREATE POLICY "Authorized vehicles insert telemetry"
    ON public.telemetry_stream FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 9. Hazard Reports Policies
CREATE POLICY "Anyone can view hazards"
    ON public.hazard_reports FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Authenticated users submit hazards"
    ON public.hazard_reports FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

CREATE POLICY "Dispatchers and admins verify or update hazards"
    ON public.hazard_reports FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dispatcher', 'admin')));

-- 10. Risk Events & Scores Policies
CREATE POLICY "Risk events viewable by authenticated users"
    ON public.risk_events FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Risk scores viewable by authenticated users"
    ON public.risk_scores FOR SELECT
    TO authenticated, anon
    USING (true);

-- 11. Simulation Sessions Policies (Isolated per User)
CREATE POLICY "Users access their own simulation sessions"
    ON public.simulation_sessions FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- 12. System Audit Logs Policies (Admins only)
CREATE POLICY "Admins view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 13. Notifications Policies (Owner only)
CREATE POLICY "Users view their own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users update their own notifications"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- 14. Device Tokens Policies (Owner only)
CREATE POLICY "Users manage their own device tokens"
    ON public.device_tokens FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
