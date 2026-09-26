// ==============================================================================
// ROADRISK AI — DATA NORMALIZATION LAYER
// Validates, sanitizes, and normalizes raw external provider data into canonical models
// ==============================================================================

function normalizeTomTomIncident(raw, observedAt = new Date().toISOString()) {
  const props = raw.properties || raw;
  const geometry = raw.geometry || null;
  const id = String(props.id || raw.id || `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  // Extract coordinates
  let lat = 0;
  let lng = 0;
  if (geometry && geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    [lng, lat] = geometry.coordinates;
  } else if (typeof props.latitude === 'number' && typeof props.longitude === 'number') {
    lat = props.latitude;
    lng = props.longitude;
  } else if (Array.isArray(props.point)) {
    [lat, lng] = props.point;
  }

  // Category mapping
  const iconCategory = props.iconCategory;
  let category = 'HAZARD';
  let type = 'INCIDENT';

  const desc = (props.events?.[0]?.description || props.description || '').toLowerCase();
  if (desc.includes('flood') || desc.includes('waterlogging') || iconCategory === 11) {
    category = 'FLOODING';
  } else if (desc.includes('closure') || desc.includes('closed') || iconCategory === 8) {
    category = 'ROAD_CLOSURE';
    type = 'CLOSURE';
  } else if (desc.includes('accident') || desc.includes('crash') || iconCategory === 1) {
    category = 'ACCIDENT';
    type = 'ACCIDENT';
  } else if (desc.includes('roadworks') || desc.includes('work') || iconCategory === 9) {
    category = 'ROAD_WORKS';
    type = 'ROAD_WORKS';
  } else if (desc.includes('jam') || desc.includes('congestion') || iconCategory === 6) {
    category = 'CONGESTION';
    type = 'CONGESTION';
  }

  // Severity mapping
  const magnitude = props.magnitudeOfDelay ?? 0;
  let severity = 'low';
  if (category === 'ROAD_CLOSURE' || category === 'FLOODING' || magnitude === 3) {
    severity = 'critical';
  } else if (magnitude === 2) {
    severity = 'high';
  } else if (magnitude === 1) {
    severity = 'moderate';
  }

  return {
    incident_id: id,
    provider_id: 'tomtom',
    type,
    category,
    severity,
    road_name: props.roadNumbers?.[0] || props.from || props.roadName || 'Roadway',
    from_location: props.from || null,
    to_location: props.to || null,
    latitude: lat,
    longitude: lng,
    geometry_json: geometry,
    delay_seconds: props.delay || 0,
    length_meters: props.length || 0,
    start_time: props.startTime || null,
    end_time: props.endTime || null,
    number_of_reports: props.numberOfReports || 1,
    last_report_time: props.lastReportTime || null,
    source: 'TomTom Live Incidents',
    observed_at: observedAt,
    received_at: new Date().toISOString(),
    status: 'LIVE',
  };
}

function normalizeTomTomFlow(raw, lat, lng, observedAt = new Date().toISOString()) {
  const flow = raw.flowSegmentData || raw;
  const currentSpeed = flow.currentSpeed ?? flow.freeFlowSpeed ?? 40;
  const freeFlowSpeed = flow.freeFlowSpeed ?? 40;
  const confidence = flow.confidence ?? 1.0;
  const coordinates = flow.coordinates?.coordinate || [];

  const trafficRatio = freeFlowSpeed > 0 ? currentSpeed / freeFlowSpeed : 1.0;

  let congestionLevel = 'free';
  if (flow.roadClosure) {
    congestionLevel = 'severe';
  } else if (trafficRatio < 0.35) {
    congestionLevel = 'severe';
  } else if (trafficRatio < 0.60) {
    congestionLevel = 'heavy';
  } else if (trafficRatio < 0.85) {
    congestionLevel = 'moderate';
  }

  return {
    segment_id: `seg_${lat.toFixed(4)}_${lng.toFixed(4)}`,
    road_name: flow.roadName || 'Arterial Road',
    latitude: lat,
    longitude: lng,
    current_speed: currentSpeed,
    free_flow_speed: freeFlowSpeed,
    traffic_ratio: Math.round(trafficRatio * 100) / 100,
    congestion_level: congestionLevel,
    confidence,
    coordinates_json: coordinates.map(c => [c.longitude, c.latitude]),
    source: 'TomTom Traffic Flow',
    observed_at: observedAt,
    received_at: new Date().toISOString(),
    status: 'LIVE',
  };
}

function normalizeWeather(raw, lat, lng, source = 'Open-Meteo') {
  const current = raw.current || raw;
  const temp = current.temperature_2m ?? current.temperature ?? null;
  const precip = current.precipitation ?? current.rain ?? 0;
  const wind = current.wind_speed_10m ?? current.wind_speed ?? 0;
  const weatherCode = current.weather_code ?? 0;

  let label = 'Clear';
  if (precip > 10) label = 'Heavy Rain';
  else if (precip > 2) label = 'Moderate Rain';
  else if (precip > 0) label = 'Light Rain';
  else if (weatherCode >= 95) label = 'Thunderstorm';
  else if (weatherCode >= 61) label = 'Rain';
  else if (weatherCode >= 51) label = 'Drizzle';
  else if (weatherCode >= 1 && weatherCode <= 3) label = 'Partly Cloudy';

  return {
    id: `wx_${lat.toFixed(3)}_${lng.toFixed(3)}`,
    latitude: lat,
    longitude: lng,
    temperature_c: temp,
    precipitation_mm: precip,
    wind_speed_kmh: wind,
    visibility_meters: current.visibility ?? 10000,
    weather_code: weatherCode,
    condition_label: label,
    source,
    observed_at: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
    received_at: new Date().toISOString(),
    status: 'LIVE',
  };
}

function normalizeSachetAlert(raw) {
  const id = raw.id || raw.identifier || `alert_${Date.now()}`;
  return {
    alert_id: id,
    source: 'NDMA SACHET',
    category: (raw.category || raw.event || 'hazard').toLowerCase(),
    severity: (raw.severity || 'high').toLowerCase(),
    headline: raw.headline || raw.title || 'Official Disaster Advisory',
    description: raw.description || '',
    official_reference: raw.source || 'NDMA India',
    affected_geometry_json: raw.geometry || null,
    issued_at: raw.sent || raw.issued_at || new Date().toISOString(),
    effective_from: raw.effective || new Date().toISOString(),
    expires_at: raw.expires || new Date(Date.now() + 86400000).toISOString(),
    status: 'ACTIVE',
  };
}

module.exports = {
  normalizeTomTomIncident,
  normalizeTomTomFlow,
  normalizeWeather,
  normalizeSachetAlert,
};
