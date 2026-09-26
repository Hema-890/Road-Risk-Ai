// Strongly typed Supabase PostgreSQL database types for RoadRisk AI
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'citizen' | 'operator' | 'dispatcher' | 'medic' | 'admin';

export type MissionStatusType =
  | 'STANDBY'
  | 'ASSIGNED'
  | 'ROUTE_SELECTION'
  | 'READY_TO_START'
  | 'EN_ROUTE'
  | 'INCIDENT_DETECTED'
  | 'RISK_RECALCULATING'
  | 'REROUTING'
  | 'REROUTE_SELECTED'
  | 'ROUTE_UPDATED'
  | 'GREEN_CORRIDOR_ACTIVE'
  | 'ARRIVING'
  | 'ARRIVED'
  | 'ON_SCENE'
  | 'TRANSPORTING'
  | 'COMPLETED'
  | 'ABORTED'
  | 'CANCELLED'
  | 'PAUSED';

export type HazardSeverityType = 'low' | 'moderate' | 'high' | 'critical';
export type DataProvenanceType = 'real' | 'operator_entry' | 'sensor_telemetry' | 'simulation';
export type VehicleStatusType =
  | 'AVAILABLE'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'HAZARD_ALERT'
  | 'REROUTING'
  | 'AT_SCENE'
  | 'RETURNING'
  | 'MAINTENANCE'
  | 'OFFLINE';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          email: string | null;
          role: UserRole;
          agency: string | null;
          badge_number: string | null;
          phone_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name?: string | null;
          email?: string | null;
          role?: UserRole;
          agency?: string | null;
          badge_number?: string | null;
          phone_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          full_name?: string | null;
          email?: string | null;
          role?: UserRole;
          agency?: string | null;
          badge_number?: string | null;
          phone_number?: string | null;
          updated_at?: string;
        };
      };
      emergency_vehicles: {
        Row: {
          id: string;
          callsign: string;
          type: string;
          category: string;
          status: VehicleStatusType;
          current_lat: number | null;
          current_lng: number | null;
          current_heading: number;
          speed_kmh: number;
          max_speed_kmh: number;
          weight_tons: number;
          width_meters: number;
          active_mission_id: string | null;
          assigned_agency: string;
          data_source: DataProvenanceType;
          last_telemetry_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          callsign: string;
          type: string;
          category?: string;
          status?: VehicleStatusType;
          current_lat?: number | null;
          current_lng?: number | null;
          current_heading?: number;
          speed_kmh?: number;
          max_speed_kmh?: number;
          weight_tons?: number;
          width_meters?: number;
          active_mission_id?: string | null;
          assigned_agency?: string;
          data_source?: DataProvenanceType;
          last_telemetry_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          callsign?: string;
          type?: string;
          category?: string;
          status?: VehicleStatusType;
          current_lat?: number | null;
          current_lng?: number | null;
          current_heading?: number;
          speed_kmh?: number;
          max_speed_kmh?: number;
          weight_tons?: number;
          width_meters?: number;
          active_mission_id?: string | null;
          assigned_agency?: string;
          data_source?: DataProvenanceType;
          last_telemetry_at?: string | null;
          updated_at?: string;
        };
      };
      hospitals: {
        Row: {
          id: string;
          name: string;
          category: string;
          address: string;
          latitude: number;
          longitude: number;
          phone: string | null;
          emergency_direct_line: string | null;
          trauma_level: string | null;
          verified_capabilities: Json;
          bed_capacity_status: string;
          is_active: boolean;
          data_source: DataProvenanceType;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          category?: string;
          address: string;
          latitude: number;
          longitude: number;
          phone?: string | null;
          emergency_direct_line?: string | null;
          trauma_level?: string | null;
          verified_capabilities?: Json;
          bed_capacity_status?: string;
          is_active?: boolean;
          data_source?: DataProvenanceType;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          category?: string;
          address?: string;
          latitude?: number;
          longitude?: number;
          phone?: string | null;
          emergency_direct_line?: string | null;
          trauma_level?: string | null;
          verified_capabilities?: Json;
          bed_capacity_status?: string;
          is_active?: boolean;
          data_source?: DataProvenanceType;
          updated_at?: string;
        };
      };
      road_segments: {
        Row: {
          id: string;
          road_name: string;
          city_id: string;
          latitude: number;
          longitude: number;
          risk_score: number;
          risk_level: string;
          hard_braking_events: number;
          sudden_swerving_events: number;
          abnormal_slowdown_events: number;
          traffic_density: number;
          flooding_level: number;
          is_blocked: boolean;
          speed_limit_kmh: number;
          last_risk_update: string;
        };
        Insert: {
          id: string;
          road_name: string;
          city_id?: string;
          latitude: number;
          longitude: number;
          risk_score?: number;
          risk_level?: string;
          hard_braking_events?: number;
          sudden_swerving_events?: number;
          abnormal_slowdown_events?: number;
          traffic_density?: number;
          flooding_level?: number;
          is_blocked?: boolean;
          speed_limit_kmh?: number;
          last_risk_update?: string;
        };
        Update: {
          road_name?: string;
          city_id?: string;
          latitude?: number;
          longitude?: number;
          risk_score?: number;
          risk_level?: string;
          hard_braking_events?: number;
          sudden_swerving_events?: number;
          abnormal_slowdown_events?: number;
          traffic_density?: number;
          flooding_level?: number;
          is_blocked?: boolean;
          speed_limit_kmh?: number;
          last_risk_update?: string;
        };
      };
      missions: {
        Row: {
          id: string;
          user_id: string | null;
          vehicle_id: string | null;
          origin_name: string;
          origin_lat: number;
          origin_lng: number;
          destination_name: string;
          destination_lat: number;
          destination_lng: number;
          selected_route_id: string | null;
          status: MissionStatusType;
          distance_km: number;
          base_eta_minutes: number;
          adjusted_eta_minutes: number;
          time_saved_minutes: number;
          risk_avoided_points: number;
          reroute_count: number;
          data_source: DataProvenanceType;
          is_simulation: boolean;
          started_at: string | null;
          arrived_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id?: string | null;
          vehicle_id?: string | null;
          origin_name: string;
          origin_lat: number;
          origin_lng: number;
          destination_name: string;
          destination_lat: number;
          destination_lng: number;
          selected_route_id?: string | null;
          status?: MissionStatusType;
          distance_km?: number;
          base_eta_minutes?: number;
          adjusted_eta_minutes?: number;
          time_saved_minutes?: number;
          risk_avoided_points?: number;
          reroute_count?: number;
          data_source?: DataProvenanceType;
          is_simulation?: boolean;
          started_at?: string | null;
          arrived_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          vehicle_id?: string | null;
          origin_name?: string;
          origin_lat?: number;
          origin_lng?: number;
          destination_name?: string;
          destination_lat?: number;
          destination_lng?: number;
          selected_route_id?: string | null;
          status?: MissionStatusType;
          distance_km?: number;
          base_eta_minutes?: number;
          adjusted_eta_minutes?: number;
          time_saved_minutes?: number;
          risk_avoided_points?: number;
          reroute_count?: number;
          data_source?: DataProvenanceType;
          is_simulation?: boolean;
          started_at?: string | null;
          arrived_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          updated_at?: string;
        };
      };
      routes: {
        Row: {
          id: string;
          mission_id: string;
          name: string;
          summary: string | null;
          distance_km: number;
          base_eta_minutes: number;
          adjusted_eta_minutes: number;
          risk_score: number;
          risk_level: string;
          coordinates_json: Json;
          provider: string;
          provider_metadata: Json | null;
          is_active: boolean;
          is_simulation: boolean;
          calculated_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          mission_id: string;
          name: string;
          summary?: string | null;
          distance_km: number;
          base_eta_minutes: number;
          adjusted_eta_minutes: number;
          risk_score?: number;
          risk_level?: string;
          coordinates_json: Json;
          provider?: string;
          provider_metadata?: Json | null;
          is_active?: boolean;
          is_simulation?: boolean;
          calculated_at?: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          summary?: string | null;
          distance_km?: number;
          base_eta_minutes?: number;
          adjusted_eta_minutes?: number;
          risk_score?: number;
          risk_level?: string;
          coordinates_json?: Json;
          is_active?: boolean;
        };
      };
      route_history: {
        Row: {
          id: number;
          mission_id: string;
          previous_route_id: string | null;
          new_route_id: string | null;
          reason: string;
          trigger_event: string | null;
          old_risk: number | null;
          new_risk: number | null;
          vehicle_lat: number | null;
          vehicle_lng: number | null;
          is_simulation: boolean;
          recorded_at: string;
        };
        Insert: {
          mission_id: string;
          previous_route_id?: string | null;
          new_route_id?: string | null;
          reason: string;
          trigger_event?: string | null;
          old_risk?: number | null;
          new_risk?: number | null;
          vehicle_lat?: number | null;
          vehicle_lng?: number | null;
          is_simulation?: boolean;
          recorded_at?: string;
        };
        Update: {
          reason?: string;
          trigger_event?: string | null;
          old_risk?: number | null;
          new_risk?: number | null;
        };
      };
      telemetry_stream: {
        Row: {
          id: number;
          vehicle_id: string;
          mission_id: string | null;
          latitude: number;
          longitude: number;
          heading: number;
          speed_kmh: number;
          accuracy: number | null;
          source: string;
          is_simulation: boolean;
          metadata: Json | null;
          recorded_at: string;
        };
        Insert: {
          vehicle_id: string;
          mission_id?: string | null;
          latitude: number;
          longitude: number;
          heading: number;
          speed_kmh: number;
          accuracy?: number | null;
          source?: string;
          is_simulation?: boolean;
          metadata?: Json | null;
          recorded_at?: string;
        };
        Update: {
          latitude?: number;
          longitude?: number;
          heading?: number;
          speed_kmh?: number;
          accuracy?: number | null;
        };
      };
      hazard_reports: {
        Row: {
          id: string;
          category: string;
          title: string;
          description: string | null;
          severity: HazardSeverityType;
          latitude: number;
          longitude: number;
          location_name: string | null;
          reported_by_user_id: string | null;
          reporter_name: string;
          verified: boolean;
          affected_route_ids: string[] | null;
          data_source: DataProvenanceType;
          is_simulation: boolean;
          reported_at: string;
          expires_at: string | null;
        };
        Insert: {
          id: string;
          category: string;
          title: string;
          description?: string | null;
          severity?: HazardSeverityType;
          latitude: number;
          longitude: number;
          location_name?: string | null;
          reported_by_user_id?: string | null;
          reporter_name?: string;
          verified?: boolean;
          affected_route_ids?: string[] | null;
          data_source?: DataProvenanceType;
          is_simulation?: boolean;
          reported_at?: string;
          expires_at?: string | null;
        };
        Update: {
          category?: string;
          title?: string;
          description?: string | null;
          severity?: HazardSeverityType;
          latitude?: number;
          longitude?: number;
          location_name?: string | null;
          verified?: boolean;
          affected_route_ids?: string[] | null;
          expires_at?: string | null;
        };
      };
      risk_events: {
        Row: {
          id: string;
          vehicle_id: string | null;
          event_type: string;
          latitude: number;
          longitude: number;
          radius: number;
          road_segment_id: string | null;
          severity: string;
          speed_before: number | null;
          speed_after: number | null;
          source_type: string;
          is_simulation: boolean;
          metadata: Json | null;
          occurred_at: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          vehicle_id?: string | null;
          event_type: string;
          latitude: number;
          longitude: number;
          radius?: number;
          road_segment_id?: string | null;
          severity?: string;
          speed_before?: number | null;
          speed_after?: number | null;
          source_type?: string;
          is_simulation?: boolean;
          metadata?: Json | null;
          occurred_at?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          severity?: string;
          is_simulation?: boolean;
          expires_at?: string | null;
        };
      };
      risk_scores: {
        Row: {
          id: string;
          route_id: string | null;
          road_segment_id: string;
          score: number;
          risk_level: string;
          model_version: string;
          factors: Json | null;
          source: string;
          explanation: string | null;
          is_simulation: boolean;
          calculated_at: string;
        };
        Insert: {
          id: string;
          route_id?: string | null;
          road_segment_id: string;
          score: number;
          risk_level: string;
          model_version?: string;
          factors?: Json | null;
          source?: string;
          explanation?: string | null;
          is_simulation?: boolean;
          calculated_at?: string;
        };
        Update: {
          score?: number;
          risk_level?: string;
          factors?: Json | null;
          explanation?: string | null;
        };
      };
      simulation_sessions: {
        Row: {
          id: string;
          mission_id: string | null;
          user_id: string;
          scenario_title: string;
          incident_type: string;
          injected_events_count: number;
          hazards_count: number;
          weather_condition: string;
          traffic_density_multiplier: number;
          configuration: Json | null;
          state: string;
          data_source: DataProvenanceType;
          is_simulation: boolean;
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          id: string;
          mission_id?: string | null;
          user_id: string;
          scenario_title: string;
          incident_type: string;
          injected_events_count?: number;
          hazards_count?: number;
          weather_condition?: string;
          traffic_density_multiplier?: number;
          configuration?: Json | null;
          state?: string;
          data_source?: DataProvenanceType;
          is_simulation?: boolean;
          created_at?: string;
          ended_at?: string | null;
        };
        Update: {
          injected_events_count?: number;
          hazards_count?: number;
          state?: string;
          ended_at?: string | null;
        };
      };
      audit_logs: {
        Row: {
          id: number;
          user_id: string | null;
          actor: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Json | null;
          ip_address: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          actor: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          details?: Json | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          mission_id: string | null;
          title: string;
          body: string;
          type: string;
          severity: string;
          payload: Json | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id?: string | null;
          mission_id?: string | null;
          title: string;
          body: string;
          type: string;
          severity?: string;
          payload?: Json | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
      };
      device_tokens: {
        Row: {
          id: number;
          user_id: string | null;
          token: string;
          platform: string;
          browser_identifier: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
        };
        Insert: {
          user_id?: string | null;
          token: string;
          platform?: string;
          browser_identifier?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
        Update: {
          active?: boolean;
          updated_at?: string;
          last_seen_at?: string;
        };
      };
    };
  };
}
