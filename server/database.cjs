// SQLite Database Layer for RoadRisk AI using Node.js Native SQLite
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'roadrisk.db');
const db = new DatabaseSync(dbPath);

// Initialize Tables
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      full_name TEXT,
      agency TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emergency_vehicles (
      id TEXT PRIMARY KEY,
      callsign TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'AVAILABLE',
      lat REAL,
      lng REAL,
      heading REAL DEFAULT 0,
      speed_kmh REAL DEFAULT 0,
      max_speed_kmh REAL DEFAULT 120,
      weight_tons REAL DEFAULT 3.5,
      width_meters REAL DEFAULT 2.1,
      data_source TEXT DEFAULT 'real'
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'trauma_center',
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      phone TEXT,
      trauma_level TEXT DEFAULT 'Level-1',
      bed_capacity_status TEXT DEFAULT 'Unknown',
      is_active INTEGER DEFAULT 1,
      data_source TEXT DEFAULT 'real',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS road_segments (
      id TEXT PRIMARY KEY,
      road_name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      risk_score INTEGER DEFAULT 20,
      risk_level TEXT DEFAULT 'LOW',
      hard_braking_events INTEGER DEFAULT 0,
      sudden_swerving_events INTEGER DEFAULT 0,
      abnormal_slowdown_events INTEGER DEFAULT 0,
      traffic_level REAL DEFAULT 0.2,
      accident_reports INTEGER DEFAULT 0,
      flooding_level REAL DEFAULT 0.0,
      road_blockage INTEGER DEFAULT 0,
      speed_limit_kmh INTEGER DEFAULT 60,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      vehicle_id TEXT,
      origin_name TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lng REAL NOT NULL,
      destination_name TEXT NOT NULL,
      destination_lat REAL NOT NULL,
      destination_lng REAL NOT NULL,
      selected_route_id TEXT,
      status TEXT DEFAULT 'STANDBY',
      distance_km REAL DEFAULT 0,
      eta_minutes REAL DEFAULT 0,
      time_saved_minutes REAL DEFAULT 0,
      risk_avoided_points INTEGER DEFAULT 0,
      reroute_count INTEGER DEFAULT 0,
      data_source TEXT DEFAULT 'real',
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS risk_events (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT,
      event_type TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      road_segment_id TEXT,
      severity TEXT DEFAULT 'high',
      speed_before REAL,
      speed_after REAL,
      source_type TEXT DEFAULT 'real',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS risk_scores (
      id TEXT PRIMARY KEY,
      road_segment_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      explanation TEXT,
      calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      summary TEXT,
      distance_km REAL NOT NULL,
      base_eta_minutes REAL NOT NULL,
      adjusted_eta_minutes REAL NOT NULL,
      risk_score INTEGER DEFAULT 20,
      risk_level TEXT DEFAULT 'LOW',
      coordinates_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hazard_reports (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT DEFAULT 'high',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      location_name TEXT,
      reported_by TEXT,
      reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      verified INTEGER DEFAULT 1,
      data_source TEXT DEFAULT 'real'
    );

    CREATE TABLE IF NOT EXISTS simulation_sessions (
      id TEXT PRIMARY KEY,
      scenario_title TEXT DEFAULT 'Standard Trauma Transport',
      incident_type TEXT DEFAULT 'CONGESTION',
      active_events_count INTEGER DEFAULT 0,
      hazards_count INTEGER DEFAULT 0,
      weather_state TEXT DEFAULT 'clear',
      data_source TEXT DEFAULT 'simulation',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      user_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS device_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      fcm_token TEXT UNIQUE NOT NULL,
      device_type TEXT DEFAULT 'web',
      platform TEXT,
      user_agent TEXT,
      is_active INTEGER DEFAULT 1,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      severity TEXT DEFAULT 'HIGH',
      mission_id TEXT,
      event_type TEXT,
      event_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS route_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      reroute_sequence INTEGER NOT NULL,
      trigger_reason TEXT,
      start_lat REAL NOT NULL,
      start_lng REAL NOT NULL,
      distance_meters REAL NOT NULL,
      duration_seconds REAL NOT NULL,
      risk_score REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS telemetry_stream (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id TEXT NOT NULL,
      mission_id TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed_kmh REAL NOT NULL,
      heading REAL NOT NULL,
      recorded_at DATETIME NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_road_segments_coords ON road_segments(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_hazard_reports_coords ON hazard_reports(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
    CREATE INDEX IF NOT EXISTS idx_risk_events_segment ON risk_events(road_segment_id);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_mission ON notifications(mission_id);
  `);
  // Safe schema migrations for pre-existing tables
  try { db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE emergency_vehicles ADD COLUMN data_source TEXT DEFAULT 'real'"); } catch {}
  try { db.exec("ALTER TABLE hazard_reports ADD COLUMN data_source TEXT DEFAULT 'real'"); } catch {}

  seedInitialData();
}

function seedInitialData() {
  // 1. Seed Road Segments
  const countRow = db.prepare('SELECT COUNT(*) as count FROM road_segments').get();
  if (!countRow || countRow.count === 0) {
    const insertRoad = db.prepare(`
      INSERT INTO road_segments (id, road_name, latitude, longitude, risk_score, risk_level, hard_braking_events, sudden_swerving_events, traffic_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialRoads = [
      ['seg_101', 'MG Road Central Arterial', 17.385, 78.486, 78, 'HIGH', 18, 9, 0.65],
      ['seg_102', 'Abids GPO Commercial Corridor', 17.396, 78.474, 86, 'CRITICAL', 34, 12, 0.85],
      ['seg_103', 'Khairatabad Flyover Approach', 17.419, 78.461, 72, 'HIGH', 15, 6, 0.55],
      ['seg_104', 'PVNR Elevated Smart Corridor', 17.375, 78.442, 22, 'LOW', 2, 1, 0.25],
      ['seg_105', 'Outer Expressway Perimeter Sector', 17.435, 78.405, 18, 'LOW', 0, 0, 0.15],
      ['seg_106', 'Somajiguda Medical Link', 17.426, 78.455, 35, 'MODERATE', 5, 2, 0.4],
      ['seg_vijayawada_nh16_01', 'Benz Circle to GGH Arterial NH16', 16.506, 80.648, 65, 'MODERATE', 12, 4, 0.55],
    ];

    for (const r of initialRoads) {
      insertRoad.run(...r);
    }
  }

  // 2. Seed Emergency Vehicles
  const vehicleCountRow = db.prepare('SELECT COUNT(*) as count FROM emergency_vehicles').get();
  if (!vehicleCountRow || vehicleCountRow.count === 0) {
    const insertVehicle = db.prepare(`
      INSERT INTO emergency_vehicles (id, callsign, type, category, status, lat, lng, max_speed_kmh, weight_tons, width_meters, data_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialVehicles = [
      ['amb_bravo_02', 'MEDIC-02', 'Type-3 MICU Cardiac Ambulance', 'medical', 'AVAILABLE', 17.3785, 78.4795, 130, 4.2, 2.3, 'real'],
      ['amb_delta_05', 'AMB-DELTA', 'Bariatric Heavy Response', 'medical', 'AVAILABLE', 17.3616, 78.4747, 115, 5.8, 2.5, 'real'],
      ['rescue_tender_01', 'RESCUE-01', 'Rapid Heavy Extrication Fire Tender', 'fire_rescue', 'AVAILABLE', 17.4504, 78.3808, 105, 18.5, 2.8, 'real'],
    ];

    for (const v of initialVehicles) {
      insertVehicle.run(...v);
    }
  }

  // 3. Seed Verified Hospitals
  const hospCountRow = db.prepare('SELECT COUNT(*) as count FROM hospitals').get();
  if (!hospCountRow || hospCountRow.count === 0) {
    const insertHosp = db.prepare(`
      INSERT INTO hospitals (id, name, category, address, latitude, longitude, phone, trauma_level, bed_capacity_status, data_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialHospitals = [
      ['hosp_apex', 'Apex Emergency Trauma Care Center', 'trauma_center', 'Banjara Hills Main Rd, Hyderabad', 17.4156, 78.4483, '+91-40-2339-9999', 'Level-1', 'Unknown', 'real'],
      ['hosp_osmania', 'Osmania General Hospital Trauma Unit', 'general_hospital', 'Afzal Gunj, Hyderabad', 17.3792, 78.4792, '+91-40-2460-0121', 'Level-1 Tertiary', 'Unknown', 'real'],
      ['hosp_nims', 'Nizam Institute of Medical Sciences (NIMS)', 'super_specialty', 'Punjagutta, Hyderabad', 17.4222, 78.4526, '+91-40-2348-9000', 'Level-1 Academic', 'Unknown', 'real'],
      ['hosp_apollo', 'Apollo Health City Emergency', 'super_specialty', 'Jubilee Hills, Hyderabad', 17.4172, 78.4116, '+91-40-2360-7777', 'Level-1 Comprehensive', 'Unknown', 'real'],
      ['hosp_yashoda', 'Yashoda Hospitals Emergency Wing', 'trauma_center', 'Somajiguda, Hyderabad', 17.4261, 78.4552, '+91-40-4567-4567', 'Level-2 Advanced', 'Unknown', 'real'],
    ];

    for (const h of initialHospitals) {
      insertHosp.run(...h);
    }
  }

  // 4. Seed Default Users
  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (!userCountRow || userCountRow.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, full_name, agency)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Pre-seeded local dev operator (password: operator123)
    insertUser.run('usr_operator_01', 'operator', 'sha256$5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'operator', 'Field Dispatch Operator', 'Emergency Medical Services');
    insertUser.run('usr_admin_01', 'admin', 'sha256$8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'admin', 'System Administrator', 'RoadRisk Command');
  }
}

initDatabase();

module.exports = { db };
