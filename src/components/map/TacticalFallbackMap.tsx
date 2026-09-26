import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { RiskSegment, HazardAlert } from '../../types';
import {
  AlertTriangle,
  RotateCw,
  Navigation,
  Compass,
  Maximize2,
  Globe,
  MapPin,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { WebGLDiagnostic } from '../../utils/webglDetect';
import { CITY_PRESETS } from '../../data/mockScenarios';

interface TacticalFallbackMapProps {
  diagnostic: WebGLDiagnostic | null;
  onRetry: () => void;
  onSelectSegment: (segment: RiskSegment) => void;
  onSelectHazard: (hazard: HazardAlert) => void;
}

export const TacticalFallbackMap: React.FC<TacticalFallbackMapProps> = ({
  diagnostic,
  onRetry,
  onSelectSegment,
  onSelectHazard,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Markers and layers refs
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLayersRef = useRef<L.LayerGroup | null>(null);
  const hazardMarkersRef = useRef<L.LayerGroup | null>(null);
  const signalMarkersRef = useRef<L.LayerGroup | null>(null);

  const {
    cameraMode,
    setCameraMode,
    mapFocusCoords,
    mapFocusZoom,
    telemetry,
    selectedRoute,
    routes,
    selectedVehicle,
    activeHazards,
    greenCorridor,
    currentMission,
    currentCityId,
    changeCityPreset,
  } = useApp();

  const [mapTileSource, setMapTileSource] = useState<'carto_dark' | 'osm' | 'carto_light'>('carto_dark');
  const [showEngineBanner, setShowEngineBanner] = useState(true);

  // Color mapper based on segment risk index (0 - 100)
  const getRiskColor = (score: number) => {
    if (score >= 81) return '#f43f5e'; // Critical Crimson
    if (score >= 61) return '#fb7185'; // High Red
    if (score >= 41) return '#f59e0b'; // Elevated Amber
    if (score >= 21) return '#eab308'; // Moderate Yellow
    return '#10b981'; // Safe Green
  };

  // 1. Initialize Real World Leaflet Map
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const startCoords: [number, number] = [
      currentMission.originCoords[1], // latitude
      currentMission.originCoords[0], // longitude
    ];

    const map = L.map(containerRef.current, {
      center: startCoords,
      zoom: 13.8,
      zoomControl: false,
      attributionControl: true,
      maxZoom: 19,
      minZoom: 1,
    });

    // Add Tile Layer
    const tileUrl =
      mapTileSource === 'osm'
        ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        : mapTileSource === 'carto_light'
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    const tileLayer = L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Create Layer Groups
    routeLayersRef.current = L.layerGroup().addTo(map);
    hazardMarkersRef.current = L.layerGroup().addTo(map);
    signalMarkersRef.current = L.layerGroup().addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Switch Tile Layer dynamically
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    const tileUrl =
      mapTileSource === 'osm'
        ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        : mapTileSource === 'carto_light'
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    mapRef.current.removeLayer(tileLayerRef.current);
    const newLayer = L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(mapRef.current);
    tileLayerRef.current = newLayer;
  }, [mapTileSource]);

  // 3. Render Route Polylines
  useEffect(() => {
    const map = mapRef.current;
    const group = routeLayersRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // A. Render Alternative Routes (dashed blue/gray)
    routes.forEach((route) => {
      if (route.id === selectedRoute?.id) return;
      const latLngs = route.fullCoordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      const poly = L.polyline(latLngs, {
        color: '#38bdf8',
        weight: 3,
        dashArray: '6, 8',
        opacity: 0.55,
      });
      poly.bindTooltip(
        `<div style="font-size:11px;font-weight:600;color:#0ea5e9;">${route.name} (${route.distanceKm}km • ETA ${route.adjustedEtaMinutes}m)</div>`,
        { sticky: true }
      );
      poly.addTo(group);
    });

    if (!selectedRoute) return;

    // B. Render Active Route Glow
    const activeLatLngs = selectedRoute.fullCoordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    if (activeLatLngs.length > 0) {
      L.polyline(activeLatLngs, {
        color: '#06b6d4',
        weight: 9,
        opacity: 0.28,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);
    }

    // C. Render Active Route Segments with Risk Colors
    if (selectedRoute.segments && selectedRoute.segments.length > 0) {
      selectedRoute.segments.forEach((segment) => {
        const segLatLngs = segment.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
        const color = getRiskColor(segment.riskScore);

        const segPoly = L.polyline(segLatLngs, {
          color,
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        });

        segPoly.on('click', () => {
          onSelectSegment(segment);
        });

        segPoly.bindTooltip(
          `<div style="padding:2px 4px;font-size:11px;">
            <strong style="color:${color}">${segment.name}</strong><br/>
            Risk Score: <strong>${segment.riskScore}/100</strong> (${segment.riskLevel})<br/>
            Hard Brakings: ${segment.hardBrakingCount} | Road Width: ${segment.roadWidthMeters}m
          </div>`,
          { sticky: true }
        );

        segPoly.addTo(group);
      });
    } else {
      // Direct polyline fallback
      L.polyline(activeLatLngs, {
        color: '#10b981',
        weight: 5,
        opacity: 0.9,
      }).addTo(group);
    }
  }, [routes, selectedRoute, onSelectSegment]);

  // 4. Update Origin and Destination Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Origin
    if (originMarkerRef.current) {
      originMarkerRef.current.remove();
    }
    const originIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;">
          <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(16,185,129,0.25);animation:pulse 1.8s infinite;"></div>
          <div style="width:20px;height:20px;border-radius:50%;background:#10b981;border:2.5px solid #ffffff;box-shadow:0 0 10px rgba(16,185,129,0.8);display:flex;align-items:center;justify-content:center;color:#000;font-size:10px;font-weight:900;">
            A
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    originMarkerRef.current = L.marker([currentMission.originCoords[1], currentMission.originCoords[0]], {
      icon: originIcon,
      zIndexOffset: 500,
    }).addTo(map);
    originMarkerRef.current.bindTooltip(`<strong>ORIGIN DISPATCH:</strong><br/>${currentMission.origin}`);

    // Destination
    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
    }
    const destIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;">
          <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(244,63,94,0.3);animation:pulse 1.4s infinite;"></div>
          <div style="width:22px;height:22px;border-radius:50%;background:#f43f5e;border:2.5px solid #ffffff;box-shadow:0 0 12px rgba(244,63,94,0.9);display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:11px;font-weight:900;">
            H
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    if (currentMission.destinationCoords) {
      destMarkerRef.current = L.marker([currentMission.destinationCoords[1], currentMission.destinationCoords[0]], {
        icon: destIcon,
        zIndexOffset: 500,
      }).addTo(map);
      destMarkerRef.current.bindTooltip(`<strong>DESTINATION TRAUMA CENTER:</strong><br/>${currentMission.destination}`);
    }
  }, [currentMission.originCoords, currentMission.destinationCoords, currentMission.origin, currentMission.destination]);

  // 5. Update Vehicle Marker & Rotation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const lat = telemetry.currentCoordinates[1];
    const lng = telemetry.currentCoordinates[0];
    const heading = telemetry.headingDegrees || 0;

    if (!vehicleMarkerRef.current) {
      const vehicleIcon = L.divIcon({
        className: 'custom-leaflet-vehicle-marker',
        html: `
          <div id="leaflet-tactical-vehicle-wrapper" style="transform: rotate(${heading}deg); transition: transform 0.2s linear; display:flex; align-items:center; justify-content:center; width:44px; height:44px;">
            <div style="position:absolute; width:42px; height:42px; border-radius:50%; background:rgba(6,182,212,0.25); animation:pulse 1.2s infinite;"></div>
            <div style="width:26px; height:26px; border-radius:50%; background:#0284c7; border:2.5px solid #38bdf8; box-shadow:0 0 14px rgba(56,189,248,0.9); display:flex; align-items:center; justify-content:center; color:#ffffff;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
              </svg>
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      vehicleMarkerRef.current = L.marker([lat, lng], {
        icon: vehicleIcon,
        zIndexOffset: 1000,
      }).addTo(map);
      vehicleMarkerRef.current.bindTooltip(
        `<strong>${selectedVehicle.callsign}</strong><br/>${selectedVehicle.name}<br/>Speed: ${Math.round(telemetry.speedKmh)} km/h`
      );
    } else {
      vehicleMarkerRef.current.setLatLng([lat, lng]);
      const elem = document.getElementById('leaflet-tactical-vehicle-wrapper');
      if (elem) {
        elem.style.transform = `rotate(${heading}deg)`;
      }
    }

    // If in cockpit pursuit mode during navigation, keep vehicle centered
    if (cameraMode === 'cockpit' && currentMission.status === 'EN_ROUTE') {
      map.panTo([lat, lng], { animate: true, duration: 0.4 });
    }
  }, [telemetry.currentCoordinates, telemetry.headingDegrees, telemetry.speedKmh, selectedVehicle, cameraMode, currentMission.status]);

  // 6. Update Hazard Markers
  useEffect(() => {
    const map = mapRef.current;
    const group = hazardMarkersRef.current;
    if (!map || !group) return;

    group.clearLayers();

    activeHazards.forEach((hazard) => {
      const isCritical = hazard.severity === 'critical';
      const color = isCritical ? '#ef4444' : '#f59e0b';

      const hazardIcon = L.divIcon({
        className: 'custom-leaflet-hazard-marker',
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;cursor:pointer;">
            <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:${isCritical ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'};animation:pulse 1.1s infinite;"></div>
            <div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 0 10px ${color};display:flex;align-items:center;justify-content:center;color:#000;font-size:12px;font-weight:900;">
              !
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([hazard.coordinates[1], hazard.coordinates[0]], {
        icon: hazardIcon,
        zIndexOffset: 800,
      });

      marker.on('click', () => {
        onSelectHazard(hazard);
      });

      marker.bindTooltip(
        `<div style="font-size:11px;max-width:200px;">
          <strong style="color:${color}">${hazard.title}</strong><br/>
          Location: ${hazard.locationName}<br/>
          Impact: +${hazard.riskImpactPoints} Risk Points
        </div>`
      );

      marker.addTo(group);
    });
  }, [activeHazards, onSelectHazard]);

  // 7. Update Green Corridor Signal Markers
  useEffect(() => {
    const map = mapRef.current;
    const group = signalMarkersRef.current;
    if (!map || !group) return;

    group.clearLayers();

    greenCorridor.signals.forEach((sig) => {
      const isGreen = sig.state === 'GREEN_LOCKED';
      const isYellow = sig.state === 'PREPARING_YELLOW';
      const color = isGreen ? '#10b981' : isYellow ? '#f59e0b' : '#64748b';

      const sigIcon = L.divIcon({
        className: 'custom-leaflet-signal-marker',
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;">
            <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 0 8px ${color};"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([sig.coordinates[1], sig.coordinates[0]], {
        icon: sigIcon,
        zIndexOffset: 600,
      });

      marker.bindTooltip(
        `<div style="font-size:11px;">
          <strong>${sig.intersectionName}</strong><br/>
          Signal State: <span style="color:${color};font-weight:700;">${sig.state}</span>
        </div>`
      );

      marker.addTo(group);
    });
  }, [greenCorridor.signals]);

  // 8. Handle camera focus requests from AppContext (e.g. hotspot click, vehicle locate)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapFocusCoords) return;
    map.flyTo([mapFocusCoords[1], mapFocusCoords[0]], mapFocusZoom, {
      duration: 1.2,
    });
  }, [mapFocusCoords, mapFocusZoom]);

  // Quick Navigation Controls
  const handleZoomToWorld = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([20, 20], 2, { duration: 1.5 });
  };

  const handleZoomToIndia = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([20.5937, 78.9629], 5, { duration: 1.2 });
  };

  const handleFitRouteBounds = () => {
    if (!mapRef.current || !selectedRoute) return;
    const coords = selectedRoute.fullCoordinates;
    if (coords.length === 0) return;
    const bounds = L.latLngBounds(coords.map(([lng, lat]) => [lat, lng]));
    mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  };

  const handleSnapToVehicle = () => {
    if (!mapRef.current) return;
    const lat = telemetry.currentCoordinates[1];
    const lng = telemetry.currentCoordinates[0];
    mapRef.current.flyTo([lat, lng], 16.5, { duration: 0.8 });
    setCameraMode('cockpit');
  };

  return (
    <div className="map-viewport-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 100% Real World Leaflet Map Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#080c14' }} />

      {/* Global Real-World Engine Status Banner */}
      {showEngineBanner && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            background: 'rgba(8, 14, 26, 0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 8,
            padding: '7px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontSize: 12,
            color: '#e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            <strong style={{ color: '#38bdf8' }}>REAL WORLD GLOBAL MAP ACTIVE</strong>
            <span style={{ color: '#94a3b8' }}>•</span>
            <span style={{ color: '#cbd5e1' }}>Worldwide tiles, streets & coordinates verified</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={onRetry}
              style={{
                background: 'rgba(14, 165, 233, 0.2)',
                border: '1px solid rgba(14, 165, 233, 0.5)',
                color: '#38bdf8',
                borderRadius: 4,
                padding: '3px 8px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Test MapLibre WebGL 3D mode"
            >
              <RotateCw size={12} />
              <span>Test WebGL Mode</span>
            </button>

            <button
              onClick={() => setShowEngineBanner(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 4px',
              }}
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Floating Tactical Camera & World Navigation HUD */}
      <div className="map-hud-controls" style={{ zIndex: 1050 }}>
        {/* City Quick Switcher */}
        <select
          value={currentCityId}
          onChange={(e) => changeCityPreset(e.target.value)}
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            outline: 'none',
          }}
          title="Select Real-World Metropolitan Region"
        >
          {Object.values(CITY_PRESETS).map((c) => (
            <option key={c.id} value={c.id} style={{ background: '#0f172a', color: '#fff' }}>
              📍 {c.name} ({c.stateCountry.split(',')[0]})
            </option>
          ))}
        </select>

        {/* World Zoom Out Button */}
        <button className="hud-btn" onClick={handleZoomToWorld} title="Zoom out to Global World View">
          <Globe size={15} />
          <span>World</span>
        </button>

        {/* India Regional Focus */}
        <button className="hud-btn" onClick={handleZoomToIndia} title="Focus India Geography">
          <MapPin size={15} />
          <span>India</span>
        </button>

        {/* Fit Active Route Bounds */}
        <button className="hud-btn" onClick={handleFitRouteBounds} title="Fit Entire Emergency Route">
          <Compass size={15} />
          <span>Fit Route</span>
        </button>

        {/* Snap Vehicle */}
        <button className="hud-btn active" onClick={handleSnapToVehicle} title="Snap to Emergency Vehicle">
          <Maximize2 size={15} />
          <span>Snap</span>
        </button>

        {/* Tile Style Switcher */}
        <button
          className="hud-btn"
          onClick={() =>
            setMapTileSource((curr) =>
              curr === 'carto_dark' ? 'osm' : curr === 'osm' ? 'carto_light' : 'carto_dark'
            )
          }
          title="Toggle Tile Style (Dark / OSM / Light)"
        >
          <Layers size={15} />
          <span>
            {mapTileSource === 'carto_dark' ? 'Dark' : mapTileSource === 'osm' ? 'OSM' : 'Light'}
          </span>
        </button>
      </div>

      {/* Segment Risk Index Legend */}
      <div className="map-risk-legend" style={{ zIndex: 1050 }}>
        <div className="legend-title">REAL SEGMENT RISK INDEX (0–100)</div>
        <div className="legend-bar">
          <div className="legend-step" style={{ background: '#10b981' }}>
            <span>0-20 Low</span>
          </div>
          <div className="legend-step" style={{ background: '#eab308' }}>
            <span>21-40 Mod</span>
          </div>
          <div className="legend-step" style={{ background: '#f59e0b' }}>
            <span>41-60 Elev</span>
          </div>
          <div className="legend-step" style={{ background: '#f43f5e' }}>
            <span>61-100 Crit</span>
          </div>
        </div>
      </div>
    </div>
  );
};
