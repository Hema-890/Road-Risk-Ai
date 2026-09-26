// ==============================================================================
// ROADRISK AI — BACKGROUND INGESTION WORKERS
// Rate-limited, circuit-breaker-protected loops for continuous ingestion
// ==============================================================================

const ingestion = require('../ingestion/index.cjs');

class IngestionWorkerManager {
  constructor() {
    this.intervals = [];
    this.isRunning = false;
  }

  startAll() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Ingestion Workers] Starting continuous ingestion loops...');

    // 1. Weather Loop (Every 5 minutes)
    const weatherInterval = setInterval(async () => {
      try {
        // Ingest for primary monitored area (Vijayawada / AP region by default)
        await ingestion.openMeteo.run(16.5062, 80.6480);
      } catch (err) {
        console.warn('[Ingestion Worker] Weather sync notice:', err.message);
      }
    }, 300000);
    if (weatherInterval.unref) weatherInterval.unref();
    this.intervals.push(weatherInterval);

    // Initial immediate fetch for weather
    ingestion.openMeteo.run(16.5062, 80.6480).catch(() => {});

    // 2. Disaster Alert Loop (Every 10 minutes)
    const disasterInterval = setInterval(async () => {
      try {
        await ingestion.sachet.run();
      } catch (err) {
        console.warn('[Ingestion Worker] Disaster sync notice:', err.message);
      }
    }, 600000);
    if (disasterInterval.unref) disasterInterval.unref();
    this.intervals.push(disasterInterval);

    // 3. Traffic Incidents Loop (Every 60 seconds for active corridor/city bbox)
    const incidentInterval = setInterval(async () => {
      try {
        // Vijayawada - Guntur NH16 arterial corridor bounding box
        await ingestion.tomtomIncidents.run(80.50, 16.40, 80.75, 16.60);
      } catch (err) {
        console.warn('[Ingestion Worker] Incident sync notice:', err.message);
      }
    }, 60000);
    if (incidentInterval.unref) incidentInterval.unref();
    this.intervals.push(incidentInterval);

    // Initial fetch for incidents
    ingestion.tomtomIncidents.run(80.50, 16.40, 80.75, 16.60).catch(() => {});
  }

  stopAll() {
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    this.isRunning = false;
  }
}

const workerManager = new IngestionWorkerManager();
module.exports = { workerManager };
