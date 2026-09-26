import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useApp } from '../../context/AppContext';

// Authoritative MapLibre Worker binding for Vite
if (typeof window !== 'undefined' && typeof (maplibregl as any).setWorkerUrl === 'function') {
  (maplibregl as any).setWorkerUrl(maplibreglWorkerUrl);
}
import { getBoundsForCoordinates } from '../../utils/geoUtils';
import { checkWebGLSupport, WebGLDiagnostic } from '../../utils/webglDetect';
import { RiskSegment, HazardAlert } from '../../types';
import {
  ShieldAlert,
  Navigation,
  Plus,
  Minus,
  Sun,
  Moon,
  Maximize2,
  AlertTriangle,
  Car,
  Activity,
  Compass,
  Waves,
  ThumbsUp,
  Layers,
  HardDrive,
  CheckSquare,
  Square,
  Crosshair,
} from 'lucide-react';
import { CITY_PRESETS } from '../../data/mockScenarios';
import { PlaceInformationPanel } from '../place/PlaceInformationPanel';
import { mapOsmTagToPlaceType, PlaceType } from '../../services/placeService';
import trafficService from '../../services/trafficService';
import incidentService, { RoadIncident } from '../../services/incidentService';
import hazardReportService, { CitizenHazardReport } from '../../services/hazardReportService';
import floodService, { FloodAssessmentResult } from '../../services/floodService';
import ReportAheadModal from '../navigation/ReportAheadModal';
import { DataHealthModal } from '../dashboard/DataHealthModal';
import { OfflineMapManagerModal } from '../navigation/OfflineMapManagerModal';
import { performanceDiagnosticsService } from '../../services/performanceDiagnosticsService';
import { routingService } from '../../services/routingService';

// Controlled, high-reliability OpenStreetMap Raster Fallback Style (Guarantee: Base map never turns blank)
export const OSM_FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-raster-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-raster-layer',
      type: 'raster',
      source: 'osm-raster-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Resolves modern vector tile style or signals fallback to OSM
export const getVectorStyleUrl = (styleKey?: string): string | null => {
  const env = (import.meta as any).env || {};
  const maptilerKey = env.VITE_MAPTILER_API_KEY || env.VITE_MAPTILER_KEY;
  if (!maptilerKey || maptilerKey.includes('placeholder')) {
    console.warn('MapTiler key not found or placeholder; activating OpenStreetMap fallback.');
    return null;
  }
  if (styleKey === 'dark' || styleKey === 'dataviz-dark') {
    return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${maptilerKey}`;
  }
  return `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`;
};

/**
 * Deterministic resolution of initial map camera coordinates
 * Priority:
 * 1. Active Mission Origin coordinates (if valid)
 * 2. Active Selected Vehicle telemetry coordinates (if valid)
 * 3. Configured Operating City Center (if valid)
 * 4. Explicit Safe Emergency Base Coordinates (Hyderabad Central Command: [78.4744, 17.3616])
 */
export const resolveAuthoritativeCoordinates = (
  missionCoords?: [number, number],
  vehicleCoords?: [number, number],
  cityId?: string
): [number, number] => {
  const isValidCoord = (c?: [number, number]): c is [number, number] =>
    Array.isArray(c) &&
    c.length === 2 &&
    typeof c[0] === 'number' &&
    typeof c[1] === 'number' &&
    !isNaN(c[0]) &&
    !isNaN(c[1]) &&
    c[0] >= -180 &&
    c[0] <= 180 &&
    c[1] >= -90 &&
    c[1] <= 90;

  // 1. Priority 1: Active Mission Origin coordinates
  if (isValidCoord(missionCoords)) {
    return missionCoords;
  }

  // 2. Priority 2: Active Selected Vehicle telemetry coordinates
  if (isValidCoord(vehicleCoords)) {
    return vehicleCoords;
  }

  // 3. Priority 3: Configured Operating City Center
  if (cityId && CITY_PRESETS[cityId] && isValidCoord(CITY_PRESETS[cityId].center)) {
    return CITY_PRESETS[cityId].center;
  }

  // 4. Priority 4: Explicit Safe Emergency Base Coordinates (Hyderabad Central Command)
  return [78.4744, 17.3616];
};

export const MapContainer: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hazardMarkersRef = useRef<maplibregl.Marker[]>([]);
  const signalMarkersRef = useRef<maplibregl.Marker[]>([]);
  const routeTrafficSignalMarkersRef = useRef<maplibregl.Marker[]>([]);
  const hospitalMarkerRef = useRef<maplibregl.Marker | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const selectedPlaceMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastFittedRouteIdRef = useRef<string | null>(null);
  const fallbackAttemptedRef = useRef<boolean>(false);

  const [selectedSegmentData, setSelectedSegmentData] = useState<RiskSegment | null>(null);
  const [activeHazardPopup, setActiveHazardPopup] = useState<HazardAlert | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentStyleKey, setCurrentStyleKey] = useState<'streets' | 'dark'>('streets');
  const [followAmbulance, setFollowAmbulance] = useState<boolean>(false);
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isTrafficVisible, setIsTrafficVisible] = useState<boolean>(true);
  const [showTrafficDialog, setShowTrafficDialog] = useState<boolean>(false);
  const [showDataHealth, setShowDataHealth] = useState<boolean>(false);

  const incidentMarkersRef = useRef<maplibregl.Marker[]>([]);
  const citizenReportMarkersRef = useRef<maplibregl.Marker[]>([]);
  const floodMarkersRef = useRef<maplibregl.Marker[]>([]);

  const [viewportIncidents, setViewportIncidents] = useState<RoadIncident[]>([]);
  const [citizenReports, setCitizenReports] = useState<CitizenHazardReport[]>([]);
  const [floodAssessment, setFloodAssessment] = useState<FloodAssessmentResult | null>(null);

  const [isIncidentsVisible, setIsIncidentsVisible] = useState<boolean>(true);
  const [isCitizenReportsVisible, setIsCitizenReportsVisible] = useState<boolean>(true);
  const [isFloodVisible, setIsFloodVisible] = useState<boolean>(true);
  const [isRiskVisible, setIsRiskVisible] = useState<boolean>(true);
  const [isEmergencyVisible, setIsEmergencyVisible] = useState<boolean>(true);
  const [isHospitalsVisible, setIsHospitalsVisible] = useState<boolean>(true);
  const [isPetrolVisible, setIsPetrolVisible] = useState<boolean>(true);

  const [isFollowMe, setIsFollowMe] = useState<boolean>(false);
  const [showLayersMenu, setShowLayersMenu] = useState<boolean>(false);
  const [showOfflineMapModal, setShowOfflineMapModal] = useState<boolean>(false);
  const [showReportAheadModal, setShowReportAheadModal] = useState<boolean>(false);

  const [selectedIncident, setSelectedIncident] = useState<RoadIncident | null>(null);
  const [selectedCitizenReport, setSelectedCitizenReport] = useState<CitizenHazardReport | null>(null);

  // WebGL diagnostic state
  const [webglStatus, setWebglStatus] = useState<{
    tested: boolean;
    isAvailable: boolean;
    diagnostic: WebGLDiagnostic | null;
  }>({
    tested: false,
    isAvailable: false,
    diagnostic: null,
  });

  const {
    activePortal,
    userLocation,
    navigationPhase,
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
    selectedPlace,
    openPlaceDetails,
    closePlacePanel,
    setDestinationLocation,
    setSelectedRouteId,
    isDemoRunning,
  } = useApp();

  // Color mapper based on segment risk index (0 - 100)
  const getRiskColor = (score: number) => {
    if (score >= 81) return '#f43f5e'; // Critical Crimson
    if (score >= 61) return '#fb7185'; // High Red
    if (score >= 41) return '#f59e0b'; // Elevated Amber
    if (score >= 21) return '#eab308'; // Moderate Yellow
    return '#10b981'; // Safe Green
  };

  // Navigation Follow Mode Camera Tracking (Part 1)
  useEffect(() => {
    if (isFollowMe && userLocation.coordinates && mapRef.current) {
      mapRef.current.easeTo({
        center: userLocation.coordinates,
        bearing: userLocation.heading != null ? userLocation.heading : mapRef.current.getBearing(),
        duration: 500,
      });
    }
  }, [userLocation.coordinates, userLocation.heading, isFollowMe]);

  // 1. Initialize MapLibre GL JS Vector Map Instance with MapTiler Streets
  useEffect(() => {
    let isMounted = true;

    // Step 1: Probe WebGL compatibility safely
    const diagnostic = checkWebGLSupport();
    if (!diagnostic.supported) {
      console.warn('RoadRisk AI: WebGL unavailable or disabled by GPU environment:', diagnostic);
      if (isMounted) {
        setWebglStatus({
          tested: true,
          isAvailable: false,
          diagnostic,
        });
      }
      return;
    }

    if (isMounted) {
      setWebglStatus({
        tested: true,
        isAvailable: true,
        diagnostic,
      });
    }

    if (!mapContainerRef.current) return;

    // Clean up any stale map instance
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {
        console.warn('Stale map cleanup:', e);
      }
      mapRef.current = null;
    }

    let map: maplibregl.Map | null = null;

    try {
      const container = mapContainerRef.current;
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
        console.warn('MapContainer: container has 0 dimensions, awaiting layout stabilization');
        return;
      }

      const initialCoords = resolveAuthoritativeCoordinates(
        currentMission.originCoords,
        telemetry?.currentCoordinates,
        currentCityId
      );
      const vectorUrl = getVectorStyleUrl(currentStyleKey);
      const initialStyle: maplibregl.StyleSpecification | string = vectorUrl || OSM_FALLBACK_STYLE;

      const mapStartTime = performance.now();

      map = new maplibregl.Map({
        container,
        style: initialStyle,
        center: initialCoords,
        zoom: 14.2,
        pitch: 0, // Flat 2D Navigation standard
        bearing: 0,
        maxPitch: 0, // Disable unnecessary 3D tilting
        minPitch: 0,
        dragRotate: false, // Keep north-up
        touchPitch: false,
        pitchWithRotate: false,
        attributionControl: { compact: false },
        canvasContextAttributes: { antialias: true },
        fadeDuration: 100,
      });

      // Navigation-grade smooth zoom
      map.scrollZoom.enable();
      map.scrollZoom.setWheelZoomRate(1 / 450); // Controlled, comfortable zoom steps
      map.scrollZoom.setZoomRate(1 / 100);
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.touchZoomRotate.disableRotation(); // Keep map north-up

      // Disable Follow camera tracking when user manually pans/drags map on desktop or touch devices
      map.on('dragstart', () => {
        setFollowAmbulance(false);
        setIsFollowMe(false);
      });
      map.on('touchstart', () => {
        setFollowAmbulance(false);
        setIsFollowMe(false);
      });

      // Strip any 3D fill-extrusion layers on style load (Phase 6: 2D flat navigation map)
      const strip3dLayers = () => {
        const style = map?.getStyle();
        if (style && style.layers) {
          style.layers.forEach((layer: any) => {
            if (layer.type === 'fill-extrusion' || layer.id.includes('3d') || layer.id.includes('extrusion')) {
              try {
                map?.setLayoutProperty(layer.id, 'visibility', 'none');
              } catch {}
            }
          });
        }
      };

      // Handle missing sprite icons gracefully (MapTiler Streets POIs referencing "office" or empty "" label suppression)
      map.on('styleimagemissing', (e: any) => {
        if (!map) return;
        if (!map.hasImage(e.id)) {
          const width = 1;
          const height = 1;
          const data = new Uint8Array(4); // [0, 0, 0, 0] transparent
          try {
            map.addImage(e.id, { width, height, data });
          } catch {}
        }
      });

      const setupTrafficLayer = () => {
        const tileUrl = trafficService.getTrafficFlowTileUrl();
        if (tileUrl && map && !map.getSource('source-traffic-flow')) {
          try {
            // Find first symbol layer so road labels, shields, and POIs render clearly above traffic
            const layers = map.getStyle().layers || [];
            let firstSymbolId: string | undefined;
            for (const layer of layers) {
              if (layer.type === 'symbol') {
                firstSymbolId = layer.id;
                break;
              }
            }

            map.addSource('source-traffic-flow', {
              type: 'raster',
              tiles: [tileUrl],
              tileSize: 256,
              minzoom: 10,
              maxzoom: 22,
            });
            map.addLayer(
              {
                id: 'layer-traffic-flow',
                type: 'raster',
                source: 'source-traffic-flow',
                minzoom: 10,
                layout: {
                  visibility: isTrafficVisible ? 'visible' : 'none',
                },
                paint: {
                  'raster-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 0.25,
                    13, 0.45,
                    16, 0.65,
                  ],
                  'raster-fade-duration': 250,
                },
              },
              firstSymbolId
            );
          } catch (err) {
            console.warn('RoadRisk AI: Traffic flow layer setup notice:', err);
          }
        }
      };

      // Dedicated Stable Route Sources & Layers Setup (Requirements 4 & 5)
      const setupRouteLayers = () => {
        if (!map) return;
        const style = map.getStyle();
        if (!style) return;

        const layers = style.layers || [];
        let firstSymbolId: string | undefined;
        for (const layer of layers) {
          if (layer.type === 'symbol') {
            firstSymbolId = layer.id;
            break;
          }
        }

        // 1. Alternative routes source & layers
        if (!map.getSource('source-route-alternatives')) {
          map.addSource('source-route-alternatives', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addLayer(
            {
              id: 'layer-route-alts-casing',
              type: 'line',
              source: 'source-route-alternatives',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': '#0f172a',
                'line-width': 8,
                'line-opacity': 0.35,
              },
            },
            firstSymbolId
          );

          map.addLayer(
            {
              id: 'layer-route-alts-main',
              type: 'line',
              source: 'source-route-alternatives',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': '#64748b',
                'line-width': 4,
                'line-dasharray': [2, 1.5],
                'line-opacity': 0.85,
              },
            },
            firstSymbolId
          );

          // Tap alternative route on map to make it primary (Requirement 28)
          map.on('click', 'layer-route-alts-main', (e: any) => {
            if (e.features && e.features[0]?.properties?.id) {
              setSelectedRouteId(e.features[0].properties.id);
            }
          });

          map.on('mouseenter', 'layer-route-alts-main', () => {
            if (map) map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'layer-route-alts-main', () => {
            if (map) map.getCanvas().style.cursor = '';
          });
        }

        // 2. Risk / Traffic segments source & layers
        if (!map.getSource('source-active-segments')) {
          map.addSource('source-active-segments', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addLayer(
            {
              id: 'layer-active-segments-casing',
              type: 'line',
              source: 'source-active-segments',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': ['get', 'color'],
                'line-width': 12,
                'line-opacity': 0.35,
              },
            },
            firstSymbolId
          );

          map.addLayer(
            {
              id: 'layer-active-segments-core',
              type: 'line',
              source: 'source-active-segments',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': ['get', 'color'],
                'line-width': 4.5,
                'line-opacity': 0.95,
              },
            },
            firstSymbolId
          );

          map.on('click', 'layer-active-segments-core', (e: any) => {
            if (e.features && e.features[0]) {
              const featProps = e.features[0].properties;
              const found = selectedRoute?.segments.find((s) => s.id === featProps?.id);
              if (found) setSelectedSegmentData(found);
            }
          });

          map.on('mouseenter', 'layer-active-segments-core', () => {
            if (map) map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'layer-active-segments-core', () => {
            if (map) map.getCanvas().style.cursor = '';
          });
        }

        // 3. Primary / Selected route source & layers
        if (!map.getSource('source-route-primary')) {
          map.addSource('source-route-primary', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addLayer(
            {
              id: 'layer-route-primary-casing',
              type: 'line',
              source: 'source-route-primary',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': '#0369a1',
                'line-width': 11,
                'line-opacity': 0.45,
              },
            },
            firstSymbolId
          );

          map.addLayer(
            {
              id: 'layer-route-primary-main',
              type: 'line',
              source: 'source-route-primary',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': '#0284c7',
                'line-width': 5.5,
                'line-opacity': 0.95,
              },
            },
            firstSymbolId
          );
        }

        // 4. Completed route path during active live navigation
        if (!map.getSource('source-route-completed')) {
          map.addSource('source-route-completed', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addLayer(
            {
              id: 'layer-route-completed',
              type: 'line',
              source: 'source-route-completed',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': '#64748b',
                'line-width': 5,
                'line-opacity': 0.7,
                'line-dasharray': [2, 1.2],
              },
            },
            firstSymbolId
          );
        }
      };

      // Clustered & Zoom-Dependent GeoJSON Incident Layers (Phases 3-10)
      const setupIncidentLayers = () => {
        if (!map) return;
        try {
          if (!map.getSource('source-traffic-incidents')) {
            map.addSource('source-traffic-incidents', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
              cluster: true,
              clusterMaxZoom: 13,
              clusterRadius: 45,
            });

            // 1. Clustered incident circles
            map.addLayer({
              id: 'layer-incident-clusters',
              type: 'circle',
              source: 'source-traffic-incidents',
              filter: ['has', 'point_count'],
              paint: {
                'circle-color': [
                  'step',
                  ['get', 'point_count'],
                  '#ea580c',
                  5, '#dc2626',
                  12, '#991b1b',
                ],
                'circle-radius': [
                  'step',
                  ['get', 'point_count'],
                  15,
                  5, 18,
                  12, 23,
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.95,
              },
            });

            // 2. Cluster count badge numbers
            map.addLayer({
              id: 'layer-incident-cluster-count',
              type: 'symbol',
              source: 'source-traffic-incidents',
              filter: ['has', 'point_count'],
              layout: {
                'text-field': '{point_count_abbreviated}',
                'text-size': 11,
              },
              paint: {
                'text-color': '#ffffff',
              },
            });

            // 3. Individual unclustered incident circle pin
            map.addLayer({
              id: 'layer-incident-unclustered-circle',
              type: 'circle',
              source: 'source-traffic-incidents',
              filter: ['!', ['has', 'point_count']],
              paint: {
                'circle-color': [
                  'match',
                  ['get', 'category'],
                  'ROAD_CLOSURE', '#991b1b',
                  'LANE_CLOSURE', '#ea580c',
                  'ACCIDENT', '#dc2626',
                  'ROAD_WORKS', '#f97316',
                  'CONGESTION', '#eab308',
                  'FLOODING', '#0284c7',
                  '#ef4444',
                ],
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  10, 4,
                  13, 7,
                  15, 10,
                  18, 13,
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.95,
              },
            });

            // 4. Incident symbols (zoom >= 14)
            map.addLayer({
              id: 'layer-incident-unclustered-icon',
              type: 'symbol',
              source: 'source-traffic-incidents',
              filter: ['!', ['has', 'point_count']],
              minzoom: 14,
              layout: {
                'text-field': ['get', 'iconSymbol'],
                'text-size': 10,
                'text-allow-overlap': true,
              },
            });

            // 5. Incident short label (zoom >= 17 ONLY)
            map.addLayer({
              id: 'layer-incident-unclustered-label',
              type: 'symbol',
              source: 'source-traffic-incidents',
              filter: ['!', ['has', 'point_count']],
              minzoom: 17,
              layout: {
                'text-field': ['get', 'displayLabel'],
                'text-size': 9.5,
                'text-offset': [0, 1.3],
                'text-anchor': 'top',
                'text-allow-overlap': false,
              },
              paint: {
                'text-color': '#0f172a',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2,
              },
            });

            // Cluster click -> expansion zoom
            map.on('click', 'layer-incident-clusters', (e) => {
              const m = mapRef.current;
              if (!m) return;
              const features = m.queryRenderedFeatures(e.point, { layers: ['layer-incident-clusters'] });
              const clusterId = features[0]?.properties?.cluster_id;
              const source = m.getSource('source-traffic-incidents') as maplibregl.GeoJSONSource | undefined;
              if (source && clusterId != null) {
                source.getClusterExpansionZoom(clusterId).then((zoom) => {
                  if (zoom == null) return;
                  m.easeTo({
                    center: (features[0].geometry as any).coordinates,
                    zoom: zoom + 0.5,
                  });
                }).catch((err) => {
                  console.warn('RoadRisk AI: getClusterExpansionZoom error:', err);
                });
              }
            });

            // Unclustered point click -> detailed card
            map.on('click', 'layer-incident-unclustered-circle', (e) => {
              const m = mapRef.current;
              if (!m) return;
              const features = m.queryRenderedFeatures(e.point, { layers: ['layer-incident-unclustered-circle'] });
              if (features.length > 0) {
                const props = features[0].properties;
                if (props?.id) {
                  const inc = incidentService.getIncidentById(props.id);
                  if (inc) {
                    setSelectedIncident(inc);
                  }
                }
              }
            });

            // Cursor styling
            map.on('mouseenter', 'layer-incident-clusters', () => {
              const m = mapRef.current;
              if (m) m.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'layer-incident-clusters', () => {
              const m = mapRef.current;
              if (m) m.getCanvas().style.cursor = '';
            });
            map.on('mouseenter', 'layer-incident-unclustered-circle', () => {
              const m = mapRef.current;
              if (m) m.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'layer-incident-unclustered-circle', () => {
              const m = mapRef.current;
              if (m) m.getCanvas().style.cursor = '';
            });
          }
        } catch (err) {
          console.warn('RoadRisk AI: Incident GeoJSON layers setup error:', err);
        }
      };

      // Enhance base map visual contrast & modern hierarchy (Light Navigation Map Standard)
      const tunePremiumMapPalette = () => {
        const m = map;
        if (!m) return;
        try {
          // 1. Crisp modern background instead of dusty pale cream
          if (m.getLayer('Background')) {
            m.setPaintProperty('Background', 'background-color', '#f1f5f9');
          }

          // 2. Clean, vibrant navigation water
          if (m.getLayer('Water')) {
            m.setPaintProperty('Water', 'fill-color', '#a5d8f3');
            m.setPaintProperty('Water', 'fill-opacity', 0.85);
          }
          if (m.getLayer('River')) {
            m.setPaintProperty('River', 'line-color', '#7dd3fc');
            m.setPaintProperty('River', 'line-opacity', 0.95);
          }

          // 3. Natural lush parks and greenery
          const greenLayers = ['Grass', 'Park', 'Forest', 'Meadow', 'Wood'];
          greenLayers.forEach((id) => {
            if (m.getLayer(id)) {
              m.setPaintProperty(id, 'fill-color', '#dcfce7');
              m.setPaintProperty(id, 'fill-opacity', 0.6);
            }
          });

          // 4. Clean modern buildings with subtle definition
          if (m.getLayer('Building')) {
            m.setPaintProperty('Building', 'fill-color', '#e2e8f0');
            m.setPaintProperty('Building', 'fill-outline-color', '#cbd5e1');
            m.setPaintProperty('Building', 'fill-opacity', 0.65);
          }

          // 5. Crisp high-contrast road network
          if (m.getLayer('Minor road outline')) {
            m.setPaintProperty('Minor road outline', 'line-color', '#cbd5e1');
            m.setPaintProperty('Minor road outline', 'line-opacity', 0.8);
          }
          if (m.getLayer('Minor road')) {
            m.setPaintProperty('Minor road', 'line-color', '#ffffff');
          }
          if (m.getLayer('Major road outline')) {
            m.setPaintProperty('Major road outline', 'line-color', '#94a3b8');
            m.setPaintProperty('Major road outline', 'line-opacity', 0.9);
          }
          if (m.getLayer('Major road')) {
            m.setPaintProperty('Major road', 'line-color', '#ffffff');
          }
          if (m.getLayer('Highway outline')) {
            m.setPaintProperty('Highway outline', 'line-color', '#ea580c');
            m.setPaintProperty('Highway outline', 'line-opacity', 0.95);
          }
          if (m.getLayer('Highway')) {
            m.setPaintProperty('Highway', 'line-color', '#fed7aa');
          }

          // 6. Legible typography with crisp white halo
          if (m.getLayer('Road labels')) {
            m.setPaintProperty('Road labels', 'text-color', '#0f172a');
            m.setPaintProperty('Road labels', 'text-halo-color', '#ffffff');
            m.setPaintProperty('Road labels', 'text-halo-width', 1.8);
          }
          if (m.getLayer('Place labels')) {
            m.setPaintProperty('Place labels', 'text-color', '#0f172a');
            m.setPaintProperty('Place labels', 'text-halo-color', '#ffffff');
            m.setPaintProperty('Place labels', 'text-halo-width', 2.0);
          }
          if (m.getLayer('City labels')) {
            m.setPaintProperty('City labels', 'text-color', '#0f172a');
            m.setPaintProperty('City labels', 'text-halo-color', '#ffffff');
            m.setPaintProperty('City labels', 'text-halo-width', 2.2);
          }
        } catch (err) {
          console.warn('Map palette tuning notice:', err);
        }
      };

      map.on('load', () => {
        if (!isMounted) return;
        strip3dLayers();
        tunePremiumMapPalette();
        setupTrafficLayer();
        setupRouteLayers();
        setupIncidentLayers();
        setMapLoaded(true);
        setMapError(null);
        performanceDiagnosticsService.recordMetric('mapInitMs', performance.now() - mapStartTime, 'MapLibre GL');
      });

      map.on('style.load', () => {
        if (!isMounted) return;
        strip3dLayers();
        tunePremiumMapPalette();
        setupTrafficLayer();
        setupRouteLayers();
        setupIncidentLayers();
        setMapLoaded(true);
        performanceDiagnosticsService.recordMetric('styleLoadMs', performance.now() - mapStartTime, 'MapTiler Vector Style');
      });
      // Google-Maps-Style Map Click Interaction (Streets, POIs, Cities, Roads, Coordinates)
      map.on('click', (e: any) => {
        if (!map) return;
        const features = map.queryRenderedFeatures(e.point);
        let detectedName: string | undefined;
        let detectedType: PlaceType | undefined;

        for (const f of features) {
          const props = f.properties || {};
          const layerId = f.layer?.id || '';
          const sourceLayer = (f as any).sourceLayer || '';

          if (props.name || props.name_en) {
            detectedName = props.name || props.name_en;
            if (layerId.includes('poi') || sourceLayer.includes('poi')) {
              detectedType = mapOsmTagToPlaceType(props.class, props.subclass, props.type);
              break;
            } else if (layerId.includes('place') || sourceLayer.includes('place')) {
              detectedType = 'city';
              break;
            } else if (
              layerId.includes('road') ||
              layerId.includes('transportation') ||
              sourceLayer.includes('transportation')
            ) {
              detectedType = props.class === 'motorway' || props.class === 'trunk' ? 'highway' : 'road';
              break;
            }
          }
        }

        openPlaceDetails([e.lngLat.lng, e.lngLat.lat], detectedName, detectedType);
      });

      // Interactive hover cursor over features
      map.on('mousemove', (e: any) => {
        if (!map) return;
        const features = map.queryRenderedFeatures(e.point);
        const isInteractive = features.some((f: any) => {
          const props = f.properties || {};
          return Boolean(props.name || props.name_en);
        });
        map.getCanvas().style.cursor = isInteractive ? 'pointer' : '';
      });

      map.on('error', (e: any) => {
        console.warn('MapLibre runtime error:', e);
        const errMsg = (e?.error?.message || '').toLowerCase();
        const status = e?.error?.status;
        if (
          status === 401 ||
          status === 403 ||
          errMsg.includes('401') ||
          errMsg.includes('403') ||
          errMsg.includes('unauthorized') ||
          errMsg.includes('forbidden')
        ) {
          if (!fallbackAttemptedRef.current && map) {
            fallbackAttemptedRef.current = true;
            console.warn('RoadRisk AI: MapTiler authentication failure detected. Gracefully activating OpenStreetMap fallback style.');
            try {
              map.setStyle(OSM_FALLBACK_STYLE);
            } catch (err) {
              console.error('Failed to set OSM fallback style:', err);
            }
          }
        }
        if (
          errMsg.includes('webgl') ||
          errMsg.includes('context') ||
          errMsg.includes('bindtocurrentsequence')
        ) {
          if (isMounted) {
            setWebglStatus({
              tested: true,
              isAvailable: false,
              diagnostic: {
                supported: false,
                version: null,
                vendor: 'Disabled',
                renderer: 'WebGL Context Creation Error',
                error: errMsg || 'Failed to initialize WebGL context',
              },
            });
          }
        }
      });

      mapRef.current = map;
    } catch (err: any) {
      console.error('RoadRisk AI: MapLibre initialization failed:', err);
      if (isMounted) {
        setMapError(`Map initialization failed: ${err?.message}`);
      }
    }

    // Responsive container resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      if (map) {
        try {
          map.remove();
        } catch (e) {
          console.warn('Map unmount cleanup error:', e);
        }
        mapRef.current = null;
      }
      setMapLoaded(false);
      vehicleMarkerRef.current = null;
      hazardMarkersRef.current = [];
      signalMarkersRef.current = [];
      hospitalMarkerRef.current = null;
      originMarkerRef.current = null;
      selectedPlaceMarkerRef.current = null;
      lastFittedRouteIdRef.current = null;
    };
  }, []); // Run map initialization once on mount

  // 1b. Reactive Traffic Layer Visibility Toggle (Never recreates map)
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      const map = mapRef.current;
      if (map.getLayer('layer-traffic-flow')) {
        map.setLayoutProperty(
          'layer-traffic-flow',
          'visibility',
          isTrafficVisible ? 'visible' : 'none'
        );
      }
    }
  }, [isTrafficVisible, mapLoaded]);

  // 2. Switch Vector Tile Style (MapTiler Streets vs MapTiler Dark)
  const handleStyleChange = useCallback((newStyle: 'streets' | 'dark') => {
    setCurrentStyleKey(newStyle);
    const map = mapRef.current;
    if (map) {
      setMapLoaded(false);
      try {
        map.setStyle(getVectorStyleUrl(newStyle), { diff: false });
      } catch (err: any) {
        setMapError(err.message);
      }
    }
  }, []);

  // 3. High-Performance Stable Route & Segment Updates (Zero layer recreation)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const startPerf = performance.now();
    try {
      // A. Update Primary Selected Route & Completed Route Path
      const primarySource = map.getSource('source-route-primary') as maplibregl.GeoJSONSource | undefined;
      const completedSource = map.getSource('source-route-completed') as maplibregl.GeoJSONSource | undefined;

      if (primarySource) {
        if (selectedRoute && selectedRoute.fullCoordinates && selectedRoute.fullCoordinates.length >= 2) {
          if (navigationPhase === 'NAVIGATING' && userLocation.coordinates) {
            const progress = routingService.calculateRouteProgress(userLocation.coordinates, selectedRoute);
            const splitIdx = Math.max(0, Math.min(selectedRoute.fullCoordinates.length - 1, progress.closestPointIndex));
            const completedCoords = selectedRoute.fullCoordinates.slice(0, splitIdx + 1);
            const remainingCoords = [progress.snappedLocation, ...selectedRoute.fullCoordinates.slice(splitIdx + 1)];

            if (completedSource) {
              completedSource.setData({
                type: 'FeatureCollection',
                features:
                  completedCoords.length >= 2
                    ? [
                        {
                          type: 'Feature',
                          properties: {},
                          geometry: { type: 'LineString', coordinates: completedCoords },
                        },
                      ]
                    : [],
              });
            }

            primarySource.setData({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { id: selectedRoute.id },
                  geometry: {
                    type: 'LineString',
                    coordinates:
                      remainingCoords.length >= 2 ? remainingCoords : selectedRoute.fullCoordinates,
                  },
                },
              ],
            });
          } else {
            if (completedSource) {
              completedSource.setData({ type: 'FeatureCollection', features: [] });
            }
            primarySource.setData({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { id: selectedRoute.id },
                  geometry: {
                    type: 'LineString',
                    coordinates: selectedRoute.fullCoordinates,
                  },
                },
              ],
            });
          }
        } else {
          primarySource.setData({ type: 'FeatureCollection', features: [] });
          if (completedSource) {
            completedSource.setData({ type: 'FeatureCollection', features: [] });
          }
        }
      }

      // B. Update Alternative Routes
      const altsSource = map.getSource('source-route-alternatives') as maplibregl.GeoJSONSource | undefined;
      if (altsSource) {
        const altRoutes = routes.filter((r) => r.id !== selectedRoute?.id);
        const altFeatures: GeoJSON.Feature[] = altRoutes.map((r) => ({
          type: 'Feature',
          properties: { id: r.id, name: r.name, summary: r.summary },
          geometry: {
            type: 'LineString',
            coordinates: r.fullCoordinates,
          },
        }));
        altsSource.setData({ type: 'FeatureCollection', features: altFeatures });
      }

      // C. Update Risk & Traffic Segments
      const segmentsSource = map.getSource('source-active-segments') as maplibregl.GeoJSONSource | undefined;
      if (segmentsSource) {
        if (selectedRoute && selectedRoute.segments && selectedRoute.segments.length > 0) {
          const segFeatures: GeoJSON.Feature[] = selectedRoute.segments.map((seg) => ({
            type: 'Feature',
            properties: {
              id: seg.id,
              name: seg.name,
              riskScore: seg.riskScore,
              riskLevel: seg.riskLevel,
              color: seg.trafficColor || getRiskColor(seg.riskScore),
              trafficColor: seg.trafficColor || getRiskColor(seg.riskScore),
              trafficDensity: seg.trafficDensity,
              trafficDataSource: seg.trafficDataSource || 'NOT_CONFIGURED',
            },
            geometry: {
              type: 'LineString',
              coordinates: seg.coordinates,
            },
          }));
          segmentsSource.setData({ type: 'FeatureCollection', features: segFeatures });
        } else {
          segmentsSource.setData({ type: 'FeatureCollection', features: [] });
        }
      }

      // D. Smooth Camera Fit on new route selection (Never re-fits on every GPS tick)
      if (
        selectedRoute &&
        selectedRoute.fullCoordinates &&
        selectedRoute.fullCoordinates.length >= 2 &&
        lastFittedRouteIdRef.current !== selectedRoute.id
      ) {
        lastFittedRouteIdRef.current = selectedRoute.id;
        const bounds = getBoundsForCoordinates(selectedRoute.fullCoordinates);
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 120, left: 100, right: 60 },
          pitch: 0,
          bearing: 0,
          duration: 900,
        });
      }

      const elapsed = performance.now() - startPerf;
      performanceDiagnosticsService.recordMetric('routeRenderMs', elapsed, 'MapLibre GeoJSON Sources');
    } catch (e) {
      console.warn('Error updating stable route sources:', e);
    }
  }, [routes, selectedRoute, navigationPhase, userLocation.coordinates, mapLoaded]);

  // 5. Origin and Destination Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    try {
      // Origin Marker
      if (!originMarkerRef.current) {
        const originEl = document.createElement('div');
        originEl.className = 'origin-marker-pin';
        originEl.innerHTML = `
          <div class="pin-hub-pulse"></div>
          <div class="pin-hub-core">
            <span>DEP</span>
          </div>
        `;
        originMarkerRef.current = new maplibregl.Marker({ element: originEl })
          .setLngLat(currentMission.originCoords)
          .addTo(map);
      } else {
        originMarkerRef.current.setLngLat(currentMission.originCoords);
      }

      // Destination Marker (Modern Navigation Pin for Citizens, Emergency Badge for Dispatch)
      if (currentMission.destinationCoords) {
        const destName = currentMission.destination || 'Destination';
        const isMedical =
          destName.toLowerCase().includes('hospital') ||
          destName.toLowerCase().includes('clinic') ||
          destName.toLowerCase().includes('trauma');

        if (!hospitalMarkerRef.current) {
          const pinEl = document.createElement('div');
          pinEl.className = 'nav-destination-pin';
          pinEl.style.display = 'flex';
          pinEl.style.flexDirection = 'column';
          pinEl.style.alignItems = 'center';
          pinEl.style.cursor = 'pointer';

          if (isMedical && activePortal === 'operator') {
            pinEl.innerHTML = `
              <div style="background: #ef4444; border: 2px solid #ffffff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.6);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v20M2 12h20"/>
                </svg>
              </div>
              <div style="background: rgba(15, 23, 42, 0.92); color: #f8fafc; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.4); margin-top: 4px; white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                ${destName}
              </div>
            `;
          } else {
            // Modern Red/Cyan Navigation Teardrop Pin (Google Maps style)
            pinEl.innerHTML = `
              <div style="position: relative; width: 32px; height: 42px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="42" viewBox="0 0 24 32" fill="none" style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.45));">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="#ef4444"/>
                  <circle cx="12" cy="11" r="4.5" fill="#ffffff"/>
                  <circle cx="12" cy="11" r="2.2" fill="#ef4444"/>
                </svg>
              </div>
              <div style="background: rgba(15, 23, 42, 0.94); color: #f8fafc; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.4); margin-top: 2px; white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                ${destName}
              </div>
            `;
          }

          hospitalMarkerRef.current = new maplibregl.Marker({ element: pinEl, anchor: 'bottom' })
            .setLngLat(currentMission.destinationCoords)
            .addTo(map);
        } else {
          hospitalMarkerRef.current.setLngLat(currentMission.destinationCoords);
        }
      } else {
        if (hospitalMarkerRef.current) {
          hospitalMarkerRef.current.remove();
          hospitalMarkerRef.current = null;
        }
      }
    } catch (e) {
      console.warn('Error updating endpoint markers:', e);
    }
  }, [mapLoaded, currentMission.originCoords, currentMission.destinationCoords, currentMission.destination, activePortal]);

  // 5B. Selected Place Interactive Highlight Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    try {
      if (selectedPlace) {
        if (!selectedPlaceMarkerRef.current) {
          const pinEl = document.createElement('div');
          pinEl.className = 'selected-place-pin';
          pinEl.innerHTML = `
            <div class="selected-place-pulse"></div>
            <div style="position: relative; width: 34px; height: 44px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 6px 14px rgba(0,0,0,0.6));">
              <svg width="34" height="44" viewBox="0 0 24 32" fill="none">
                <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="#0284c7"/>
                <circle cx="12" cy="11" r="5" fill="#ffffff"/>
                <circle cx="12" cy="11" r="2.8" fill="#0284c7"/>
              </svg>
            </div>
          `;
          selectedPlaceMarkerRef.current = new maplibregl.Marker({
            element: pinEl,
            anchor: 'bottom',
          })
            .setLngLat([selectedPlace.longitude, selectedPlace.latitude])
            .addTo(map);
        } else {
          selectedPlaceMarkerRef.current.setLngLat([selectedPlace.longitude, selectedPlace.latitude]);
        }
      } else {
        if (selectedPlaceMarkerRef.current) {
          selectedPlaceMarkerRef.current.remove();
          selectedPlaceMarkerRef.current = null;
        }
      }
    } catch (e) {
      console.warn('Error updating selected place marker:', e);
    }
  }, [selectedPlace, mapLoaded]);

  // 6. Hazard Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    try {
      hazardMarkersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch {}
      });
      hazardMarkersRef.current = [];

      const now = Date.now();
      const validHazards = activeHazards.filter(
        (h) => !h.expiresAt || new Date(h.expiresAt).getTime() > now
      );

      validHazards.forEach((hazard) => {
        const el = document.createElement('div');
        el.className = `hazard-map-marker ${hazard.severity}`;
        el.innerHTML = `
          <div class="hazard-halo"></div>
          <div class="hazard-icon-box">
            <span class="hazard-exclamation">!</span>
          </div>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setActiveHazardPopup(hazard);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(hazard.coordinates)
          .addTo(map);

        hazardMarkersRef.current.push(marker);
      });
    } catch (e) {
      console.warn('Error rendering hazard markers:', e);
    }
  }, [activeHazards, mapLoaded]);

  // 6B. Real-Time Viewport Incidents & Flood Ingestion (Phases 4, 6, 9)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    let isMounted = true;

    const syncViewportData = async () => {
      try {
        const bounds = map.getBounds();
        const minLng = bounds.getWest();
        const minLat = bounds.getSouth();
        const maxLng = bounds.getEast();
        const maxLat = bounds.getNorth();

        const incidents = await incidentService.fetchIncidentsInViewport(minLng, minLat, maxLng, maxLat);
        if (isMounted) {
          setViewportIncidents(incidents);
        }

        const center = map.getCenter();
        const floodData = await floodService.assessFloodRisk(center.lat, center.lng, incidents);
        if (isMounted) {
          setFloodAssessment(floodData);
        }

        const reports = hazardReportService.getActiveReports();
        if (isMounted) {
          setCitizenReports(reports);
        }
      } catch (e) {
        console.warn('Error syncing viewport incidents:', e);
      }
    };

    syncViewportData();
    map.on('moveend', syncViewportData);
    const interval = setInterval(syncViewportData, 30_000);

    return () => {
      isMounted = false;
      map.off('moveend', syncViewportData);
      clearInterval(interval);
    };
  }, [mapLoaded]);

  // 6C. Clustered & Zoom-Dependent GeoJSON Road Incidents (Phases 3-10)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Clean up any remaining legacy DOM markers
    incidentMarkersRef.current.forEach((m) => {
      try { m.remove(); } catch {}
    });
    incidentMarkersRef.current = [];

    const source = map.getSource('source-traffic-incidents') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!isIncidentsVisible || viewportIncidents.length === 0) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const features: GeoJSON.Feature<GeoJSON.Point>[] = viewportIncidents.map((inc) => {
      let iconSymbol = '⚠';
      if (inc.category === 'ROAD_CLOSURE') iconSymbol = '⛔';
      else if (inc.category === 'LANE_CLOSURE') iconSymbol = '🛑';
      else if (inc.category === 'ROAD_WORKS' || inc.category === 'CONSTRUCTION') iconSymbol = '🚧';
      else if (inc.category === 'CONGESTION') iconSymbol = '🚗';
      else if (inc.category === 'ACCIDENT') iconSymbol = '💥';
      else if (inc.category === 'FLOODING') iconSymbol = '🌊';

      const shortName = inc.roadName ? inc.roadName.split(',')[0].trim() : '';
      const displayLabel = shortName
        ? `${inc.category.replace('_', ' ')}\n${shortName}`
        : inc.category.replace('_', ' ');

      return {
        type: 'Feature',
        id: inc.id,
        properties: {
          id: inc.id,
          category: inc.category,
          severity: inc.severity,
          title: inc.title,
          iconSymbol,
          displayLabel,
          delaySeconds: inc.delaySeconds,
        },
        geometry: {
          type: 'Point',
          coordinates: [inc.longitude, inc.latitude],
        },
      };
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [viewportIncidents, isIncidentsVisible, mapLoaded]);

  // 6D. Render Citizen Hazard Report Markers (Phase 9)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    try {
      citizenReportMarkersRef.current.forEach((m) => {
        try { m.remove(); } catch {}
      });
      citizenReportMarkersRef.current = [];

      if (!isCitizenReportsVisible) return;

      citizenReports.forEach((rep) => {
        const el = document.createElement('div');
        el.className = 'citizen-hazard-marker';
        el.innerHTML = `
          <div style="position: relative; cursor: pointer; display: flex; flex-direction: column; align-items: center;">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #f59e0b; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
              ⚠️
            </div>
            <div style="background: #0f172a; color: #f59e0b; font-size: 8.5px; font-weight: 800; padding: 2px 5px; border-radius: 4px; margin-top: 2px; white-space: nowrap; border: 1px solid #f59e0b55;">
              ${rep.type}
            </div>
          </div>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedCitizenReport(rep);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([rep.longitude, rep.latitude])
          .addTo(map);

        citizenReportMarkersRef.current.push(marker);
      });
    } catch (e) {
      console.warn('Error rendering citizen report markers:', e);
    }
  }, [citizenReports, isCitizenReportsVisible, mapLoaded]);

  // 7. Green Corridor Signal Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    try {
      signalMarkersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch {}
      });
      signalMarkersRef.current = [];

      greenCorridor.signals.forEach((sig) => {
        const el = document.createElement('div');
        el.className = `corridor-signal-marker status-${sig.state.toLowerCase()}`;
        el.innerHTML = `
          <div class="signal-disc ${sig.state === 'GREEN_LOCKED' ? 'disc-green' : sig.state === 'PREPARING_YELLOW' ? 'disc-yellow' : 'disc-standby'}">
            <div class="signal-dot"></div>
          </div>
        `;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(sig.coordinates)
          .addTo(map);

        signalMarkersRef.current.push(marker);
      });
    } catch (e) {
      console.warn('Error rendering signal markers:', e);
    }
  }, [greenCorridor.signals, mapLoaded]);

  // 8A. Real Device / User GPS Marker with Directional Heading Beam & Accuracy Circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    try {
      if (userLocation.coordinates) {
        if (!userLocationMarkerRef.current) {
          const uEl = document.createElement('div');
          uEl.className = 'citizen-gps-marker';
          uEl.innerHTML = `
            <div class="gps-accuracy-halo"></div>
            <div class="gps-pulse-beacon"></div>
            <div class="gps-heading-beam">
              <svg viewBox="0 0 60 60" width="60" height="60" class="heading-cone-svg">
                <defs>
                  <radialGradient id="beamGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9"/>
                    <stop offset="60%" stop-color="#0284c7" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="#0284c7" stop-opacity="0"/>
                  </radialGradient>
                </defs>
                <path d="M 30 30 L 14 6 A 28 28 0 0 1 46 6 Z" fill="url(#beamGradient)" />
                <polygon points="30,2 35,11 30,8 25,11" fill="#38bdf8" />
              </svg>
            </div>
            <div class="gps-core-dot">
              <div class="gps-inner-white"></div>
            </div>
          `;
          userLocationMarkerRef.current = new maplibregl.Marker({ element: uEl })
            .setLngLat(userLocation.coordinates)
            .addTo(map);
        } else {
          userLocationMarkerRef.current.setLngLat(userLocation.coordinates);
        }

        const el = userLocationMarkerRef.current.getElement();
        const beamEl = el.querySelector('.gps-heading-beam') as HTMLElement | null;
        if (beamEl) {
          beamEl.style.transform = `rotate(${userLocation.heading || 0}deg)`;
          beamEl.style.opacity = userLocation.heading != null ? '1' : '0';
        }
        const haloEl = el.querySelector('.gps-accuracy-halo') as HTMLElement | null;
        if (haloEl && userLocation.accuracyMeters) {
          const sz = Math.min(140, Math.max(48, Math.round(userLocation.accuracyMeters * 1.6)));
          haloEl.style.width = `${sz}px`;
          haloEl.style.height = `${sz}px`;
        }
      } else if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
    } catch (e) {
      console.warn('Error updating user location marker:', e);
    }
  }, [userLocation.coordinates, userLocation.heading, userLocation.accuracyMeters, mapLoaded]);

  // 8B. Mapped Traffic Signals Along Route (Requirement 10 & 11)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    routeTrafficSignalMarkersRef.current.forEach((m) => {
      try { m.remove(); } catch {}
    });
    routeTrafficSignalMarkersRef.current = [];

    const signals = selectedRoute?.trafficSignals || [];
    signals.forEach((sig) => {
      const el = document.createElement('div');
      el.className = 'route-traffic-signal-marker';
      el.innerHTML = `
        <div class="signal-pin-bubble" title="${sig.name} (${sig.distanceAlongRouteMeters}m along route)">
          <span class="signal-icon">🚦</span>
          <span class="signal-num">#${sig.signalNumber}</span>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(sig.coordinates)
        .addTo(map);
      routeTrafficSignalMarkersRef.current.push(marker);
    });

    return () => {
      routeTrafficSignalMarkersRef.current.forEach((m) => {
        try { m.remove(); } catch {}
      });
      routeTrafficSignalMarkersRef.current = [];
    };
  }, [selectedRoute?.id, selectedRoute?.trafficSignals, mapLoaded]);

  // 8B. Smooth Moving Emergency Vehicle Marker with Directional Arrow
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Display emergency vehicle marker ONLY when a mission is genuinely EN_ROUTE with speed or in DEMO simulation
    const shouldShowAmbulance =
      (currentMission.status === 'EN_ROUTE' && telemetry.speedKmh > 0) ||
      isDemoRunning;
    if (!shouldShowAmbulance) {
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
      return;
    }

    try {
      if (!vehicleMarkerRef.current) {
        const vEl = document.createElement('div');
        vEl.className = 'tactical-vehicle-marker';
        vEl.innerHTML = `
          <div class="vehicle-radar-ripple"></div>
          <div class="vehicle-strobe-halo"></div>
          <div class="vehicle-chassis" id="vehicle-chassis-arrow">
            <div class="vehicle-roof-lights">
              <span class="strobe-blue"></span>
              <span class="strobe-red"></span>
            </div>
            <svg class="vehicle-arrow-svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4 20l8-4 8 4z"/>
            </svg>
          </div>
          <div class="vehicle-telemetry-pill">
            <span class="v-callsign">${selectedVehicle.callsign}</span>
            <span class="v-speed" id="vehicle-marker-speed">0 km/h</span>
          </div>
        `;

        vehicleMarkerRef.current = new maplibregl.Marker({
          element: vEl,
          rotationAlignment: 'map',
          pitchAlignment: 'map',
        })
          .setLngLat(telemetry.currentCoordinates)
          .addTo(map);
      } else {
        vehicleMarkerRef.current.setLngLat(telemetry.currentCoordinates);

        const arrowEl = document.getElementById('vehicle-chassis-arrow');
        if (arrowEl) {
          arrowEl.style.transform = `rotate(${telemetry.headingDegrees}deg)`;
        }

        const speedEl = document.getElementById('vehicle-marker-speed');
        if (speedEl) {
          speedEl.innerText = `${Math.round(telemetry.speedKmh)} km/h`;
        }
      }
    } catch (e) {
      console.warn('Error updating vehicle marker:', e);
    }
  }, [telemetry.currentCoordinates, telemetry.headingDegrees, telemetry.speedKmh, selectedVehicle.callsign, activePortal, currentMission.status, isDemoRunning, mapLoaded]);

  // 9. Follow Camera Tracking (Smooth, Controlled, Cancelled on Manual Drag/Touch)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !followAmbulance) return;

    const targetCoords =
      activePortal === 'navigation' && userLocation.coordinates
        ? userLocation.coordinates
        : telemetry.currentCoordinates;

    if (!targetCoords) return;

    try {
      map.easeTo({
        center: targetCoords,
        zoom: Math.max(map.getZoom(), 15.0),
        pitch: 0,
        bearing: 0,
        duration: 700,
      });
    } catch (e) {
      console.warn('Follow camera error:', e);
    }
  }, [telemetry.currentCoordinates, userLocation.coordinates, activePortal, followAmbulance, mapLoaded]);

  // 10. Map Focus Targets (from Search or Selection)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !mapFocusCoords) return;

    try {
      map.flyTo({
        center: mapFocusCoords,
        zoom: mapFocusZoom || 15.0,
        pitch: 0,
        bearing: 0,
        duration: 1000,
      });
    } catch (e) {
      console.warn('Map focus flyTo error:', e);
    }
  }, [mapFocusCoords, mapFocusZoom, mapLoaded]);

  // Recenter Handler (Follows device GPS in citizen mode or emergency vehicle in dispatch mode)
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const targetCoords =
      activePortal === 'navigation' && userLocation.coordinates
        ? userLocation.coordinates
        : (telemetry.currentCoordinates || currentMission.originCoords);

    try {
      map.easeTo({
        center: targetCoords,
        zoom: 15.0,
        pitch: 0,
        bearing: 0,
        duration: 500,
      });
      setFollowAmbulance(true);
      setIsFollowMe(true);
    } catch (e) {
      console.warn('Recenter error:', e);
    }
  }, [telemetry.currentCoordinates, userLocation.coordinates, currentMission.originCoords, activePortal]);

  // Zoom Button Handlers
  const handleZoomIn = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomTo(map.getZoom() + 1, { duration: 250 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomTo(map.getZoom() - 1, { duration: 250 });
  }, []);

  return (
    <div className="map-viewport-wrapper">
      {/* Real High-Performance MapLibre GL JS Vector Map Canvas */}
      <div
        ref={mapContainerRef}
        className="map-canvas-container"
        style={{ width: '100%', height: '100%', background: '#0f172a' }}
      />

      {/* Map Error Banner (if MapTiler key missing or tile load fails) */}
      {mapError && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 600,
            background: 'rgba(239, 68, 68, 0.95)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 600,
            maxWidth: 500,
          }}
        >
          <AlertTriangle size={20} />
          <span>{mapError}</span>
        </div>
      )}

      {/* Phase 10: Smooth, Non-Obtrusive Base Map Loading & Status Indicator */}
      {!mapLoaded && !mapError && (
        <div
          style={{
            position: 'absolute',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 600,
            background: 'rgba(9, 13, 22, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 24,
            padding: '7px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
            color: '#f8fafc',
            fontSize: 12,
            fontWeight: 700,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 13,
              height: 13,
              border: '2px solid rgba(56, 189, 248, 0.25)',
              borderTopColor: '#38bdf8',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>RoadRisk AI • Loading live map…</span>
        </div>
      )}

      {/* Phase 8: Clean Primary Control Dock (Right Side) */}
      {mapLoaded && (
        <>
          <div className="map-hud-controls">
            {/* Zoom In / Out Pill */}
            <div className="hud-zoom-pill">
              <button
                className="hud-zoom-btn"
                onClick={handleZoomIn}
                title="Zoom In (+)"
                aria-label="Zoom In"
              >
                <Plus size={16} />
              </button>
              <div className="hud-zoom-divider" />
              <button
                className="hud-zoom-btn"
                onClick={handleZoomOut}
                title="Zoom Out (−)"
                aria-label="Zoom Out"
              >
                <Minus size={16} />
              </button>
            </div>

            {/* Recenter Map Camera */}
            <button
              className="hud-btn hud-icon-only"
              onClick={handleRecenter}
              title="Recenter Map on Current Position"
              aria-label="Recenter"
            >
              <Crosshair size={18} color="#38bdf8" />
            </button>

            {/* Follow-Me Camera Mode Toggle */}
            <button
              className={`hud-btn hud-icon-only ${isFollowMe ? 'active' : ''}`}
              onClick={() => setIsFollowMe((prev) => !prev)}
              title={isFollowMe ? 'Follow GPS: Active' : 'Follow GPS: Inactive'}
              aria-label="Follow GPS"
              style={{
                borderColor: isFollowMe ? '#10b981' : undefined,
                background: isFollowMe ? 'rgba(16, 185, 129, 0.2)' : undefined,
              }}
            >
              <Compass size={18} color={isFollowMe ? '#10b981' : '#94a3b8'} />
            </button>

            {/* Map Layers Menu Toggle */}
            <button
              className={`hud-btn hud-icon-only ${showLayersMenu ? 'active' : ''}`}
              onClick={() => setShowLayersMenu((prev) => !prev)}
              title="Map Layers & Overlays"
              aria-label="Layers"
            >
              <Layers size={18} color="#38bdf8" />
            </button>

            {/* Style Theme Switcher (MapTiler Streets vs Dark) */}
            <button
              className="hud-btn hud-icon-only"
              onClick={() => {
                const nextStyle = currentStyleKey === 'streets' ? 'dark' : 'streets';
                handleStyleChange(nextStyle);
              }}
              title={`Toggle Map Style (Current: ${currentStyleKey.toUpperCase()})`}
              aria-label="Map Style"
            >
              {currentStyleKey === 'streets' ? <Sun size={18} color="#f59e0b" /> : <Moon size={18} color="#38bdf8" />}
            </button>
          </div>

          {/* Secondary Control: Grouped Map Layers & Feeds Flyout */}
          {showLayersMenu && (
            <div
              style={{
                position: 'absolute',
                top: 20,
                right: 70,
                background: 'rgba(9, 13, 22, 0.97)',
                backdropFilter: 'blur(20px)',
                borderRadius: 14,
                border: '1px solid rgba(56, 189, 248, 0.35)',
                boxShadow: '0 20px 48px rgba(0,0,0,0.85)',
                padding: '14px 16px',
                width: 250,
                zIndex: 920,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.5)', paddingBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.05em' }}>
                  MAP LAYERS & FEEDS
                </span>
                <button
                  onClick={() => setShowLayersMenu(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: 2 }}
                >
                  ✕
                </button>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: '#f8fafc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isTrafficVisible}
                  onChange={(e) => setIsTrafficVisible(e.target.checked)}
                />
                <span>Live Traffic Flow</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: trafficService.isLiveTrafficConfigured() ? '#10b981' : '#f59e0b', marginLeft: 'auto' }}>
                  {trafficService.isLiveTrafficConfigured() ? 'LIVE' : 'N/A'}
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: '#f8fafc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isIncidentsVisible}
                  onChange={(e) => setIsIncidentsVisible(e.target.checked)}
                />
                <span>Road Incidents & Closures</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: '#f8fafc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isCitizenReportsVisible}
                  onChange={(e) => setIsCitizenReportsVisible(e.target.checked)}
                />
                <span>Citizen Hazard Reports</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: '#f8fafc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isFloodVisible}
                  onChange={(e) => setIsFloodVisible(e.target.checked)}
                />
                <span>Flood Risk Zones</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: '#f8fafc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isRiskVisible}
                  onChange={(e) => setIsRiskVisible(e.target.checked)}
                />
                <span>Road Risk Corridors</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: '#f8fafc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isEmergencyVisible}
                  onChange={(e) => setIsEmergencyVisible(e.target.checked)}
                />
                <span>Emergency Vehicles</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: '#f8fafc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isHospitalsVisible}
                  onChange={(e) => setIsHospitalsVisible(e.target.checked)}
                />
                <span>Hospitals & Facilities</span>
              </label>

              {/* Action Buttons Inside Layers Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid rgba(51, 65, 85, 0.5)', paddingTop: 10, marginTop: 4 }}>
                <button
                  onClick={() => setShowOfflineMapModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <HardDrive size={14} />
                  <span>Offline Regional Storage</span>
                </button>

                <button
                  onClick={() => setShowDataHealth(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(6, 182, 212, 0.12)',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    color: '#22d3ee',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Activity size={14} />
                  <span>Telemetry & Health Feeds</span>
                </button>

                <button
                  onClick={() => setShowReportAheadModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <AlertTriangle size={14} />
                  <span>Report Road Hazard</span>
                </button>
              </div>
            </div>
          )}

          {/* Collapsible Traffic & Risk Index Legend */}
          <div className="map-risk-legend">
            <div
              className="legend-title"
              onClick={() => setIsLegendOpen((prev) => !prev)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
              title="Click to toggle traffic and risk legend"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Car size={12} color={trafficService.isLiveTrafficConfigured() ? '#10b981' : '#94a3b8'} />
                <span>TRAFFIC: {trafficService.isLiveTrafficConfigured() ? 'LIVE' : 'NOT CONFIGURED'}</span>
              </div>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{isLegendOpen ? '▲ Hide' : '▼ View'}</span>
            </div>
            {isLegendOpen && (
              <div className="legend-bar animate-fade-in" style={{ marginTop: 6 }}>
                <div className="legend-step" style={{ background: '#22c55e' }} title="Green: Free Flow">
                  <span>Free</span>
                </div>
                <div className="legend-step" style={{ background: '#eab308' }} title="Yellow: Moderate">
                  <span>Mod</span>
                </div>
                <div className="legend-step" style={{ background: '#f97316' }} title="Orange: Heavy">
                  <span>Heavy</span>
                </div>
                <div className="legend-step" style={{ background: '#ef4444' }} title="Red: Severe Standstill">
                  <span>Severe</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Segment Detail Inspection Modal */}
      {selectedSegmentData && (
        <div className="segment-detail-drawer animate-slide-up">
          <div className="drawer-header">
            <div className="drawer-badge" style={{ background: getRiskColor(selectedSegmentData.riskScore) }}>
              RISK {selectedSegmentData.riskScore}/100 • {selectedSegmentData.riskLevel}
            </div>
            <button className="drawer-close-btn" onClick={() => setSelectedSegmentData(null)}>
              ✕
            </button>
          </div>

          <h3 className="drawer-road-name">{selectedSegmentData.name}</h3>

          <div className="drawer-stats-grid">
            <div className="stat-box">
              <span className="stat-label">Road Width</span>
              <span className="stat-val">{selectedSegmentData.roadWidthMeters} meters</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Hard Brakings</span>
              <span className="stat-val font-mono">{selectedSegmentData.hardBrakingCount} events</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Slowdowns</span>
              <span className="stat-val font-mono">{selectedSegmentData.suddenSlowdownsCount} spikes</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Surface State</span>
              <span className="stat-val capitalize">{selectedSegmentData.surfaceCondition}</span>
            </div>
          </div>

          <div className="factors-breakdown">
            <h4 className="factors-heading">Contributing Factor Breakdown:</h4>
            {selectedSegmentData.factors.map((f, i) => (
              <div key={i} className="factor-row">
                <div className="factor-title">
                  <span className={`factor-dot severity-${f.severity}`} />
                  <strong>{f.name}</strong>
                  <span className="factor-points">
                    {f.contribution > 0 ? `+${f.contribution}` : `${f.contribution}`} pts
                  </span>
                </div>
                <p className="factor-desc">{f.description}</p>
              </div>
            ))}
          </div>

          <div className="suitability-callout">
            <strong>Vehicle Clearance: </strong>
            {selectedVehicle.widthMeters <= selectedSegmentData.roadWidthMeters - 1.0 ? (
              <span className="text-emerald-400">
                Compatible. {selectedVehicle.callsign} ({selectedVehicle.widthMeters}m width) has safe passage margin.
              </span>
            ) : (
              <span className="text-rose-400">
                Tight margin for {selectedVehicle.name}. Caution advised.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Active Hazard Popover */}
      {activeHazardPopup && (
        <div className="hazard-popup-modal animate-slide-up">
          <div className="hazard-modal-head">
            <ShieldAlert size={20} className="text-rose-400" />
            <div>
              <span className="hazard-modal-tag">ACTIVE HAZARD TELEMETRY</span>
              <h4 className="hazard-modal-title">{activeHazardPopup.title}</h4>
            </div>
            <button className="drawer-close-btn" onClick={() => setActiveHazardPopup(null)}>
              ✕
            </button>
          </div>

          <p className="hazard-modal-loc">
            <strong>Location: </strong>
            {activeHazardPopup.locationName} ({activeHazardPopup.detectedAt})
          </p>

          <p className="hazard-modal-desc">{activeHazardPopup.description}</p>

          <div className="hazard-action-box">
            <strong>Recommended Protocol: </strong>
            <span>{activeHazardPopup.recommendedAction}</span>
          </div>
        </div>
      )}

      {/* Google-Maps-Style Place Information Panel (Contextual & Interactive) */}
      {selectedPlace && routes.length === 0 && navigationPhase !== 'NAVIGATING' && (
        <PlaceInformationPanel
          place={selectedPlace}
          onClose={closePlacePanel}
          onGetDirections={(p) => {
            setDestinationLocation(p.name, [p.longitude, p.latitude]);
          }}
        />
      )}

      {/* Traffic System Status & Setup Modal (Explains Live vs Not Configured per Rule 27) */}
      {showTrafficDialog && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowTrafficDialog(false)}
        >
          <div
            style={{
              background: '#090d16',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 460,
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'rgba(56, 189, 248, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Car size={20} color="#38bdf8" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                    Traffic Intelligence Status
                  </h3>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    Worldwide Flow Speeds & Real Delay Telemetry
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowTrafficDialog(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: 'rgba(148, 163, 184, 0.1)',
                borderRadius: 8,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>DATA STATUS:</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: trafficService.isLiveTrafficConfigured() ? '#10b981' : '#f59e0b',
                }}
              >
                {trafficService.isLiveTrafficConfigured() ? '🟢 LIVE (TomTom Traffic Feed Connected)' : '⚪ NOT CONFIGURED'}
              </span>
            </div>

            <p style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 12px' }}>
              RoadRisk AI uses genuine <strong>TomTom Traffic API</strong> for live worldwide vehicle flow speeds, incident tiles, and congestion-adjusted ETAs.
            </p>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                padding: 12,
                borderRadius: 8,
                border: '1px solid rgba(51, 65, 85, 0.5)',
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                To activate live traffic flow across all roads, add to <code>.env</code>:
              </div>
              <code style={{ fontSize: 12, color: '#38bdf8', fontFamily: 'monospace', display: 'block' }}>
                VITE_TRAFFIC_API_KEY=your_tomtom_api_key
              </code>
            </div>

            <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.4, marginBottom: 18 }}>
              💡 TomTom provides a <strong>free developer tier</strong> with 2,500 daily requests (zero credit card required) at{' '}
              <a
                href="https://developer.tomtom.com"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#38bdf8', textDecoration: 'underline' }}
              >
                developer.tomtom.com
              </a>.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowTrafficDialog(false)}
                style={{
                  background: '#0284c7',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '8px 18px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact Road Incident Popup (Phase 4) */}
      {selectedIncident && (
        <div className="hazard-popup-modal animate-slide-up" style={{ borderColor: '#ef4444' }}>
          <div className="hazard-modal-head">
            <ShieldAlert size={20} className="text-rose-400" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="hazard-modal-tag" style={{ color: '#ef4444' }}>
                  {selectedIncident.category.replace('_', ' ')}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: selectedIncident.severity === 'critical' ? '#dc2626' : '#f97316',
                    color: '#fff',
                  }}
                >
                  {selectedIncident.severity.toUpperCase()}
                </span>
              </div>
              <h4 className="hazard-modal-title">{selectedIncident.title}</h4>
            </div>
            <button className="drawer-close-btn" onClick={() => setSelectedIncident(null)}>
              ✕
            </button>
          </div>
          <p className="hazard-modal-loc">
            {selectedIncident.roadName || `Coordinates [${selectedIncident.latitude.toFixed(4)}, ${selectedIncident.longitude.toFixed(4)}]`}
          </p>
          <p className="hazard-modal-desc">{selectedIncident.description}</p>
          {selectedIncident.delaySeconds > 0 && (
            <div
              style={{
                fontSize: 11,
                color: '#f97316',
                fontWeight: 700,
                background: 'rgba(249, 115, 22, 0.1)',
                padding: '4px 8px',
                borderRadius: 4,
              }}
            >
              Estimated Delay: +{Math.round(selectedIncident.delaySeconds / 60)} min
            </div>
          )}
          <div style={{ fontSize: 10, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Source: {selectedIncident.source}</span>
            <span>Status: {selectedIncident.status}</span>
          </div>
        </div>
      )}

      {/* Compact Citizen Report Popup (Phase 9) */}
      {selectedCitizenReport && (
        <div className="hazard-popup-modal animate-slide-up" style={{ borderColor: '#f59e0b' }}>
          <div className="hazard-modal-head">
            <AlertTriangle size={20} color="#f59e0b" />
            <div style={{ flex: 1 }}>
              <span className="hazard-modal-tag" style={{ color: '#f59e0b' }}>
                CITIZEN REPORT • {selectedCitizenReport.status}
              </span>
              <h4 className="hazard-modal-title">{selectedCitizenReport.title}</h4>
            </div>
            <button className="drawer-close-btn" onClick={() => setSelectedCitizenReport(null)}>
              ✕
            </button>
          </div>
          <p className="hazard-modal-loc">{selectedCitizenReport.locationName}</p>
          <p className="hazard-modal-desc">{selectedCitizenReport.description}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Confirmations: <strong style={{ color: '#f59e0b' }}>{selectedCitizenReport.verificationCount}</strong>
            </span>
            <button
              onClick={async () => {
                const updated = await hazardReportService.corroborateReport(selectedCitizenReport.id);
                if (updated) setSelectedCitizenReport({ ...updated });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: '#f59e0b',
                color: '#000',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <ThumbsUp size={12} />
              <span>Confirm Hazard</span>
            </button>
          </div>
        </div>
      )}

      {/* Real-Time Telemetry & Subsystems Observability Modal */}
      <DataHealthModal isOpen={showDataHealth} onClose={() => setShowDataHealth(false)} />

      {/* Report Ahead Modal (Phase 9) */}
      <ReportAheadModal
        isOpen={showReportAheadModal}
        onClose={() => setShowReportAheadModal(false)}
        currentCoordinates={userLocation.coordinates || [78.4744, 17.3616]}
        onReportSubmitted={() => {
          const reps = hazardReportService.getActiveReports();
          setCitizenReports(reps);
        }}
      />

      {/* Offline Map & Routing Regional Storage Modal (Part 25) */}
      <OfflineMapManagerModal
        isOpen={showOfflineMapModal}
        onClose={() => setShowOfflineMapModal(false)}
      />
    </div>
  );
};

export default MapContainer;
