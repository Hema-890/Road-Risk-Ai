// ==============================================================================
// ROADRISK AI — NETWORK STATUS & CONNECTIVITY MANAGER
// Tracks browser online/offline state + periodic network health checks.
// Emits status transitions to trigger offline routing and UI warnings.
// ==============================================================================

import { eventBus } from './eventBus.ts';

export type NetworkState = 'ONLINE' | 'DEGRADED' | 'OFFLINE';

export interface NetworkHealth {
  state: NetworkState;
  isOnline: boolean;
  latencyMs: number | null;
  lastChecked: string;
  offlineSince: string | null;
}

class NetworkStatusService {
  private state: NetworkState =
    typeof navigator !== 'undefined' && 'onLine' in navigator
      ? (navigator.onLine ? 'ONLINE' : 'OFFLINE')
      : 'ONLINE';
  private latencyMs: number | null = null;
  private offlineSince: string | null = null;
  private listeners: Set<(health: NetworkHealth) => void> = new Set();
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineEvent.bind(this));
      window.addEventListener('offline', this.handleOfflineEvent.bind(this));
      this.startHealthPolling();
    }
  }

  private handleOnlineEvent() {
    this.checkHealthNow().then(() => {
      this.offlineSince = null;
      this.notifyListeners();
    });
  }

  private handleOfflineEvent() {
    this.state = 'OFFLINE';
    this.offlineSince = new Date().toISOString();
    this.notifyListeners();
  }

  private startHealthPolling() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => {
      this.checkHealthNow();
    }, 20000); // Check every 20 seconds
  }

  public async checkHealthNow(): Promise<NetworkHealth> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.state = 'OFFLINE';
      if (!this.offlineSince) this.offlineSince = new Date().toISOString();
      this.notifyListeners();
      return this.getHealth();
    }

    const start = performance.now();
    try {
      // Lightweight fetch with strict 3-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // Ping Open-Meteo or origin
      const target = typeof window !== 'undefined' && window.location.origin
        ? `${window.location.origin}/favicon.ico?_t=${Date.now()}`
        : 'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m';

      const res = await fetch(target, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      }).catch(async () => {
        // Fallback to minimal GET
        return fetch('https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m', {
          signal: controller.signal,
          cache: 'no-store',
        });
      });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - start);
      this.latencyMs = latency;

      if (res.ok || res.status < 500) {
        if (latency > 1500) {
          this.state = 'DEGRADED';
        } else {
          this.state = 'ONLINE';
        }
        this.offlineSince = null;
      } else {
        this.state = 'DEGRADED';
      }
    } catch {
      this.state = 'OFFLINE';
      if (!this.offlineSince) this.offlineSince = new Date().toISOString();
      this.latencyMs = null;
    }

    this.notifyListeners();
    return this.getHealth();
  }

  public getHealth(): NetworkHealth {
    return {
      state: this.state,
      isOnline: this.state !== 'OFFLINE',
      latencyMs: this.latencyMs,
      lastChecked: new Date().toISOString(),
      offlineSince: this.offlineSince,
    };
  }

  public isOnline(): boolean {
    return this.state !== 'OFFLINE';
  }

  public simulateNetworkChange(online: boolean) {
    this.state = online ? 'ONLINE' : 'OFFLINE';
    this.offlineSince = online ? null : new Date().toISOString();
    this.notifyListeners();
  }

  public subscribe(listener: (health: NetworkHealth) => void): () => void {
    this.listeners.add(listener);
    listener(this.getHealth());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const health = this.getHealth();
    this.listeners.forEach((l) => l(health));
    eventBus.emit('NETWORK_STATUS_CHANGED', health);
  }
}

export const networkStatusService = new NetworkStatusService();
export default networkStatusService;
