import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { RiskSegment, HazardAlert } from '../../types';
import { MapPin, Navigation, ShieldAlert, Layers, Compass, Crosshair, PlusCircle, Plus, Minus } from 'lucide-react';

interface LeafletMapViewProps {
  onMapClickLocation?: (coords: [number, number]) => void;
  selectionMode?: 'none' | 'origin' | 'destination' | 'report_hazard';
  onOpenReportModal?: (coords: [number, number]) => void;
}

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  onMapClickLocation,
  selectionMode = 'none',
  onOpenReportModal,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layers and markers refs
  const routePolylinesLayerRef = useRef<L.FeatureGroup | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const hazardMarkersLayerRef = useRef<L.FeatureGroup | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);

  const [selectedSegment, setSelectedSegment] = useState<RiskSegment | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([17.41, 78.46]);
  const [followAmbulance, setFollowAmbulance] = useState<boolean>(false);

  const {
    currentCityId,
    selectedRoute,
    routes,
    telemetry,
    activeHazards,
    currentMission,
    mapTileStyle,
    setMapTileStyle,
    manualHazardReports,
  } = useApp();

  // Determine segment color based on risk score (0 - 100)
  const getRiskColor = (score: number): string => {
    if (score >= 81) return '#ef4444'; // Red - Critical
    if (score >= 61) return '#f97316'; // Orange - High
    if (score >= 31) return '#eab308'; // Yellow - Moderate
    return '#10b981'; // Green - Low
  };

  // 1. Initialize Leaflet Map instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = currentMission.originCoords ? currentMission.originCoords[1] : 17.385;
      const initialLng = currentMission.originCoords ? currentMission.originCoords[0] : 78.486;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true, // Phase 13: Normal mouse wheel zoom
        dragging: true,        // Phase 13: Drag pan
        touchZoom: true,       // Phase 13: Pinch zoom
      });

      // When user manually drags/pans map, cancel follow ambulance to prevent camera fighting
      map.on('dragstart', () => {
        setFollowAmbulance(false);
      });

      // Attribution
      map.attributionControl.setPrefix(
        '<a href="https://leafletjs.com" target="_blank">Leaflet</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      );

      // Tile Layer (MapTiler Streets or Fallback)
      const maptilerKey = (import.meta as any).env?.VITE_MAPTILER_API_KEY || (import.meta as any).env?.VITE_MAPTILER_KEY;
      const tileUrl =
        maptilerKey && !maptilerKey.includes('placeholder')
          ? `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${maptilerKey}`
          : mapTileStyle === 'osm_standard'
          ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: maptilerKey ? '' : 'abcd',
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Add feature groups
      const routeGroup = L.featureGroup().addTo(map);
      const hazardGroup = L.featureGroup().addTo(map);
      routePolylinesLayerRef.current = routeGroup;
      hazardMarkersLayerRef.current = hazardGroup;

      // Critical: Normal Map Click does NOTHING unexpected.
      // Do NOT trigger Report Hazard modal on empty map clicks.
      map.on('click', (e: L.LeafletMouseEvent) => {
        const coords: [number, number] = [parseFloat(e.latlng.lng.toFixed(6)), parseFloat(e.latlng.lat.toFixed(6))];
        if (selectionMode !== 'none' && onMapClickLocation) {
          onMapClickLocation(coords);
        }
      });

      map.on('moveend', () => {
        const c = map.getCenter();
        setMapCenter([parseFloat(c.lat.toFixed(4)), parseFloat(c.lng.toFixed(4))]);
      });

      mapInstanceRef.current = map;
    }
  }, []);

  // Update tile style when user toggles
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const tileUrl =
      mapTileStyle === 'osm_standard'
        ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTileLayer;
  }, [mapTileStyle]);

  // Center on Origin when city or mission changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (currentMission.originCoords) {
      const [lng, lat] = currentMission.originCoords;
      mapInstanceRef.current.setView([lat, lng], 13);
    }
  }, [currentCityId, currentMission.originCoords]);

  // 2. Render Origin and Destination Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (originMarkerRef.current) {
      map.removeLayer(originMarkerRef.current);
      originMarkerRef.current = null;
    }
    if (destMarkerRef.current) {
      map.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }

    if (currentMission.originCoords) {
      const [lng, lat] = currentMission.originCoords;
      const originIcon = L.divIcon({
        className: 'custom-origin-icon',
        html: `
          <div style="position:relative; display:flex; align-items:center; justify-content:center; width:34px; height:34px; background:#0ea5e9; border:2px solid #fff; border-radius:50%; box-shadow:0 0 15px rgba(14,165,233,0.8);">
            <span style="color:#fff; font-size:16px; font-weight:bold;">H</span>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      originMarkerRef.current = L.marker([lat, lng], { icon: originIcon })
        .bindPopup(`<b>Origin Hub:</b><br/>${currentMission.origin}`)
        .addTo(map);
    }

    if (currentMission.destinationCoords) {
      const [lng, lat] = currentMission.destinationCoords;
      const destIcon = L.divIcon({
        className: 'custom-dest-icon',
        html: `
          <div style="position:relative; display:flex; align-items:center; justify-content:center; width:34px; height:34px; background:#ef4444; border:2px solid #fff; border-radius:50%; box-shadow:0 0 15px rgba(239,68,68,0.8); animation:pulse 1.5s infinite;">
            <span style="color:#fff; font-size:14px; font-weight:bold;">📍</span>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      destMarkerRef.current = L.marker([lat, lng], { icon: destIcon })
        .bindPopup(`<b>Emergency Incident Destination:</b><br/>${currentMission.destination}`)
        .addTo(map);
    }
  }, [currentMission.originCoords, currentMission.destinationCoords, currentMission.origin, currentMission.destination]);

  // 3. Render Route Polylines with Risk Coloring
  useEffect(() => {
    if (!mapInstanceRef.current || !routePolylinesLayerRef.current) return;
    const layer = routePolylinesLayerRef.current;
    layer.clearLayers();

    // First render unselected/alternative routes in dim translucent style
    routes.forEach((route) => {
      if (route.id !== selectedRoute?.id) {
        const latLngs: L.LatLngTuple[] = route.fullCoordinates.map(([lng, lat]) => [lat, lng]);
        const altPolyline = L.polyline(latLngs, {
          color: '#64748b',
          weight: 4,
          opacity: 0.45,
          dashArray: '6, 8',
        });
        altPolyline.bindTooltip(`${route.name} (${route.distanceKm} km · ${route.adjustedEtaMinutes} min · Risk ${route.riskScore}/100)`);
        layer.addLayer(altPolyline);
      }
    });

    // Render active route with Risk-Colored Segments
    if (selectedRoute) {
      // Glow underlay
      const fullLatLngs: L.LatLngTuple[] = selectedRoute.fullCoordinates.map(([lng, lat]) => [lat, lng]);
      const glowLine = L.polyline(fullLatLngs, {
        color: '#38bdf8',
        weight: 9,
        opacity: 0.25,
      });
      layer.addLayer(glowLine);

      // Segments
      if (selectedRoute.segments && selectedRoute.segments.length > 0) {
        selectedRoute.segments.forEach((seg) => {
          const segLatLngs: L.LatLngTuple[] = seg.coordinates.map(([lng, lat]) => [lat, lng]);
          const color = getRiskColor(seg.riskScore);

          const poly = L.polyline(segLatLngs, {
            color,
            weight: 6,
            opacity: 0.95,
          });

          // Popup content
          const popupContent = `
            <div style="font-family:ui-sans-serif,system-ui; color:#0f172a; min-width:220px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <b style="font-size:14px;">${seg.name}</b>
                <span style="background:${color}; color:#fff; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:bold;">
                  ${seg.riskLevel} (${seg.riskScore}/100)
                </span>
              </div>
              <div style="font-size:12px; color:#475569; margin-bottom:8px;">
                <b>Events detected:</b> ${seg.hardBrakingCount} hard brakes, ${seg.suddenSlowdownsCount} slowdowns<br/>
                <b>Traffic:</b> ${seg.trafficDensity} | <b>Surface:</b> ${seg.surfaceCondition}
              </div>
              <div style="background:#f1f5f9; padding:6px; border-radius:6px; font-size:11px; color:#1e293b;">
                <b>Action:</b> ${seg.riskScore >= 60 ? '⚠️ High risk: Alternative corridor recommended' : 'Nominal corridor status'}
              </div>
            </div>
          `;

          poly.bindPopup(popupContent);
          poly.on('click', () => {
            setSelectedSegment(seg);
          });

          layer.addLayer(poly);
        });
      } else {
        // Single polyline if no segmented partitions
        const mainPoly = L.polyline(fullLatLngs, {
          color: getRiskColor(selectedRoute.riskScore),
          weight: 6,
          opacity: 0.9,
        });
        layer.addLayer(mainPoly);
      }

      // Auto-fit bounds if first load or changed
      if (fullLatLngs.length > 1) {
        const bounds = L.latLngBounds(fullLatLngs);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [selectedRoute, routes]);

  // 4. Render Hazard Markers (Active hazards + Manual reports)
  useEffect(() => {
    if (!mapInstanceRef.current || !hazardMarkersLayerRef.current) return;
    const layer = hazardMarkersLayerRef.current;
    layer.clearLayers();

    // Built-in hazards
    activeHazards.forEach((hazard) => {
      if (!hazard.active) return;
      const [lng, lat] = hazard.coordinates;
      const markerHtml = `
        <div style="position:relative; width:30px; height:30px; background:#f43f5e; border:2px solid #fff; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 12px rgba(244,63,94,0.9); animation:bounce 2s infinite;">
          <span style="color:#fff; font-size:14px; font-weight:bold;">⚠️</span>
        </div>
      `;
      const icon = L.divIcon({
        className: 'hazard-div-icon',
        html: markerHtml,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const popupHtml = `
        <div style="min-width:210px; font-family:Inter,system-ui,sans-serif; color:#0f172a; padding:2px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <span style="background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; letter-spacing:0.5px;">⚠️ HIGH RISK</span>
            <span style="font-size:10px; color:#64748b;">Live Active</span>
          </div>
          <b style="color:#0f172a; font-size:13px; display:block; margin-bottom:3px;">${hazard.title}</b>
          <p style="margin:0 0 8px; font-size:11.5px; color:#475569; line-height:1.4;">${hazard.description}</p>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:5px 8px; border-radius:6px; font-size:11px; color:#334155; display:flex; justify-content:space-between; align-items:center;">
            <span>Severity: <b style="color:#ef4444;">HIGH</b></span>
            <span style="color:#b91c1c; font-weight:700;">+${hazard.riskImpactPoints} Risk pts</span>
          </div>
        </div>
      `;

      const m = L.marker([lat, lng], { icon }).bindPopup(popupHtml);
      layer.addLayer(m);
    });

    // Manual hazard reports
    if (manualHazardReports && manualHazardReports.length > 0) {
      manualHazardReports.forEach((report) => {
        const [lng, lat] = report.coordinates;
        const icon = L.divIcon({
          className: 'manual-hazard-icon',
          html: `
            <div style="width:28px; height:28px; background:#eab308; border:2px solid #0b0f17; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 10px rgba(234,179,8,0.8);">
              <span style="font-size:12px;">📍</span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const popup = `
          <div style="font-family:Inter,system-ui,sans-serif; min-width:200px; padding:2px; color:#0f172a;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
              <span style="background:rgba(234,179,8,0.15); color:#b45309; border:1px solid rgba(234,179,8,0.4); font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; text-transform:uppercase;">
                ${report.category.replace('_', ' ')}
              </span>
              <span style="font-size:10px; color:#64748b;">${report.reportedAt}</span>
            </div>
            <b style="color:#0f172a; font-size:13px; display:block; margin-bottom:3px;">${report.title}</b>
            <p style="font-size:11.5px; margin:0 0 6px; color:#475569; line-height:1.4;">${report.description}</p>
            <div style="font-size:10px; color:#64748b;">Reported by: ${report.reportedBy}</div>
          </div>
        `;
        layer.addLayer(L.marker([lat, lng], { icon }).bindPopup(popup));
      });
    }
  }, [activeHazards, manualHazardReports]);

  // 5. Render Moving Ambulance Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!telemetry || !telemetry.currentCoordinates) return;
    const [lng, lat] = telemetry.currentCoordinates;
    const heading = telemetry.headingDegrees || 0;

    if (!vehicleMarkerRef.current) {
      const ambIcon = L.divIcon({
        className: 'ambulance-pulse-icon',
        html: `
          <div id="amb-marker-inner" style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; width:100%; height:100%; background:rgba(239,68,68,0.35); border-radius:50%; animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="width:32px; height:32px; background:#0b0f17; border:2px solid #ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 15px rgba(239,68,68,0.9); transform:rotate(${heading}deg);">
              <span style="font-size:18px;">🚑</span>
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([lat, lng], { icon: ambIcon, zIndexOffset: 1000 }).addTo(map);
      marker.bindPopup(`<b>Emergency Vehicle En Route</b><br/>Speed: ${telemetry.speedKmh} km/h`);
      vehicleMarkerRef.current = marker;
    } else {
      vehicleMarkerRef.current.setLatLng([lat, lng]);
      const el = document.getElementById('amb-marker-inner');
      if (el) {
        const innerIcon = el.querySelector('div:last-child') as HTMLElement;
        if (innerIcon) {
          innerIcon.style.transform = `rotate(${heading}deg)`;
        }
      }
    }

    // Phase 13: Auto-follow ambulance smoothly when follow mode is active
    if (followAmbulance && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
  }, [telemetry, followAmbulance]);

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    if (telemetry && telemetry.currentCoordinates) {
      const [lng, lat] = telemetry.currentCoordinates;
      mapInstanceRef.current.setView([lat, lng], 14);
      setFollowAmbulance(true);
    } else if (selectedRoute && selectedRoute.fullCoordinates.length > 0) {
      const fullLatLngs: L.LatLngTuple[] = selectedRoute.fullCoordinates.map(([lng, lat]) => [lat, lng]);
      mapInstanceRef.current.fitBounds(L.latLngBounds(fullLatLngs), { padding: [50, 50] });
    } else if (currentMission.originCoords) {
      const [lng, lat] = currentMission.originCoords;
      mapInstanceRef.current.setView([lat, lng], 13);
    }
  };

  return (
    <div className="relative w-full h-full" style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Leaflet DOM container */}
      <div
        ref={mapContainerRef}
        id="leaflet-map-canvas"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#0b0f17',
          zIndex: 1,
        }}
      />

      {/* Grouped Vertical Floating Map Controls */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 400,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(9, 13, 22, 0.92)',
          border: '1px solid rgba(51, 65, 85, 0.7)',
          borderRadius: 8,
          overflow: 'hidden',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
        }}
      >
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          title="Zoom In (+)"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#f8fafc',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Plus size={16} />
        </button>

        <div style={{ height: 1, background: 'rgba(51, 65, 85, 0.5)' }} />

        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          title="Zoom Out (−)"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#f8fafc',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Minus size={16} />
        </button>

        <div style={{ height: 1, background: 'rgba(51, 65, 85, 0.5)' }} />

        <button
          onClick={handleRecenter}
          title="Recenter Map (◎)"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#38bdf8',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Crosshair size={16} />
        </button>

        <div style={{ height: 1, background: 'rgba(51, 65, 85, 0.5)' }} />

        <button
          onClick={() => {
            const next = !followAmbulance;
            setFollowAmbulance(next);
            if (next && telemetry && telemetry.currentCoordinates && mapInstanceRef.current) {
              const [lng, lat] = telemetry.currentCoordinates;
              mapInstanceRef.current.setView([lat, lng], 14);
            }
          }}
          title={followAmbulance ? 'Follow Ambulance: ACTIVE (Click to unlock camera)' : 'Follow Ambulance: INACTIVE (Click to track)'}
          style={{
            background: followAmbulance ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
            border: 'none',
            color: followAmbulance ? '#10b981' : '#94a3b8',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = followAmbulance ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = followAmbulance ? 'rgba(16, 185, 129, 0.25)' : 'transparent')}
        >
          <Navigation size={16} style={{ transform: followAmbulance ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        <div style={{ height: 1, background: 'rgba(51, 65, 85, 0.5)' }} />

        <button
          onClick={() => setMapTileStyle(mapTileStyle === 'tactical_dark' ? 'osm_standard' : 'tactical_dark')}
          title={mapTileStyle === 'tactical_dark' ? 'Switch to OSM Tile' : 'Switch to Dark Tile'}
          style={{
            background: 'transparent',
            border: 'none',
            color: mapTileStyle === 'tactical_dark' ? '#94a3b8' : '#10b981',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Layers size={16} />
        </button>
      </div>

      {/* Compact Floating Risk Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: 14,
          zIndex: 400,
          background: 'rgba(9, 13, 22, 0.88)',
          border: '1px solid rgba(51, 65, 85, 0.7)',
          borderRadius: 8,
          padding: '7px 12px',
          backdropFilter: 'blur(12px)',
          color: '#f8fafc',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          userSelect: 'none',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 10, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          ROAD RISK:
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            Low
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} />
            Moderate
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />
            High
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            Critical
          </span>
        </div>
      </div>
    </div>
  );
};
