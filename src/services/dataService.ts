/**
 * RoadRisk AI - Enterprise Data Service (Dual-Mode: Cloud / Local / Auto)
 * Cloud: Supabase PostgreSQL (Source of Truth)
 * Local: Native SQLite Backend (Source of Truth)
 * Auto: Cloud if configured, otherwise Local Development
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { apiService, HospitalRecord } from './apiService';
import type { Database } from '../types/database.types';

export type DataMode = 'cloud' | 'local' | 'auto';

export interface MissionRecord {
  id: string;
  vehicle_id?: string;
  status: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  selected_route_id?: string;
  distance_km?: number;
  eta_minutes?: number;
  time_saved_minutes?: number;
  risk_avoided_points?: number;
  is_simulation?: boolean;
  created_at?: string;
  completed_at?: string;
}

export interface HazardReportRecord {
  id?: string;
  category: string;
  title: string;
  description?: string;
  severity: string;
  latitude: number;
  longitude: number;
  location_name?: string;
  reported_by?: string;
  is_simulation?: boolean;
  is_active?: boolean;
  created_at?: string;
}

class DataService {
  private configuredMode: DataMode;

  constructor() {
    const rawMode = (import.meta as any).env?.VITE_DATA_MODE?.toLowerCase();
    if (rawMode === 'cloud' || rawMode === 'local') {
      this.configuredMode = rawMode;
    } else {
      this.configuredMode = 'auto';
    }
  }

  /**
   * Resolves the active operational mode
   */
  public getActiveMode(): 'cloud' | 'local' {
    if (this.configuredMode === 'cloud') {
      if (!isSupabaseConfigured()) {
        throw new Error(
          '[DataService] Fatal: Application configured in CLOUD mode (VITE_DATA_MODE=cloud), ' +
          'but VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or invalid.'
        );
      }
      return 'cloud';
    }
    if (this.configuredMode === 'local') {
      return 'local';
    }
    // 'auto' mode
    return isSupabaseConfigured() ? 'cloud' : 'local';
  }

  public getConfiguredMode(): DataMode {
    return this.configuredMode;
  }

  // 1. Fetch Verified Hospitals
  public async getHospitals(): Promise<HospitalRecord[]> {
    const mode = this.getActiveMode();

    if (mode === 'cloud' && supabase) {
      const { data, error } = await (supabase.from('hospitals') as any)
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('[DataService:Cloud] Failed to query hospitals:', error);
        throw error;
      }
      return (data || []).map((h: any) => ({
        id: h.id,
        name: h.name,
        category: h.category,
        address: h.address,
        latitude: h.latitude,
        longitude: h.longitude,
        phone: h.phone || undefined,
        trauma_level: h.trauma_level,
        bed_capacity_status: h.bed_capacity_status,
        data_source: h.is_simulation ? 'simulation' : 'real',
      }));
    }

    // Local mode (SQLite backend)
    return apiService.getHospitals();
  }

  // 2. Create Mission
  public async createMission(mission: {
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
    is_simulation?: boolean;
  }): Promise<{ id: string; status: string } | null> {
    const mode = this.getActiveMode();

    if (mode === 'cloud' && supabase) {
      const insertPayload: any = {
        origin_name: mission.origin_name,
        origin_lat: mission.origin_lat,
        origin_lng: mission.origin_lng,
        destination_name: mission.destination_name,
        destination_lat: mission.destination_lat,
        destination_lng: mission.destination_lng,
        status: 'EN_ROUTE',
        distance_km: mission.distance_km,
        eta_minutes: mission.eta_minutes,
        vehicle_id: mission.vehicle_id,
        is_simulation: mission.is_simulation ?? true,
      };

      const { data, error } = await (supabase.from('missions') as any)
        .insert(insertPayload)
        .select('id, status')
        .single();

      if (error) {
        console.error('[DataService:Cloud] Failed to create mission:', error);
        throw error;
      }
      return data;
    }

    // Local SQLite fallback
    return apiService.createMission({
      origin_name: mission.origin_name,
      origin_lat: mission.origin_lat,
      origin_lng: mission.origin_lng,
      destination_name: mission.destination_name,
      destination_lat: mission.destination_lat,
      destination_lng: mission.destination_lng,
      selected_route_id: mission.selected_route_id,
      distance_km: mission.distance_km,
      eta_minutes: mission.eta_minutes,
      vehicle_id: mission.vehicle_id,
      data_source: mission.is_simulation ? 'simulation' : 'real',
    });
  }

  // 3. Update Mission
  public async updateMission(id: string, updates: {
    status?: string;
    time_saved_minutes?: number;
    risk_avoided_points?: number;
    completed_at?: string;
  }): Promise<boolean> {
    const mode = this.getActiveMode();

    if (mode === 'cloud' && supabase) {
      const { error } = await (supabase.from('missions') as any)
        .update({
          status: updates.status,
          time_saved_minutes: updates.time_saved_minutes,
          risk_avoided_points: updates.risk_avoided_points,
          completed_at: updates.completed_at || (updates.status === 'MISSION_COMPLETE' ? new Date().toISOString() : undefined),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('[DataService:Cloud] Failed to update mission:', error);
        throw error;
      }
      return true;
    }

    return apiService.updateMission(id, updates);
  }

  // 4. Submit Hazard Report
  public async submitHazardReport(hazard: HazardReportRecord): Promise<boolean> {
    const mode = this.getActiveMode();

    if (mode === 'cloud' && supabase) {
      const { error } = await (supabase.from('hazard_reports') as any)
        .insert({
          category: hazard.category,
          title: hazard.title,
          description: hazard.description,
          severity: hazard.severity,
          latitude: hazard.latitude,
          longitude: hazard.longitude,
          location_name: hazard.location_name,
          reported_by: hazard.reported_by,
          is_simulation: hazard.is_simulation ?? true,
          is_active: hazard.is_active ?? true,
        });

      if (error) {
        console.error('[DataService:Cloud] Failed to report hazard:', error);
        throw error;
      }
      return true;
    }

    return apiService.submitHazardReport({
      category: hazard.category,
      title: hazard.title,
      description: hazard.description,
      severity: hazard.severity,
      latitude: hazard.latitude,
      longitude: hazard.longitude,
      location_name: hazard.location_name,
      reported_by: hazard.reported_by,
      data_source: hazard.is_simulation ? 'simulation' : 'real',
    });
  }

  // 5. Query Active Hazards
  public async getActiveHazards(): Promise<HazardReportRecord[]> {
    const mode = this.getActiveMode();

    if (mode === 'cloud' && supabase) {
      const { data, error } = await (supabase.from('hazard_reports') as any)
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DataService:Cloud] Failed to query hazards:', error);
        throw error;
      }
      return data || [];
    }

    // Local fallback: fetch from local backend or mock
    try {
      const res = await fetch('http://localhost:3001/api/hazards');
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return [];
  }

  // 6. Record Route History on dynamic reroute
  public async recordRouteHistory(record: {
    mission_id: string;
    route_id: string;
    reroute_sequence: number;
    trigger_reason: string;
    start_lat: number;
    start_lng: number;
    distance_meters: number;
    duration_seconds: number;
    risk_score: number;
  }): Promise<void> {
    const mode = this.getActiveMode();

    if (mode === 'cloud' && supabase) {
      const { error } = await (supabase.from('route_history') as any)
        .insert({
          mission_id: record.mission_id,
          route_id: record.route_id,
          reroute_sequence: record.reroute_sequence,
          trigger_reason: record.trigger_reason,
          start_lat: record.start_lat,
          start_lng: record.start_lng,
          distance_meters: record.distance_meters,
          duration_seconds: record.duration_seconds,
          risk_score: record.risk_score,
        });

      if (error) {
        console.error('[DataService:Cloud] Failed to record route history:', error);
      }
    } else {
      // Local SQLite / In-memory log
      try {
        await fetch('http://localhost:3001/api/routes/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        });
      } catch {}
    }
  }
}

export const dataService = new DataService();
export default dataService;
