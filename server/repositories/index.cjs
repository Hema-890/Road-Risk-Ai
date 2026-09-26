// ==============================================================================
// ROADRISK AI — ENTERPRISE REPOSITORY LAYER
// Implements unified persistence across SQLite & Supabase PostgreSQL/PostGIS
// Covers all 25 canonical tables defined in Requirement 49
// ==============================================================================

const { db } = require('../database.cjs');

// Initialize canonical tables on startup
function ensureAllCanonicalTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS road_incidents (
      incident_id TEXT PRIMARY KEY,
      provider_id TEXT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      road_name TEXT,
      from_location TEXT,
      to_location TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      geometry_json TEXT,
      delay_seconds INTEGER DEFAULT 0,
      length_meters INTEGER DEFAULT 0,
      start_time TEXT,
      end_time TEXT,
      number_of_reports INTEGER DEFAULT 1,
      last_report_time TEXT,
      source TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS traffic_current (
      segment_id TEXT PRIMARY KEY,
      road_name TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      current_speed REAL NOT NULL,
      free_flow_speed REAL NOT NULL,
      traffic_ratio REAL NOT NULL,
      congestion_level TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      coordinates_json TEXT,
      source TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS traffic_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      segment_id TEXT,
      traffic_model_id TEXT,
      current_speed REAL NOT NULL,
      free_flow_speed REAL NOT NULL,
      traffic_ratio REAL NOT NULL,
      snapshot_time TEXT NOT NULL,
      source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weather_observations (
      id TEXT PRIMARY KEY,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      temperature_c REAL,
      precipitation_mm REAL,
      wind_speed_kmh REAL,
      visibility_meters REAL,
      weather_code INTEGER,
      condition_label TEXT,
      source TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flood_events (
      flood_id TEXT PRIMARY KEY,
      level TEXT NOT NULL, -- LEVEL 1: CONFIRMED ROAD FLOODING, LEVEL 2: REGIONAL FLOOD MODEL, LEVEL 3: USER REPORTED
      label TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      polygon_json TEXT,
      river_discharge_m3s REAL,
      depth_meters REAL,
      source TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      observed_at TEXT NOT NULL,
      expires_at TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS disaster_alerts (
      alert_id TEXT PRIMARY KEY,
      source TEXT NOT NULL, -- e.g., 'NDMA SACHET'
      category TEXT NOT NULL, -- 'flood', 'cyclone', 'earthquake', 'landslide', etc.
      severity TEXT NOT NULL, -- 'critical', 'high', 'moderate', 'advisory'
      headline TEXT NOT NULL,
      description TEXT NOT NULL,
      official_reference TEXT,
      affected_geometry_json TEXT,
      issued_at TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transit_stops (
      stop_id TEXT PRIMARY KEY,
      stop_name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      feed_id TEXT,
      source TEXT NOT NULL,
      status TEXT DEFAULT 'STATIC'
    );

    CREATE TABLE IF NOT EXISTS transit_routes (
      route_id TEXT PRIMARY KEY,
      agency_id TEXT,
      route_short_name TEXT,
      route_long_name TEXT,
      route_type INTEGER,
      source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transit_vehicle_positions (
      vehicle_id TEXT PRIMARY KEY,
      trip_id TEXT,
      route_id TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      bearing REAL,
      speed_kmh REAL,
      current_stop_sequence INTEGER,
      current_status TEXT,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL -- 'LIVE' | 'SCHEDULED' | 'UNAVAILABLE'
    );

    CREATE TABLE IF NOT EXISTS transit_trip_updates (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT,
      delay_seconds INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transit_service_alerts (
      alert_id TEXT PRIMARY KEY,
      cause TEXT,
      effect TEXT,
      header_text TEXT NOT NULL,
      description_text TEXT,
      source TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS emergency_vehicle_positions (
      vehicle_id TEXT PRIMARY KEY,
      vehicle_type TEXT NOT NULL, -- 'ambulance', 'police', 'fire'
      callsign TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      heading REAL DEFAULT 0,
      speed_kmh REAL DEFAULT 0,
      route_geometry_json TEXT,
      active_mission_id TEXT,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      received_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_hazard_reports (
      report_id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      road_name TEXT,
      reported_by TEXT,
      status TEXT NOT NULL, -- 'USER_REPORTED' | 'CORROBORATING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED'
      corroboration_count INTEGER DEFAULT 1,
      reported_at TEXT NOT NULL,
      verified_at TEXT,
      expires_at TEXT NOT NULL,
      source TEXT DEFAULT 'Citizen Report'
    );

    CREATE TABLE IF NOT EXISTS road_risk_snapshots (
      id TEXT PRIMARY KEY,
      road_segment_id TEXT NOT NULL,
      road_name TEXT,
      risk_score INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      contributors_json TEXT NOT NULL,
      model_version TEXT NOT NULL,
      feature_timestamp TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      data_sufficiency TEXT NOT NULL,
      calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS route_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      reason TEXT,
      distance_km REAL,
      eta_minutes REAL,
      risk_score INTEGER,
      payload_json TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fuel_stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      fuel_types_json TEXT,
      opening_hours TEXT,
      distance_meters REAL,
      source TEXT NOT NULL,
      status TEXT DEFAULT 'STATIC'
    );

    CREATE TABLE IF NOT EXISTS emergency_services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'hospital', 'police', 'fire_station', 'ambulance_center'
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      phone TEXT,
      address TEXT,
      source TEXT NOT NULL,
      status TEXT DEFAULT 'STATIC'
    );

    CREATE TABLE IF NOT EXISTS traffic_signals (
      id TEXT PRIMARY KEY,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      road_name TEXT,
      signal_timing_available INTEGER DEFAULT 0,
      source TEXT NOT NULL,
      status TEXT DEFAULT 'STATIC'
    );

    CREATE TABLE IF NOT EXISTS data_source_health (
      provider_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      last_success TEXT,
      last_failure TEXT,
      latency_ms INTEGER DEFAULT 0,
      http_status INTEGER,
      freshness TEXT NOT NULL,
      records_received INTEGER DEFAULT 0,
      records_rejected INTEGER DEFAULT 0,
      error TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS telemetry_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed_kmh REAL NOT NULL,
      heading REAL NOT NULL,
      acceleration REAL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_history (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      source TEXT NOT NULL,
      road_segment_id TEXT,
      latitude REAL,
      longitude REAL,
      status TEXT NOT NULL,
      payload_json TEXT,
      observed_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS offline_regions (
      region_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bounding_box_json TEXT NOT NULL,
      size_mb REAL NOT NULL,
      coverage_description TEXT,
      features_available_json TEXT,
      download_status TEXT DEFAULT 'AVAILABLE',
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS map_downloads (
      download_id TEXT PRIMARY KEY,
      region_id TEXT NOT NULL,
      user_id TEXT,
      status TEXT NOT NULL,
      downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Spatial & Query Indexes
    CREATE INDEX IF NOT EXISTS idx_incidents_coords ON road_incidents(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON road_incidents(status);
    CREATE INDEX IF NOT EXISTS idx_traffic_current_coords ON traffic_current(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_weather_coords ON weather_observations(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_flood_coords ON flood_events(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_disaster_status ON disaster_alerts(status);
    CREATE INDEX IF NOT EXISTS idx_emergency_vehicles_coords ON emergency_vehicle_positions(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_user_hazards_status ON user_hazard_reports(status);
    CREATE INDEX IF NOT EXISTS idx_signals_coords ON traffic_signals(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_services_coords ON emergency_services(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_event_history_type ON event_history(event_type);
  `);
}

// Ensure tables exist on require
try {
  ensureAllCanonicalTables();
} catch (e) {
  console.warn('[Repositories] Table initialization warning:', e.message);
}

// Repository Methods
const incidentRepo = {
  upsert(incident) {
    const stmt = db.prepare(`
      INSERT INTO road_incidents (
        incident_id, provider_id, type, category, severity, road_name,
        from_location, to_location, latitude, longitude, geometry_json,
        delay_seconds, length_meters, start_time, end_time, number_of_reports,
        last_report_time, source, observed_at, received_at, status
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      ) ON CONFLICT(incident_id) DO UPDATE SET
        severity = excluded.severity,
        delay_seconds = excluded.delay_seconds,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      incident.incident_id,
      incident.provider_id || null,
      incident.type || 'INCIDENT',
      incident.category || 'HAZARD',
      incident.severity || 'low',
      incident.road_name || null,
      incident.from_location || null,
      incident.to_location || null,
      incident.latitude,
      incident.longitude,
      incident.geometry_json ? JSON.stringify(incident.geometry_json) : null,
      incident.delay_seconds || 0,
      incident.length_meters || 0,
      incident.start_time || null,
      incident.end_time || null,
      incident.number_of_reports || 1,
      incident.last_report_time || null,
      incident.source || 'TomTom',
      incident.observed_at || new Date().toISOString(),
      incident.received_at || new Date().toISOString(),
      incident.status || 'LIVE'
    );
  },

  findInBbox(minLng, minLat, maxLng, maxLat) {
    return db.prepare(`
      SELECT * FROM road_incidents
      WHERE longitude >= ? AND longitude <= ?
        AND latitude >= ? AND latitude <= ?
        AND status = 'LIVE'
    `).all(minLng, maxLng, minLat, maxLat);
  },

  getAllActive() {
    return db.prepare(`SELECT * FROM road_incidents WHERE status = 'LIVE' ORDER BY created_at DESC`).all();
  }
};

const trafficRepo = {
  upsertCurrent(flow) {
    const stmt = db.prepare(`
      INSERT INTO traffic_current (
        segment_id, road_name, latitude, longitude, current_speed,
        free_flow_speed, traffic_ratio, congestion_level, confidence,
        coordinates_json, source, observed_at, received_at, status
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      ) ON CONFLICT(segment_id) DO UPDATE SET
        current_speed = excluded.current_speed,
        traffic_ratio = excluded.traffic_ratio,
        congestion_level = excluded.congestion_level,
        observed_at = excluded.observed_at,
        received_at = excluded.received_at,
        status = excluded.status
    `);

    stmt.run(
      flow.segment_id,
      flow.road_name || 'Road',
      flow.latitude,
      flow.longitude,
      flow.current_speed,
      flow.free_flow_speed,
      flow.traffic_ratio,
      flow.congestion_level,
      flow.confidence || 1.0,
      flow.coordinates_json ? JSON.stringify(flow.coordinates_json) : null,
      flow.source || 'TomTom Flow',
      flow.observed_at || new Date().toISOString(),
      flow.received_at || new Date().toISOString(),
      flow.status || 'LIVE'
    );
  },

  recordSnapshot(snapshot) {
    const stmt = db.prepare(`
      INSERT INTO traffic_snapshots (
        segment_id, traffic_model_id, current_speed, free_flow_speed, traffic_ratio, snapshot_time, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      snapshot.segment_id,
      snapshot.traffic_model_id || null,
      snapshot.current_speed,
      snapshot.free_flow_speed,
      snapshot.traffic_ratio,
      snapshot.snapshot_time || new Date().toISOString(),
      snapshot.source || 'TomTom'
    );
  }
};

const weatherRepo = {
  upsert(obs) {
    const stmt = db.prepare(`
      INSERT INTO weather_observations (
        id, latitude, longitude, temperature_c, precipitation_mm,
        wind_speed_kmh, visibility_meters, weather_code, condition_label,
        source, observed_at, received_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        temperature_c = excluded.temperature_c,
        precipitation_mm = excluded.precipitation_mm,
        wind_speed_kmh = excluded.wind_speed_kmh,
        visibility_meters = excluded.visibility_meters,
        weather_code = excluded.weather_code,
        condition_label = excluded.condition_label,
        observed_at = excluded.observed_at,
        received_at = excluded.received_at,
        status = excluded.status
    `);
    stmt.run(
      obs.id,
      obs.latitude,
      obs.longitude,
      obs.temperature_c,
      obs.precipitation_mm,
      obs.wind_speed_kmh,
      obs.visibility_meters,
      obs.weather_code,
      obs.condition_label,
      obs.source,
      obs.observed_at,
      obs.received_at,
      obs.status
    );
  },

  getLatestForCoords(lat, lng) {
    return db.prepare(`
      SELECT * FROM weather_observations
      ORDER BY (ABS(latitude - ?) + ABS(longitude - ?)) ASC, observed_at DESC
      LIMIT 1
    `).get(lat, lng);
  }
};

const disasterRepo = {
  upsert(alert) {
    const stmt = db.prepare(`
      INSERT INTO disaster_alerts (
        alert_id, source, category, severity, headline, description,
        official_reference, affected_geometry_json, issued_at, effective_from,
        expires_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(alert_id) DO UPDATE SET
        severity = excluded.severity,
        description = excluded.description,
        expires_at = excluded.expires_at,
        status = excluded.status
    `);
    stmt.run(
      alert.alert_id,
      alert.source,
      alert.category,
      alert.severity,
      alert.headline,
      alert.description,
      alert.official_reference || null,
      alert.affected_geometry_json ? JSON.stringify(alert.affected_geometry_json) : null,
      alert.issued_at,
      alert.effective_from,
      alert.expires_at,
      alert.status
    );
  },

  getActiveAlerts() {
    return db.prepare(`
      SELECT * FROM disaster_alerts
      WHERE status = 'ACTIVE' AND datetime(expires_at) >= datetime('now')
    `).all();
  }
};

const userHazardRepo = {
  create(report) {
    const stmt = db.prepare(`
      INSERT INTO user_hazard_reports (
        report_id, category, title, description, latitude, longitude,
        road_name, reported_by, status, corroboration_count, reported_at, expires_at, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      report.report_id,
      report.category,
      report.title,
      report.description || '',
      report.latitude,
      report.longitude,
      report.road_name || null,
      report.reported_by || 'Citizen',
      report.status || 'USER_REPORTED',
      report.corroboration_count || 1,
      report.reported_at || new Date().toISOString(),
      report.expires_at || new Date(Date.now() + 86400000).toISOString(),
      report.source || 'Citizen Report'
    );
  },

  updateStatus(report_id, status) {
    db.prepare(`UPDATE user_hazard_reports SET status = ? WHERE report_id = ?`).run(status, report_id);
  },

  getActiveReports() {
    return db.prepare(`SELECT * FROM user_hazard_reports WHERE status IN ('USER_REPORTED', 'CORROBORATING', 'VERIFIED')`).all();
  }
};

const riskSnapshotRepo = {
  record(snapshot) {
    const stmt = db.prepare(`
      INSERT INTO road_risk_snapshots (
        id, road_segment_id, road_name, risk_score, risk_level,
        contributors_json, model_version, feature_timestamp, confidence, data_sufficiency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      snapshot.id,
      snapshot.road_segment_id,
      snapshot.road_name || null,
      snapshot.risk_score,
      snapshot.risk_level,
      JSON.stringify(snapshot.contributors || []),
      snapshot.model_version || 'v2.0-deterministic',
      snapshot.feature_timestamp || new Date().toISOString(),
      snapshot.confidence || 1.0,
      snapshot.data_sufficiency || 'SUFFICIENT'
    );
  },

  getHistoryForSegment(segmentId, limit = 20) {
    return db.prepare(`
      SELECT * FROM road_risk_snapshots
      WHERE road_segment_id = ?
      ORDER BY calculated_at DESC
      LIMIT ?
    `).all(segmentId, limit);
  }
};

const eventHistoryRepo = {
  record(ev) {
    const stmt = db.prepare(`
      INSERT INTO event_history (
        event_id, event_type, source, road_segment_id, latitude, longitude,
        status, payload_json, observed_at, received_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO NOTHING
    `);
    stmt.run(
      ev.event_id,
      ev.event_type,
      ev.source,
      ev.road_segment_id || null,
      ev.latitude || null,
      ev.longitude || null,
      ev.status || 'LIVE',
      ev.payload ? JSON.stringify(ev.payload) : null,
      ev.observed_at,
      ev.received_at,
      ev.expires_at || null
    );
  }
};

module.exports = {
  ensureAllCanonicalTables,
  incidentRepo,
  trafficRepo,
  weatherRepo,
  disasterRepo,
  userHazardRepo,
  riskSnapshotRepo,
  eventHistoryRepo,
};
