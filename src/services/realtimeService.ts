import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  RoadRiskEvent,
  TelemetryEvent,
  HazardEvent,
  RiskEvent,
  RerouteEvent,
  MissionStateEvent,
} from '../types/events';

export type ConnectionState =
  | 'CONNECTED'
  | 'CONNECTING'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'ERROR'
  | 'NOT_CONFIGURED';

type EventCallback<T = any> = (payload: T) => void;

class RealtimeService {
  private activeChannels: Map<string, RealtimeChannel> = new Map();
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private connectionState: ConnectionState = 'DISCONNECTED';
  private connectionListeners: Set<(status: ConnectionState) => void> = new Set();
  private processedEventIds: Set<string> = new Set();
  private maxEventHistory: number = 200;
  private sseSource: EventSource | null = null;

  constructor() {
    this.updateConnectionState(isSupabaseConfigured() ? 'DISCONNECTED' : 'NOT_CONFIGURED');
    this.initSseStream();
  }

  /**
   * Initializes SSE stream from backend REST/Realtime server
   */
  private initSseStream() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    try {
      const backendUrl = (import.meta as any)?.env?.VITE_BACKEND_API_URL || 'http://localhost:3001';
      this.sseSource = new EventSource(`${backendUrl}/api/events/stream`);

      this.sseSource.onopen = () => {
        if (!isSupabaseConfigured()) {
          this.updateConnectionState('CONNECTED');
        }
      };

      this.sseSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.event_type && !this.isDuplicate(data.event_id)) {
            this.emit(data.event_type, data);
            this.emit('*', data);
          }
        } catch {}
      };

      this.sseSource.onerror = () => {
        // SSE automatically attempts reconnects
      };
    } catch (err) {
      console.warn('[RealtimeService] SSE connection notice:', err);
    }
  }

  public getConnectionState(): ConnectionState {
    if (!isSupabaseConfigured()) return 'NOT_CONFIGURED';
    return this.connectionState;
  }

  public onConnectionStateChange(callback: (status: ConnectionState) => void): () => void {
    this.connectionListeners.add(callback);
    callback(this.getConnectionState());
    return () => this.connectionListeners.delete(callback);
  }

  private updateConnectionState(state: ConnectionState) {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.connectionListeners.forEach((cb) => cb(state));
    }
  }

  /**
   * Deduplicate incoming events by eventId
   */
  private isDuplicate(eventId?: string): boolean {
    if (!eventId) return false;
    if (this.processedEventIds.has(eventId)) {
      return true;
    }
    this.processedEventIds.add(eventId);
    if (this.processedEventIds.size > this.maxEventHistory) {
      const oldest = this.processedEventIds.values().next().value;
      if (oldest) this.processedEventIds.delete(oldest);
    }
    return false;
  }

  /**
   * Subscribe to a Mission Realtime Broadcast & Postgres Changes channel
   */
  public subscribeToMission(missionId: string): RealtimeChannel | null {
    const supabase = getSupabaseClient();
    if (!supabase) {
      this.updateConnectionState('NOT_CONFIGURED');
      return null;
    }

    const channelName = `roadrisk:mission:${missionId}`;
    if (this.activeChannels.has(channelName)) {
      return this.activeChannels.get(channelName)!;
    }

    this.updateConnectionState('CONNECTING');

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true, self: false },
      },
    });

    // 1. High-frequency Broadcast Listeners
    channel
      .on('broadcast', { event: 'telemetry' }, ({ payload }) => {
        const event = payload as TelemetryEvent;
        if (!this.isDuplicate(event.eventId)) {
          this.emit('telemetry', event);
        }
      })
      .on('broadcast', { event: 'risk_update' }, ({ payload }) => {
        const event = payload as RiskEvent;
        if (!this.isDuplicate(event.eventId)) {
          this.emit('risk_update', event);
        }
      })
      .on('broadcast', { event: 'reroute_started' }, ({ payload }) => {
        const event = payload as RerouteEvent;
        if (!this.isDuplicate(event.eventId)) {
          this.emit('reroute_started', event);
        }
      })
      .on('broadcast', { event: 'reroute_completed' }, ({ payload }) => {
        const event = payload as RerouteEvent;
        if (!this.isDuplicate(event.eventId)) {
          this.emit('reroute_completed', event);
        }
      })
      .on('broadcast', { event: 'mission_state' }, ({ payload }) => {
        const event = payload as MissionStateEvent;
        if (!this.isDuplicate(event.eventId)) {
          this.emit('mission_state', event);
        }
      });

    // 2. Durable Postgres Changes Listeners for Mission & Hazards
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'missions',
          filter: `id=eq.${missionId}`,
        },
        (change) => {
          this.emit('mission_db_change', change);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hazard_reports',
        },
        (change) => {
          this.emit('hazard_db_insert', change);
        }
      );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.updateConnectionState('CONNECTED');
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        this.updateConnectionState('ERROR');
      } else if (status === 'CLOSED') {
        this.updateConnectionState('DISCONNECTED');
      }
    });

    this.activeChannels.set(channelName, channel);
    return channel;
  }

  /**
   * Broadcast high-frequency telemetry event to mission channel
   */
  public async broadcastTelemetry(missionId: string, event: TelemetryEvent): Promise<boolean> {
    const channelName = `roadrisk:mission:${missionId}`;
    let channel = this.activeChannels.get(channelName);
    if (!channel) {
      channel = this.subscribeToMission(missionId) || undefined;
    }
    if (!channel) return false;

    try {
      await channel.send({
        type: 'broadcast',
        event: 'telemetry',
        payload: event,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Broadcast dynamic reroute event
   */
  public async broadcastReroute(missionId: string, event: RerouteEvent): Promise<boolean> {
    const channelName = `roadrisk:mission:${missionId}`;
    const channel = this.activeChannels.get(channelName);
    if (!channel) return false;

    try {
      await channel.send({
        type: 'broadcast',
        event: event.eventType === 'REROUTE_STARTED' ? 'reroute_started' : 'reroute_completed',
        payload: event,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Broadcast mission state machine change
   */
  public async broadcastMissionState(missionId: string, event: MissionStateEvent): Promise<boolean> {
    const channelName = `roadrisk:mission:${missionId}`;
    const channel = this.activeChannels.get(channelName);
    if (!channel) return false;

    try {
      await channel.send({
        type: 'broadcast',
        event: 'mission_state',
        payload: event,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Event subscription helpers
   */
  public on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, payload: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((cb) => cb(payload));
    }
  }

  /**
   * Leave and cleanly unsubscribe from a channel
   */
  public unsubscribeMission(missionId: string) {
    const channelName = `roadrisk:mission:${missionId}`;
    const channel = this.activeChannels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.activeChannels.delete(channelName);
    }
    if (this.activeChannels.size === 0 && isSupabaseConfigured()) {
      this.updateConnectionState('DISCONNECTED');
    }
  }

  /**
   * Cleanup all channels on teardown
   */
  public cleanupAll() {
    this.activeChannels.forEach((ch) => ch.unsubscribe());
    this.activeChannels.clear();
    this.eventListeners.clear();
    this.updateConnectionState(isSupabaseConfigured() ? 'DISCONNECTED' : 'NOT_CONFIGURED');
  }
}

export const realtimeService = new RealtimeService();
export default realtimeService;
