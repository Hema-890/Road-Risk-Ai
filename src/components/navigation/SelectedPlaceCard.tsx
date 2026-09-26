// ==============================================================================
// ROADRISK AI — SELECTED PLACE POPUP & QUICK ACTION CARD
// Displays clean metadata, distance, and direct navigation triggers
// for any selected search result or clicked landmark.
// ==============================================================================

import React, { useState } from 'react';
import {
  X,
  Navigation,
  CornerUpRight,
  Bookmark,
  Share2,
  MapPin,
  Check,
  Building2,
  Hospital,
  Fuel,
  Train,
  Utensils,
  GraduationCap,
} from 'lucide-react';
import type { SearchResult } from '../../services/searchService.ts';

interface SelectedPlaceCardProps {
  place: SearchResult;
  onClose: () => void;
  onGetDirections: (place: SearchResult) => void;
  onStartNavigation: (place: SearchResult) => void;
}

export const SelectedPlaceCard: React.FC<SelectedPlaceCardProps> = ({
  place,
  onClose,
  onGetDirections,
  onStartNavigation,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [isShared, setIsShared] = useState(false);

  const getPlaceIcon = (type: string) => {
    switch (type) {
      case 'hospital':
        return <Hospital size={18} color="#ef4444" />;
      case 'fuel':
      case 'ev':
        return <Fuel size={18} color="#f59e0b" />;
      case 'station':
      case 'railway':
        return <Train size={18} color="#8b5cf6" />;
      case 'restaurant':
        return <Utensils size={18} color="#ec4899" />;
      case 'university':
      case 'school':
        return <GraduationCap size={18} color="#3b82f6" />;
      case 'city':
      case 'town':
      case 'village':
        return <Building2 size={18} color="#10b981" />;
      default:
        return <MapPin size={18} color="#38bdf8" />;
    }
  };

  const handleShare = async () => {
    const text = `${place.name} - ${place.coordinates[1].toFixed(5)}, ${place.coordinates[0].toFixed(5)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: place.name, text, url: window.location.href });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      setIsShared(true);
      setTimeout(() => setIsShared(false), 2500);
    } catch {}
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    try {
      const saved = JSON.parse(localStorage.getItem('roadrisk_saved_places') || '[]');
      if (!isSaved) {
        saved.push({ id: place.id, name: place.name, coords: place.coordinates });
      } else {
        const filtered = saved.filter((s: any) => s.id !== place.id);
        localStorage.setItem('roadrisk_saved_places', JSON.stringify(filtered));
        return;
      }
      localStorage.setItem('roadrisk_saved_places', JSON.stringify(saved));
    } catch {}
  };

  return (
    <div
      role="dialog"
      aria-label={`Place details for ${place.name}`}
      style={{
        position: 'absolute',
        bottom: 24,
        left: 20,
        width: 380,
        maxWidth: 'calc(100vw - 40px)',
        background: 'rgba(11, 15, 25, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 14,
        padding: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.1)',
        zIndex: 40,
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(51, 65, 85, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {getPlaceIcon(place.type)}
          </div>

          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc', lineHeight: 1.25 }}>
              {place.name}
            </h3>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
              {place.category} • {place.provider}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close place details"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Address & Distance */}
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
        {place.address || place.displayName}
      </div>

      {place.distanceKm != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>
          <MapPin size={13} />
          <span>{place.distanceKm.toFixed(1)} km from your current location</span>
        </div>
      )}

      {/* Action Buttons: DIRECTIONS, START, SAVE, SHARE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr 0.8fr', gap: 6, marginTop: 4 }}>
        <button
          onClick={() => onGetDirections(place)}
          style={{
            padding: '9px 10px',
            borderRadius: 8,
            border: '1px solid #38bdf8',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.15))',
            color: '#38bdf8',
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            cursor: 'pointer',
          }}
        >
          <CornerUpRight size={14} />
          DIRECTIONS
        </button>

        <button
          onClick={() => onStartNavigation(place)}
          style={{
            padding: '9px 10px',
            borderRadius: 8,
            border: 'none',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            cursor: 'pointer',
          }}
        >
          <Navigation size={14} />
          START
        </button>

        <button
          onClick={handleSave}
          title={isSaved ? 'Saved in offline favorites' : 'Save place'}
          style={{
            padding: '9px',
            borderRadius: 8,
            border: '1px solid rgba(51, 65, 85, 0.6)',
            background: isSaved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.6)',
            color: isSaved ? '#10b981' : '#94a3b8',
            fontSize: 11,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          {isSaved ? <Check size={13} /> : <Bookmark size={13} />}
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        <button
          onClick={handleShare}
          title="Share place coordinates"
          style={{
            padding: '9px',
            borderRadius: 8,
            border: '1px solid rgba(51, 65, 85, 0.6)',
            background: isShared ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.6)',
            color: isShared ? '#38bdf8' : '#94a3b8',
            fontSize: 11,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          {isShared ? <Check size={13} /> : <Share2 size={13} />}
          <span>{isShared ? 'Copied' : 'Share'}</span>
        </button>
      </div>
    </div>
  );
};

export default SelectedPlaceCard;
