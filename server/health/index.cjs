// ==============================================================================
// ROADRISK AI — PROVIDER & DATA SOURCE HEALTH REGISTRY
// Tracks live facts vs models vs unavailable status with exact timestamps and latency
// ==============================================================================

class HealthRegistry {
  constructor() {
    this.providers = new Map();
  }

  registerProvider(id, name, type = 'LIVE') {
    this.providers.set(id, {
      id,
      name,
      type, // 'LIVE' | 'MODEL' | 'REFERENCE' | 'HISTORICAL'
      status: 'INITIALIZING', // 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'ERROR' | 'MODEL'
      lastSuccess: null,
      lastFailure: null,
      lastStatusHttp: null,
      latencyMs: 0,
      freshness: 'UNAVAILABLE',
      recordsReceived: 0,
      recordsRejected: 0,
      consecutiveFailures: 0,
      lastError: null,
      enabled: true,
      pollIntervalSec: 60,
    });
  }

  recordSuccess(id, latencyMs, recordsCount = 0, httpStatus = 200) {
    let p = this.providers.get(id);
    if (!p) {
      this.registerProvider(id, id);
      p = this.providers.get(id);
    }
    const now = new Date().toISOString();
    p.status = p.type === 'MODEL' ? 'MODEL' : 'LIVE';
    p.lastSuccess = now;
    p.lastStatusHttp = httpStatus;
    p.latencyMs = Math.round(latencyMs);
    p.freshness = 'LIVE';
    p.recordsReceived += recordsCount;
    p.consecutiveFailures = 0;
    p.lastError = null;
  }

  recordFailure(id, error, httpStatus = null, latencyMs = 0) {
    let p = this.providers.get(id);
    if (!p) {
      this.registerProvider(id, id);
      p = this.providers.get(id);
    }
    const now = new Date().toISOString();
    p.consecutiveFailures++;
    p.lastFailure = now;
    p.lastStatusHttp = httpStatus;
    p.latencyMs = Math.round(latencyMs);
    p.lastError = typeof error === 'string' ? error : (error?.message || 'Unknown provider error');
    if (p.consecutiveFailures > 2) {
      p.status = 'ERROR';
      p.freshness = 'EXPIRED';
    } else {
      p.status = 'STALE';
      p.freshness = 'STALE';
    }
    p.recordsRejected++;
  }

  setUnavailable(id, reason = 'Feed not provisioned or authorized') {
    let p = this.providers.get(id);
    if (!p) {
      this.registerProvider(id, id);
      p = this.providers.get(id);
    }
    p.status = 'UNAVAILABLE';
    p.freshness = 'UNAVAILABLE';
    p.lastError = reason;
  }

  getProvider(id) {
    return this.providers.get(id) || null;
  }

  getAll() {
    const list = [];
    for (const p of this.providers.values()) {
      // Re-evaluate freshness based on elapsed time
      if (p.lastSuccess) {
        const ageSec = (Date.now() - new Date(p.lastSuccess).getTime()) / 1000;
        if (ageSec > p.pollIntervalSec * 3) {
          p.freshness = 'STALE';
          if (p.status === 'LIVE') p.status = 'STALE';
        }
      }
      list.push({ ...p });
    }
    return list;
  }

  getOverallSummary() {
    const providers = this.getAll();
    const liveCount = providers.filter(p => p.status === 'LIVE').length;
    const modelCount = providers.filter(p => p.status === 'MODEL').length;
    const errorCount = providers.filter(p => p.status === 'ERROR').length;
    const unavailableCount = providers.filter(p => p.status === 'UNAVAILABLE').length;

    return {
      timestamp: new Date().toISOString(),
      totalProviders: providers.length,
      liveCount,
      modelCount,
      errorCount,
      unavailableCount,
      healthy: errorCount === 0,
      providers,
    };
  }
}

const healthRegistry = new HealthRegistry();
module.exports = { healthRegistry, HealthRegistry };
