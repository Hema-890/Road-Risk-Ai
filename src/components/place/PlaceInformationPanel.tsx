import React, { useState, useEffect } from 'react';
import { NormalizedPlace, PlaceService } from '../../services/placeService';
import { useApp } from '../../context/AppContext';
import {
  Navigation,
  Bookmark,
  Share2,
  X,
  Compass,
  MapPin,
  Building,
  Building2,
  Fuel,
  Utensils,
  Train,
  CloudSun,
  ShieldAlert,
  ExternalLink,
  ChevronRight,
  Info,
  Check,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface PlaceInformationPanelProps {
  place: NormalizedPlace | null;
  onClose: () => void;
  onGetDirections: (place: NormalizedPlace) => void;
}

export const PlaceInformationPanel: React.FC<PlaceInformationPanelProps> = ({
  place,
  onClose,
  onGetDirections,
}) => {
  const { flyToLocation } = useApp();

  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [imageError, setImageError] = useState<boolean>(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NormalizedPlace[]>([]);
  const [loadingNearby, setLoadingNearby] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'photos' | 'nearby'>('overview');

  // Reset state when selected place changes
  useEffect(() => {
    setActivePhotoIndex(0);
    setImageError(false);
    setActiveTab('overview');

    if (!place) {
      setNearbyPlaces([]);
      return;
    }

    // Check if saved in localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('roadrisk_saved_places') || '[]');
      setIsSaved(saved.some((p: any) => p.id === place.id));
    } catch {
      setIsSaved(false);
    }

    // Fetch nearby POIs
    setLoadingNearby(true);
    PlaceService.getNearbyPlaces([place.longitude, place.latitude], 'amenity', 6)
      .then((items) => {
        setNearbyPlaces(items.filter((item) => item.name !== place.name));
      })
      .finally(() => {
        setLoadingNearby(false);
      });
  }, [place?.id, place?.longitude, place?.latitude]);

  if (!place) return null;

  const currentPhoto = place.photos && place.photos.length > 0 ? place.photos[activePhotoIndex] : place.image;

  // Toggle Save to Favorites
  const handleToggleSave = () => {
    try {
      const existing = JSON.parse(localStorage.getItem('roadrisk_saved_places') || '[]');
      let updated;
      if (isSaved) {
        updated = existing.filter((p: any) => p.id !== place.id);
        setIsSaved(false);
      } else {
        updated = [place, ...existing.filter((p: any) => p.id !== place.id)].slice(0, 20);
        setIsSaved(true);
      }
      localStorage.setItem('roadrisk_saved_places', JSON.stringify(updated));
    } catch {}
  };

  // Share link
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}?lat=${place.latitude.toFixed(5)}&lng=${place.longitude.toFixed(5)}&q=${encodeURIComponent(place.name)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${place.name} — RoadRisk AI Map`,
          text: `Check out ${place.name} on RoadRisk AI Navigation Map`,
          url: shareUrl,
        });
        return;
      } catch {}
    }
    // Fallback copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {}
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'city':
      case 'town':
        return '#0284c7';
      case 'highway':
      case 'road':
        return '#8b5cf6';
      case 'hospital':
        return '#ef4444';
      case 'fuel':
      case 'ev_charging':
        return '#f59e0b';
      case 'transit':
      case 'railway_station':
      case 'bus_stop':
        return '#10b981';
      case 'restaurant':
        return '#f97316';
      default:
        return '#38bdf8';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'city':
        return 'City';
      case 'town':
        return 'Town';
      case 'village':
        return 'Village';
      case 'highway':
        return 'National Highway';
      case 'road':
        return 'Road / Street';
      case 'hospital':
        return 'Hospital / Trauma';
      case 'fuel':
        return 'Petrol Station';
      case 'ev_charging':
        return 'EV Charging';
      case 'railway_station':
        return 'Railway Station';
      case 'bus_stop':
        return 'Bus Station';
      case 'restaurant':
        return 'Restaurant';
      case 'hotel':
        return 'Hotel / Lodging';
      case 'airport':
        return 'Airport';
      case 'landmark':
        return 'Landmark';
      default:
        return 'Point of Interest';
    }
  };

  return (
    <div
      className="place-information-panel animate-slide-right"
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        bottom: 24,
        width: 390,
        maxWidth: 'calc(100vw - 40px)',
        zIndex: 510,
        background: 'rgba(9, 13, 22, 0.96)',
        backdropFilter: 'blur(24px)',
        borderRadius: 20,
        border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#f8fafc',
      }}
    >
      {/* 1. Header Media / Hero Photo with fallback */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 190,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {currentPhoto && !imageError ? (
          <img
            src={currentPhoto}
            alt={place.name}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.4s ease, opacity 0.3s ease',
            }}
          />
        ) : (
          /* Clean Geometric Placeholder (No broken images) */
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'radial-gradient(circle at center, #1e293b 0%, #090d16 100%)',
              color: '#64748b',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <MapPin size={26} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: '#94a3b8' }}>
              GEOGRAPHIC PLACE DETAILS
            </span>
          </div>
        )}

        {/* Gradient Scrim for readable header controls */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(9,13,22,0.6) 0%, transparent 40%, rgba(9,13,22,0.95) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close Place Panel"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f8fafc',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.75)')}
        >
          <X size={17} />
        </button>

        {/* Live Weather Pill (Top Left) */}
        {place.weather && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: 'rgba(15, 23, 42, 0.8)',
              backdropFilter: 'blur(8px)',
              borderRadius: 20,
              padding: '4px 10px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: '#38bdf8',
            }}
          >
            <CloudSun size={13} />
            <span>{place.weather.temperatureC}°C</span>
            <span style={{ color: '#94a3b8' }}>• {place.weather.condition}</span>
          </div>
        )}

        {/* Photo indicator badge */}
        {place.photos && place.photos.length > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              borderRadius: 12,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 600,
              color: '#e2e8f0',
            }}
          >
            Photo {activePhotoIndex + 1} of {place.photos.length}
          </div>
        )}
      </div>

      {/* 2. Place Identity & Main Title */}
      <div style={{ padding: '16px 20px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            style={{
              background: `${getBadgeColor(place.type)}22`,
              color: getBadgeColor(place.type),
              border: `1px solid ${getBadgeColor(place.type)}55`,
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {getTypeLabel(place.type)}
          </span>

          {place.distanceKm !== undefined && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {place.distanceKm} km away
            </span>
          )}
        </div>

        <h2
          style={{
            margin: '0 0 4px',
            fontSize: 20,
            fontWeight: 800,
            color: '#f8fafc',
            lineHeight: 1.25,
            wordBreak: 'break-word',
          }}
        >
          {place.name}
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: '#94a3b8',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {place.address}
        </p>
      </div>

      {/* 3. Primary Action Buttons (Google Maps standard: Directions, Save, Share) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr',
          gap: 8,
          padding: '8px 20px 14px',
          borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
          flexShrink: 0,
        }}
      >
        {/* Directions Button */}
        <button
          onClick={() => onGetDirections(place)}
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
            transition: 'all 0.15s ease',
          }}
        >
          <Navigation size={15} />
          <span>Directions</span>
        </button>

        {/* Save to Favorites Button */}
        <button
          onClick={handleToggleSave}
          style={{
            background: isSaved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.7)',
            color: isSaved ? '#10b981' : '#cbd5e1',
            border: `1px solid ${isSaved ? '#10b981' : 'rgba(51, 65, 85, 0.7)'}`,
            borderRadius: 12,
            padding: '10px 10px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            transition: 'all 0.15s ease',
          }}
        >
          <Bookmark size={14} fill={isSaved ? '#10b981' : 'none'} />
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          style={{
            background: 'rgba(30, 41, 59, 0.7)',
            color: '#cbd5e1',
            border: '1px solid rgba(51, 65, 85, 0.7)',
            borderRadius: 12,
            padding: '10px 10px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            transition: 'all 0.15s ease',
          }}
        >
          {copiedToast ? <Check size={14} color="#10b981" /> : <Share2 size={14} />}
          <span>{copiedToast ? 'Copied' : 'Share'}</span>
        </button>
      </div>

      {/* 4. Tab Selector (Overview | Photos | Nearby) */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
          padding: '0 20px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'overview' ? '#38bdf8' : '#94a3b8',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Overview
        </button>

        {place.photos && place.photos.length > 0 && (
          <button
            onClick={() => setActiveTab('photos')}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'photos' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'photos' ? '#38bdf8' : '#94a3b8',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Photos ({place.photos.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('nearby')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'nearby' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'nearby' ? '#38bdf8' : '#94a3b8',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Nearby ({nearbyPlaces.length})
        </button>
      </div>

      {/* 5. Scrollable Content Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            {/* Sourced Wikipedia Overview / Extract */}
            {place.extract ? (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  borderRadius: 12,
                  padding: 14,
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Info size={14} color="#38bdf8" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.04em' }}>
                    SOURCED GEOGRAPHIC OVERVIEW
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.6 }}>
                  {place.extract}
                </p>
                {place.wikipediaUrl && (
                  <a
                    href={place.wikipediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 10,
                      fontSize: 11,
                      color: '#38bdf8',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <span>Read on Wikipedia</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: 12,
                  padding: 12,
                  border: '1px solid rgba(51, 65, 85, 0.4)',
                  fontSize: 12,
                  color: '#94a3b8',
                }}
              >
                Geographic entity located in {place.city || place.state || place.country || 'the region'}. Ready for route planning and hazard telemetry analysis.
              </div>
            )}

            {/* Road & Traffic Intelligence (Strictly labeled DEMO/LIVE per rule 27) */}
            {place.roadInfo && (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  borderRadius: 12,
                  padding: 14,
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={14} color="#a855f7" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#a855f7' }}>ROAD & TRAFFIC STATUS</span>
                  </div>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background:
                        place.roadInfo.trafficDataSource === 'LIVE'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : place.roadInfo.trafficDataSource === 'DEMO'
                          ? 'rgba(234, 179, 8, 0.15)'
                          : 'rgba(148, 163, 184, 0.15)',
                      color:
                        place.roadInfo.trafficDataSource === 'LIVE'
                          ? '#10b981'
                          : place.roadInfo.trafficDataSource === 'DEMO'
                          ? '#eab308'
                          : '#94a3b8',
                      border: `1px solid ${
                        place.roadInfo.trafficDataSource === 'LIVE'
                          ? 'rgba(16, 185, 129, 0.3)'
                          : place.roadInfo.trafficDataSource === 'DEMO'
                          ? 'rgba(234, 179, 8, 0.3)'
                          : 'rgba(148, 163, 184, 0.3)'
                      }`,
                    }}
                  >
                    TRAFFIC: {place.roadInfo.trafficDataSource}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  <div style={{ background: 'rgba(9, 13, 22, 0.6)', padding: 8, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Classification</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                      {place.roadInfo.roadClass || 'Urban Corridor'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(9, 13, 22, 0.6)', padding: 8, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>
                      {place.roadInfo.trafficDataSource === 'LIVE' ? 'Live Flow Speed' : 'Risk Assessment'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                      {place.roadInfo.trafficDataSource === 'LIVE' && place.roadInfo.currentSpeedKmh !== undefined
                        ? `${place.roadInfo.currentSpeedKmh} km/h (Free: ${place.roadInfo.freeFlowSpeedKmh} km/h)`
                        : place.roadInfo.riskIndex !== undefined
                        ? `${place.roadInfo.riskIndex}/100 • ${place.roadInfo.riskLevel}`
                        : 'Unrated (Key Required)'}
                    </div>
                  </div>
                </div>
                {place.roadInfo.sourceNotice && (
                  <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 8, fontStyle: 'italic' }}>
                    ℹ️ {place.roadInfo.sourceNotice}
                  </div>
                )}
              </div>
            )}

            {/* Quick Geo Facts */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: 12,
                padding: 12,
                border: '1px solid rgba(51, 65, 85, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>
                GEOGRAPHIC COORDINATES
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>Latitude, Longitude</span>
                <span style={{ fontFamily: 'monospace', color: '#f8fafc', fontWeight: 600 }}>
                  {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                </span>
              </div>
              {place.state && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>State / Province</span>
                  <span style={{ color: '#f8fafc' }}>{place.state}</span>
                </div>
              )}
              {place.country && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Country</span>
                  <span style={{ color: '#f8fafc' }}>{place.country}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 2: PHOTOS GALLERY */}
        {activeTab === 'photos' && place.photos && place.photos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                width: '100%',
                height: 180,
                borderRadius: 12,
                overflow: 'hidden',
                background: '#0f172a',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              <img
                src={place.photos[activePhotoIndex]}
                alt={`${place.name} view ${activePhotoIndex + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {place.photos.map((photo, idx) => (
                <div
                  key={idx}
                  onClick={() => setActivePhotoIndex(idx)}
                  style={{
                    height: 60,
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: activePhotoIndex === idx ? '2px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.6)',
                    opacity: activePhotoIndex === idx ? 1 : 0.6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <img
                    src={photo}
                    alt="thumbnail"
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
              Photos legally retrieved via Wikimedia Commons
            </div>
          </div>
        )}

        {/* TAB 3: NEARBY PLACES */}
        {activeTab === 'nearby' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadingNearby ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#38bdf8', fontSize: 12 }}>
                Searching nearby facilities...
              </div>
            ) : nearbyPlaces.length > 0 ? (
              nearbyPlaces.map((near) => (
                <div
                  key={near.id}
                  onClick={() => flyToLocation([near.longitude, near.latitude], 16)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.6)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        color: getBadgeColor(near.type),
                        background: `${getBadgeColor(near.type)}20`,
                        padding: 6,
                        borderRadius: 6,
                      }}
                    >
                      <MapPin size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#f8fafc' }}>
                        {near.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                        {near.type.toUpperCase()} • {near.distanceKm} km away
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={15} color="#64748b" />
                </div>
              ))
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                No nearby amenities found in immediate vicinity.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaceInformationPanel;
