/**
 * RoadRisk AI - Enterprise Notification & Push Alert Service
 * Integrates with Firebase Cloud Messaging (FCM), VAPID Web Push, and in-app emergency sound alerts.
 */

import { isFirebaseConfigured, getMessagingToken, onForegroundMessage } from '../lib/firebaseClient';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { NotificationPayload } from '../types/events';

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

export interface DeviceTokenRecord {
  id?: string;
  user_id?: string;
  fcm_token: string;
  device_type: 'web' | 'ios' | 'android';
  platform?: string;
  user_agent?: string;
  is_active: boolean;
  last_used_at?: string;
}

export interface NotificationPreferences {
  citizenAlerts: boolean;
  emergencyAlerts: boolean;
  soundAlerts: boolean;
  hazardsAhead: boolean;
  rerouteAlerts: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  citizenAlerts: true,
  emergencyAlerts: true,
  soundAlerts: true,
  hazardsAhead: true,
  rerouteAlerts: true,
};

class NotificationService {
  private currentToken: string | null = null;
  private permissionStatus: NotificationPermissionStatus = 'default';
  private processedEventIds: Set<string> = new Set();
  private foregroundListeners: Set<(payload: NotificationPayload) => void> = new Set();
  private maxProcessedEvents = 200;
  private lastAlertTimestamp: Record<string, number> = {};
  private preferences: NotificationPreferences = DEFAULT_PREFERENCES;

  constructor() {
    this.loadPreferences();
    this.checkInitialPermission();
  }

  private loadPreferences(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('roadrisk_notification_prefs');
      if (stored) {
        this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {}
  }

  public getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  public updatePreferences(partial: Partial<NotificationPreferences>): NotificationPreferences {
    this.preferences = { ...this.preferences, ...partial };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('roadrisk_notification_prefs', JSON.stringify(this.preferences));
      } catch {}
    }
    return this.preferences;
  }

  private checkInitialPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      this.permissionStatus = 'unsupported';
      return;
    }
    this.permissionStatus = Notification.permission as NotificationPermissionStatus;
    if (this.permissionStatus === 'granted') {
      this.setupForegroundListener();
    }
  }

  public getPermissionStatus(): NotificationPermissionStatus {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as NotificationPermissionStatus;
  }

  public isConfigured(): boolean {
    return isFirebaseConfigured();
  }

  /**
   * Explicit User Action: "ENABLE EMERGENCY ALERTS"
   * Does NOT execute automatically on page load.
   */
  public async enableEmergencyAlerts(userId?: string): Promise<{ success: boolean; token?: string; error?: string }> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { success: false, error: 'Web notifications are not supported by this browser.' };
    }

    try {
      // 1. Request browser permission
      const permission = await Notification.requestPermission();
      this.permissionStatus = permission as NotificationPermissionStatus;

      if (permission !== 'granted') {
        return { success: false, error: 'Notification permission was denied by the user.' };
      }

      // 2. If Firebase is not configured with external credentials, still allow local browser alerts
      if (!isFirebaseConfigured()) {
        console.warn('[NotificationService] Firebase credentials not configured. Local browser notifications enabled.');
        return { success: true };
      }

      // 3. Register service worker and retrieve FCM device token
      const token = await getMessagingToken();
      if (!token) {
        return { success: true }; // Local notifications still work even if token failed
      }

      this.currentToken = token;

      // 4. Register token with backend and/or Supabase device_tokens table
      await this.registerDeviceToken(token, userId);

      // 5. Setup foreground handler
      this.setupForegroundListener();

      return { success: true, token };
    } catch (err: any) {
      console.error('[NotificationService] Error enabling emergency alerts:', err);
      return { success: false, error: err?.message || 'Failed to initialize notifications' };
    }
  }

  /**
   * Deactivate alerts & clean up token (Logout / Preferences Disabled)
   */
  public async disableAlerts(): Promise<void> {
    const token = this.currentToken;
    if (!token) return;

    // 1. Supabase deactivation
    if (isSupabaseConfigured() && supabase) {
      try {
        await (supabase.from('device_tokens') as any)
          .update({ is_active: false })
          .eq('fcm_token', token);
      } catch {}
    }

    // 2. Backend deactivation
    try {
      await fetch('http://localhost:3001/api/notifications/deactivate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcm_token: token }),
      });
    } catch {}

    this.currentToken = null;
  }

  /**
   * Register device token in database
   */
  private async registerDeviceToken(token: string, userId?: string): Promise<void> {
    const payload: DeviceTokenRecord = {
      fcm_token: token,
      device_type: 'web',
      user_id: userId,
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'web',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : 'unknown',
      is_active: true,
      last_used_at: new Date().toISOString(),
    };

    // 1. Supabase device_tokens registration if available
    if (isSupabaseConfigured() && supabase) {
      try {
        await (supabase.from('device_tokens') as any).upsert(payload, { onConflict: 'fcm_token' });
      } catch (err) {
        console.warn('[NotificationService] Supabase token register warning:', err);
      }
    }

    // 2. Server-side registration endpoint
    try {
      await fetch('http://localhost:3001/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Server might be offline or starting up
    }
  }

  /**
   * Set up foreground push listener
   */
  private setupForegroundListener(): void {
    onForegroundMessage((payload: any) => {
      if (!payload) return;
      const data = payload.data || {};
      const notif = payload.notification || {};

      const emergencyPayload: NotificationPayload = {
        title: notif.title || 'RoadRisk Alert',
        body: notif.body || '',
        severity: (data.severity as any) || 'HIGH',
        mission_id: data.mission_id,
        event_type: data.event_type,
        event_id: data.event_id || `fcm-${Date.now()}`,
        timestamp: new Date().toISOString(),
        data: payload.data,
      };

      this.dispatchNotification(emergencyPayload);
    });
  }

  /**
   * Central notification dispatcher with deduplication and preference check
   */
  public dispatchNotification(payload: NotificationPayload): boolean {
    const dedupeKey = `${payload.mission_id || 'general'}:${payload.event_type || 'info'}:${payload.event_id}`;

    if (this.processedEventIds.has(dedupeKey)) {
      return false;
    }

    // Rate-limiting check per event type (minimum 15s between identical alert types)
    const now = Date.now();
    const typeKey = `${payload.event_type || 'general'}`;
    if (this.lastAlertTimestamp[typeKey] && now - this.lastAlertTimestamp[typeKey] < 15000) {
      return false;
    }
    this.lastAlertTimestamp[typeKey] = now;

    this.processedEventIds.add(dedupeKey);
    if (this.processedEventIds.size > this.maxProcessedEvents) {
      const first = this.processedEventIds.values().next().value;
      if (first) this.processedEventIds.delete(first);
    }

    // Notify all in-app UI listeners
    this.foregroundListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('[NotificationService] Foreground listener error:', err);
      }
    });

    // Native browser notification if window is hidden and permission is granted
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      document.visibilityState === 'hidden'
    ) {
      try {
        new Notification(payload.title, {
          body: payload.body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: dedupeKey,
        });
      } catch (err) {
        console.warn('[NotificationService] Native notification dispatch error:', err);
      }
    }

    return true;
  }

  // --- Citizen User Meaningful Notifications ---

  public notifyHazardAhead(title: string, severity: 'warning' | 'high' | 'critical', distanceMeters?: number): void {
    if (!this.preferences.hazardsAhead) return;
    const distText = distanceMeters ? ` in ${distanceMeters}m` : '';
    this.dispatchNotification({
      title: `⚠️ Road Hazard Ahead${distText}`,
      body: `${title}. Exercise caution and maintain safe braking distance.`,
      severity: severity === 'critical' ? 'CRITICAL' : severity === 'high' ? 'HIGH' : 'NORMAL',
      event_type: 'HAZARD_AHEAD',
      event_id: `haz-${title}-${Math.floor(Date.now() / 60000)}`,
      timestamp: new Date().toISOString(),
    });
  }

  public notifyElevatedRisk(roadName: string, riskScore: number): void {
    if (!this.preferences.citizenAlerts) return;
    this.dispatchNotification({
      title: `Elevated Road Risk Ahead`,
      body: `${roadName} has risk index ${riskScore}/100 due to sudden deceleration clusters.`,
      severity: riskScore > 75 ? 'HIGH' : 'NORMAL',
      event_type: 'ELEVATED_RISK',
      event_id: `risk-${roadName}-${Math.floor(Date.now() / 60000)}`,
      timestamp: new Date().toISOString(),
    });
  }

  public notifyRouteUpdated(reason: string): void {
    if (!this.preferences.rerouteAlerts) return;
    this.dispatchNotification({
      title: `Route Updated`,
      body: reason || 'Faster and safer corridor computed.',
      severity: 'NORMAL',
      event_type: 'ROUTE_UPDATED',
      event_id: `reroute-${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
  }

  public notifyDestinationReached(destination: string): void {
    this.dispatchNotification({
      title: `Destination Reached`,
      body: `You have safely arrived at ${destination}.`,
      severity: 'NORMAL',
      event_type: 'DESTINATION_REACHED',
      event_id: `arrived-${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
  }

  // --- Emergency Dispatch Notifications ---

  public notifyMissionCreated(missionId: string, callsign: string, destination: string): void {
    if (!this.preferences.emergencyAlerts) return;
    this.dispatchNotification({
      title: `🚨 Emergency Mission Dispatched`,
      body: `${callsign} en route to ${destination}. Pre-empting signal corridors.`,
      severity: 'CRITICAL',
      mission_id: missionId,
      event_type: 'MISSION_CREATED',
      event_id: `mission-create-${missionId}`,
      timestamp: new Date().toISOString(),
    });
  }

  public notifyEmergencyReroute(missionId: string, reason: string): void {
    if (!this.preferences.emergencyAlerts) return;
    this.dispatchNotification({
      title: `🚨 Priority Corridor Reroute Recommended`,
      body: reason,
      severity: 'CRITICAL',
      mission_id: missionId,
      event_type: 'EMERGENCY_REROUTE',
      event_id: `mission-reroute-${missionId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
  }

  public onForegroundAlert(listener: (payload: NotificationPayload) => void): () => void {
    this.foregroundListeners.add(listener);
    return () => {
      this.foregroundListeners.delete(listener);
    };
  }

  public getDeviceToken(): string | null {
    return this.currentToken;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
