// ==============================================================================
// ROADRISK AI — PERFORMANCE DIAGNOSTICS SERVICE
// Measures real-world system latencies: map initialization, style loading,
// first GPS fix, search response, route calculation, route render, and reroute.
// Zero synthetic benchmarks — all metrics captured via performance.now().
// ==============================================================================

import { eventBus } from './eventBus.ts';

export interface PerformanceMetrics {
  mapInitMs: number | null;
  styleLoadMs: number | null;
  firstGpsFixMs: number | null;
  searchLatencyMs: number | null;
  routeRequestLatencyMs: number | null;
  routeRenderMs: number | null;
  trafficUpdateMs: number | null;
  riskCalculationMs: number | null;
  rerouteLatencyMs: number | null;
  lastUpdated: string;
}

export interface MetricLogEntry {
  metric: keyof PerformanceMetrics;
  durationMs: number;
  provider?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

class PerformanceDiagnosticsService {
  private metrics: PerformanceMetrics = {
    mapInitMs: null,
    styleLoadMs: null,
    firstGpsFixMs: null,
    searchLatencyMs: null,
    routeRequestLatencyMs: null,
    routeRenderMs: null,
    trafficUpdateMs: null,
    riskCalculationMs: null,
    rerouteLatencyMs: null,
    lastUpdated: new Date().toISOString(),
  };

  private logHistory: MetricLogEntry[] = [];
  private readonly MAX_HISTORY = 100;
  private appStartTime = performance.now();

  /**
   * Records a timed latency metric and notifies listeners
   */
  public recordMetric(
    metric: keyof Omit<PerformanceMetrics, 'lastUpdated'>,
    durationMs: number,
    provider?: string,
    metadata?: Record<string, any>
  ): void {
    const rounded = Math.round(durationMs * 10) / 10;
    this.metrics[metric] = rounded;
    this.metrics.lastUpdated = new Date().toISOString();

    const entry: MetricLogEntry = {
      metric,
      durationMs: rounded,
      provider,
      metadata,
      timestamp: new Date().toISOString(),
    };

    this.logHistory.unshift(entry);
    if (this.logHistory.length > this.MAX_HISTORY) {
      this.logHistory.pop();
    }

    eventBus.emit('PERFORMANCE_METRIC_RECORDED', entry);
    if ((import.meta as any).env?.DEV) {
      console.log(`⚡ [PERF] ${String(metric)}: ${rounded} ms${provider ? ` (${provider})` : ''}`);
    }
  }

  /**
   * Helper to time an asynchronous operation
   */
  public async timeAsync<T>(
    metric: keyof Omit<PerformanceMetrics, 'lastUpdated'>,
    fn: () => Promise<T>,
    provider?: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const elapsed = performance.now() - start;
      this.recordMetric(metric, elapsed, provider, metadata);
      return result;
    } catch (err) {
      const elapsed = performance.now() - start;
      this.recordMetric(metric, elapsed, provider, { ...metadata, error: true });
      throw err;
    }
  }

  /**
   * Helper to time a synchronous operation
   */
  public timeSync<T>(
    metric: keyof Omit<PerformanceMetrics, 'lastUpdated'>,
    fn: () => T,
    provider?: string,
    metadata?: Record<string, any>
  ): T {
    const start = performance.now();
    try {
      const result = fn();
      const elapsed = performance.now() - start;
      this.recordMetric(metric, elapsed, provider, metadata);
      return result;
    } catch (err) {
      const elapsed = performance.now() - start;
      this.recordMetric(metric, elapsed, provider, { ...metadata, error: true });
      throw err;
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getHistory(): MetricLogEntry[] {
    return [...this.logHistory];
  }

  public getAppUptimeMs(): number {
    return Math.round(performance.now() - this.appStartTime);
  }
}

export const performanceDiagnosticsService = new PerformanceDiagnosticsService();
export default performanceDiagnosticsService;
