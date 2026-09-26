// ==============================================================================
// ROADRISK AI — CENTRAL REALTIME EVENT BUS (SERVER)
// Strict event provenance and type contracts as defined in Requirement 5 & 6
// ==============================================================================

const EventEmitter = require('node:events');
const crypto = require('node:crypto');

const VALID_EVENT_TYPES = new Set([
  'GPS_UPDATED',
  'TRAFFIC_UPDATED',
  'TRAFFIC_FLOW_UPDATED',
  'TRAFFIC_INCIDENT_CREATED',
  'TRAFFIC_INCIDENT_UPDATED',
  'TRAFFIC_INCIDENT_EXPIRED',
  'WEATHER_UPDATED',
  'FLOOD_UPDATED',
  'DISASTER_ALERT_CREATED',
  'DISASTER_ALERT_UPDATED',
  'ROAD_CLOSURE_UPDATED',
  'ROAD_WORK_UPDATED',
  'TRANSIT_UPDATED',
  'TRANSIT_VEHICLE_UPDATED',
  'EMERGENCY_VEHICLE_UPDATED',
  'EMERGENCY_VEHICLE_APPROACHING',
  'USER_HAZARD_REPORTED',
  'USER_HAZARD_VERIFIED',
  'USER_HAZARD_EXPIRED',
  'ROAD_RISK_UPDATED',
  'ROUTE_CALCULATED',
  'ROUTE_INVALIDATED',
  'ROUTE_REROUTED',
  'FUEL_STATION_UPDATED',
  'NEARBY_SERVICE_UPDATED',
  'DATA_SOURCE_STATUS_CHANGED',
  'OFFLINE_MODE_ENTERED',
  'ONLINE_MODE_RESTORED',
]);

const VALID_STATUSES = new Set([
  'LIVE',
  'STALE',
  'UNAVAILABLE',
  'ERROR',
  'MODEL',
  'REPORTED',
  'HISTORICAL',
  'SCHEDULED',
  'SIMULATED',
]);

class ServerEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.history = [];
    this.maxHistory = 500;
    this.sseClients = new Set();
  }

  /**
   * Publishes a canonical event to all internal listeners and SSE client streams
   */
  publish(event) {
    const received_at = new Date().toISOString();
    const event_id = event.event_id || `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const event_type = event.event_type;

    if (!VALID_EVENT_TYPES.has(event_type)) {
      console.warn(`[EventBus] Warning: Non-canonical event_type: ${event_type}`);
    }

    const status = VALID_STATUSES.has(event.status) ? event.status : 'LIVE';

    const canonicalEvent = {
      event_id,
      event_type,
      source: event.source || 'RoadRisk AI Core',
      observed_at: event.observed_at || received_at,
      received_at,
      geometry: event.geometry || null,
      road_segment_id: event.road_segment_id || null,
      confidence: typeof event.confidence === 'number' ? event.confidence : 1.0,
      freshness: event.freshness || 'LIVE',
      status,
      payload: event.payload || {},
      expires_at: event.expires_at || new Date(Date.now() + 300000).toISOString(),
    };

    // Keep history ring buffer
    this.history.push(canonicalEvent);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Emit typed and wildcard
    this.emit(event_type, canonicalEvent);
    this.emit('*', canonicalEvent);

    // Broadcast to SSE clients
    this.broadcastToSse(canonicalEvent);

    return canonicalEvent;
  }

  registerSseClient(res) {
    this.sseClients.add(res);
    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  broadcastToSse(event) {
    const ssePayload = `event: ${event.event_type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(ssePayload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  getRecentHistory(eventType = null, limit = 50) {
    let list = this.history;
    if (eventType) {
      list = list.filter(e => e.event_type === eventType);
    }
    return list.slice(-limit);
  }
}

const serverEventBus = new ServerEventBus();
module.exports = { serverEventBus, ServerEventBus, VALID_EVENT_TYPES, VALID_STATUSES };
