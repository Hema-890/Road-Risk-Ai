// ==============================================================================
// ROADRISK AI — CITIZEN HAZARD REPORTING SERVICE (REPORT AHEAD)
// Implements real user-reported road incidents with GPS capture,
// Initial status USER_REPORTED (unverified), peer-corroboration, and TTL expiration.
// Stores to Supabase public.hazard_reports with fallback to local indexed store.
// ==============================================================================

import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient.ts';
import { eventBus } from './eventBus.ts';
import type { DataStatus } from '../types/dataStatus.ts';
import { networkStatusService } from './networkStatusService.ts';
import { offlineStorageService } from './offlineStorageService.ts';

export type UserHazardType =
  | 'Accident'
  | 'Pothole'
  | 'Flooding'
  | 'Road blocked'
  | 'Construction'
  | 'Traffic hazard'
  | 'Vehicle breakdown'
  | 'Other hazard';

export interface CitizenHazardReport {
  id: string;
  type: UserHazardType;
  title: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  latitude: number;
  longitude: number;
  locationName?: string;
  reportedAt: string;
  expiresAt: string;
  status: DataStatus; // REPORTED (unverified) | LIVE (corroborated) | STALE | EXPIRED
  verificationCount: number;
  source: 'USER_REPORTED';
  verified: boolean;
  reporterSessionId?: string;
  syncStatus?: 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
}

const LOCAL_STORAGE_KEY = 'roadrisk_citizen_hazard_reports';
const DEFAULT_EXPIRATION_HOURS: Record<UserHazardType, number> = {
  'Accident': 2,
  'Pothole': 24,
  'Flooding': 4,
  'Road blocked': 3,
  'Construction': 12,
  'Traffic hazard': 1.5,
  'Vehicle breakdown': 1.5,
  'Other hazard': 2,
};

class HazardReportService {
  private activeReports: Map<string, CitizenHazardReport> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.loadFromStorage();
    if (typeof window !== 'undefined') {
      networkStatusService.subscribe((health) => {
        if (health.isOnline) {
          this.syncPendingReports();
        }
      });
    }
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const items: CitizenHazardReport[] = JSON.parse(raw);
          const now = Date.now();
          items.forEach((item) => {
            // Keep only unexpired reports
            if (new Date(item.expiresAt).getTime() > now) {
              this.activeReports.set(item.id, item);
            }
          });
        }
      }
    } catch (e) {
      console.warn('RoadRisk AI: Failed to load stored hazard reports:', e);
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const arr = Array.from(this.activeReports.values());
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(arr));
      }
    } catch (e) {
      console.warn('RoadRisk AI: Failed to persist hazard reports:', e);
    }
  }

  /**
   * Initializes reports by querying Supabase and merging with local store
   */
  async initialize(): Promise<CitizenHazardReport[]> {
    if (this.initialized) {
      return this.getActiveReports();
    }

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('hazard_reports')
            .select('*')
            .gt('expires_at', new Date().toISOString())
            .order('reported_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            data.forEach((row: any) => {
              const mapped: CitizenHazardReport = {
                id: row.id,
                type: (row.category || 'Other hazard') as UserHazardType,
                title: row.title || `${row.category} ahead`,
                description: row.description || 'Reported by driver on corridor',
                severity: row.severity || 'high',
                latitude: row.latitude,
                longitude: row.longitude,
                locationName: row.location_name,
                reportedAt: row.reported_at,
                expiresAt: row.expires_at || new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
                status: row.verified ? 'LIVE' : 'REPORTED',
                verificationCount: row.verification_count || 1,
                source: 'USER_REPORTED',
                verified: Boolean(row.verified),
                reporterSessionId: row.reporter_name,
              };
              this.activeReports.set(mapped.id, mapped);
            });
            this.saveToStorage();
          }
        }
      } catch (err) {
        console.warn('RoadRisk AI: Could not sync hazard reports from Supabase:', err);
      }
    }

    this.initialized = true;
    return this.getActiveReports();
  }

  /**
   * Submits a new citizen road hazard report
   */
  async submitReport(
    type: UserHazardType,
    coordinates: [number, number], // [lng, lat]
    description?: string,
    locationName?: string
  ): Promise<CitizenHazardReport> {
    const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const ttlHours = DEFAULT_EXPIRATION_HOURS[type] || 2;
    const expiresAt = new Date(now.getTime() + ttlHours * 3600 * 1000).toISOString();

    let severity: 'low' | 'moderate' | 'high' | 'critical' = 'high';
    if (type === 'Road blocked' || type === 'Flooding') severity = 'critical';
    else if (type === 'Accident') severity = 'high';
    else if (type === 'Pothole' || type === 'Construction') severity = 'moderate';
    else severity = 'low';

    const report: CitizenHazardReport = {
      id,
      type,
      title: `${type} Ahead`,
      description: description || `User reported ${type.toLowerCase()} at this location.`,
      severity,
      latitude: coordinates[1],
      longitude: coordinates[0],
      locationName: locationName || 'Corridor GPS coordinate',
      reportedAt: now.toISOString(),
      expiresAt,
      status: 'REPORTED', // Initial status is ALWAYS unverified USER_REPORTED per Phase 9
      verificationCount: 1,
      source: 'USER_REPORTED',
      verified: false,
    };

    const isOnline = networkStatusService.isOnline();
    report.syncStatus = isOnline ? 'SYNCED' : 'PENDING_SYNC';

    this.activeReports.set(id, report);
    this.saveToStorage();

    // Persist to Supabase if configured & online
    if (isOnline && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await (client as any).from('hazard_reports').insert({
            id: report.id,
            category: report.type,
            title: report.title,
            description: report.description,
            severity: report.severity,
            latitude: report.latitude,
            longitude: report.longitude,
            location_name: report.locationName,
            verified: false,
            data_source: 'real',
            reported_at: report.reportedAt,
            expires_at: report.expiresAt,
          });
          report.syncStatus = 'SYNCED';
        }
      } catch (err: any) {
        console.warn('RoadRisk AI: Failed to insert hazard report into Supabase, enqueuing for offline sync:', err.message);
        report.syncStatus = 'PENDING_SYNC';
        await offlineStorageService.savePendingReport({
          id: report.id,
          type: report.type,
          latitude: report.latitude,
          longitude: report.longitude,
          description: report.description,
          severity: report.severity,
          createdAt: report.reportedAt,
          syncStatus: 'PENDING_SYNC',
        });
      }
    } else if (!isOnline) {
      // Save to offline queue
      await offlineStorageService.savePendingReport({
        id: report.id,
        type: report.type,
        latitude: report.latitude,
        longitude: report.longitude,
        description: report.description,
        severity: report.severity,
        createdAt: report.reportedAt,
        syncStatus: 'PENDING_SYNC',
      });
    }

    // Broadcast on EventBus to trigger dynamic reroute checks and map layers
    eventBus.emit('HAZARD_REPORTED', {
      id: report.id,
      type: report.type,
      latitude: report.latitude,
      longitude: report.longitude,
      severity: report.severity,
      status: report.status,
      syncStatus: report.syncStatus,
    });

    return report;
  }

  /**
   * Synchronizes all offline-queued pending reports when connectivity returns
   */
  async syncPendingReports(): Promise<number> {
    if (!isSupabaseConfigured() || !networkStatusService.isOnline()) return 0;
    const pending = await offlineStorageService.getPendingReports();
    if (pending.length === 0) return 0;

    let syncedCount = 0;
    const client = getSupabaseClient();
    if (!client) return 0;

    for (const item of pending) {
      try {
        await (client as any).from('hazard_reports').insert({
          id: item.id,
          category: item.type,
          title: `${item.type} Ahead`,
          description: item.description,
          severity: item.severity,
          latitude: item.latitude,
          longitude: item.longitude,
          verified: false,
          data_source: 'real',
          reported_at: item.createdAt,
          expires_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        });
        await offlineStorageService.deletePendingReport(item.id);
        syncedCount++;

        const report = this.activeReports.get(item.id);
        if (report) {
          report.syncStatus = 'SYNCED';
        }
      } catch (e) {
        console.warn('RoadRisk AI: Failed syncing pending report:', item.id, e);
      }
    }

    if (syncedCount > 0) {
      this.saveToStorage();
      eventBus.emit('PENDING_REPORTS_SYNCED', { count: syncedCount });
    }

    return syncedCount;
  }

  /**
   * Upvote / corroborate an existing hazard report
   * When verificationCount >= 3, status upgrades to verified LIVE
   */
  async corroborateReport(id: string): Promise<CitizenHazardReport | null> {
    const report = this.activeReports.get(id);
    if (!report) return null;

    report.verificationCount += 1;
    if (report.verificationCount >= 3) {
      report.verified = true;
      report.status = 'LIVE';
    }

    this.activeReports.set(id, report);
    this.saveToStorage();

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await (client as any)
            .from('hazard_reports')
            .update({
              verified: report.verified,
            })
            .eq('id', id);
        }
      } catch (err) {
        console.warn('RoadRisk AI: Failed to update verification count:', err);
      }
    }

    return report;
  }

  /**
   * Retrieves all non-expired hazard reports
   */
  getActiveReports(): CitizenHazardReport[] {
    const now = Date.now();
    const valid: CitizenHazardReport[] = [];
    this.activeReports.forEach((rep) => {
      if (new Date(rep.expiresAt).getTime() > now) {
        valid.push(rep);
      }
    });
    return valid;
  }
}

export const hazardReportService = new HazardReportService();
export default hazardReportService;
