// Type-Safe API Client for RoadRisk AI Backend REST API
// Integrates with local SQLite server (port 3001) or configurable backend URL
const API_BASE_URL = (import.meta as any).env?.VITE_BACKEND_API_URL || 'http://localhost:3001';

export interface SystemHealthReport {
  status: string;
  timestamp: string;
  subsystems: {
    backend: { status: string; port: number };
    database: { status: string; engine: string; tables: Record<string, number> };
    mapProvider: { status: string; engine: string; vectorStyle: string; vectorTilesConfigured: boolean };
    geocoding: { status: string; provider: string };
    routing: { status: string; provider: string };
    liveTraffic: { status: string; liveProviderConfigured: boolean };
    cloudDatabase: { status: string };
    aiAssistant: { status: string };
  };
}

export interface HospitalRecord {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  trauma_level: string;
  bed_capacity_status: string;
  data_source: 'real' | 'simulation';
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // 1. Subsystem Health Diagnostic Check
  async getHealth(): Promise<SystemHealthReport | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // 2. Fetch Verified Hospitals
  async getHospitals(): Promise<HospitalRecord[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/hospitals`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  // 3. Record Mission Lifecycle to Database
  async createMission(mission: {
    origin_name: string;
    origin_lat: number;
    origin_lng: number;
    destination_name: string;
    destination_lat: number;
    destination_lng: number;
    selected_route_id?: string;
    distance_km?: number;
    eta_minutes?: number;
    vehicle_id?: string;
    data_source?: 'real' | 'simulation';
  }): Promise<{ id: string; status: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mission),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // 4. Update Mission Completion & Debrief Metrics
  async updateMission(id: string, updates: {
    status?: string;
    time_saved_minutes?: number;
    risk_avoided_points?: number;
  }): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/missions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // 5. Submit Citizen Hazard Report
  async submitHazardReport(hazard: {
    category: string;
    title: string;
    description?: string;
    severity: string;
    latitude: number;
    longitude: number;
    location_name?: string;
    reported_by?: string;
    data_source?: 'real' | 'simulation';
  }): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/hazards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hazard),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // 6. User Authentication (Local Session + Supabase Fallback)
  async login(username: string, password: string): Promise<{ token: string; user: any } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

export const apiService = new ApiService();
export default apiService;
