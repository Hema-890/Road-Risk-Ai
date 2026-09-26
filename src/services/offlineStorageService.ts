// ==============================================================================
// ROADRISK AI — OFFLINE STORAGE SERVICE
// Manages local persistence for:
// 1. Downloaded geographic regions metadata
// 2. Local road graphs for offline routing
// 3. Local points of interest (POIs) for offline search
// 4. Pending citizen hazard reports queued while disconnected
// 5. Offline map raster/vector tile Cache Storage
// ==============================================================================

export interface OfflineRegionMeta {
  id: string;
  name: string;
  state: string;
  country: string;
  bounds: [[number, number], [number, number]]; // [[minLng, minLat], [maxLng, maxLat]]
  center: [number, number]; // [lng, lat]
  zoomMin: number;
  zoomMax: number;
  tileCount: number;
  sizeBytes: number;
  downloadedAt: string;
  roadGraphAvailable: boolean;
  poiCount: number;
}

export interface OfflineRoadNode {
  id: string;
  coords: [number, number]; // [lng, lat]
  name?: string;
}

export interface OfflineRoadEdge {
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  speedKmh: number;
  roadName: string;
  roadType: 'highway' | 'primary' | 'secondary' | 'residential' | 'link';
  geometry: [number, number][]; // coordinates along segment
}

export interface OfflineRoadGraph {
  regionId: string;
  regionName: string;
  bounds: [[number, number], [number, number]];
  nodes: OfflineRoadNode[];
  edges: OfflineRoadEdge[];
  updatedAt: string;
}

export interface OfflineLocalPoi {
  id: string;
  regionId: string;
  name: string;
  category: string;
  coordinates: [number, number];
  address: string;
}

export interface OfflinePendingReport {
  id: string;
  type: string;
  latitude: number;
  longitude: number;
  description: string;
  severity: string;
  createdAt: string;
  syncStatus: 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
}

const DB_NAME = 'roadrisk_offline_db';
const DB_VERSION = 1;
const TILE_CACHE_NAME = 'roadrisk-offline-tiles-v1';

class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memRegions = new Map<string, OfflineRegionMeta>();
  private memRoadGraphs = new Map<string, OfflineRoadGraph>();
  private memPois = new Map<string, OfflineLocalPoi>();
  private memReports = new Map<string, OfflinePendingReport>();

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported in this environment.'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('regions')) {
          db.createObjectStore('regions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('road_graphs')) {
          db.createObjectStore('road_graphs', { keyPath: 'regionId' });
        }
        if (!db.objectStoreNames.contains('local_pois')) {
          const poiStore = db.createObjectStore('local_pois', { keyPath: 'id' });
          poiStore.createIndex('regionId', 'regionId', { unique: false });
        }
        if (!db.objectStoreNames.contains('pending_reports')) {
          db.createObjectStore('pending_reports', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- REGIONS ---

  async saveRegion(meta: OfflineRegionMeta): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.memRegions.set(meta.id, meta);
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('regions', 'readwrite');
      tx.objectStore('regions').put(meta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllRegions(): Promise<OfflineRegionMeta[]> {
    if (typeof indexedDB === 'undefined') {
      return Array.from(this.memRegions.values());
    }
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('regions', 'readonly');
        const req = tx.objectStore('regions').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async getRegion(regionId: string): Promise<OfflineRegionMeta | null> {
    if (typeof indexedDB === 'undefined') {
      return this.memRegions.get(regionId) || null;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('regions', 'readonly');
      const req = tx.objectStore('regions').get(regionId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteRegion(regionId: string): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.memRegions.delete(regionId);
      this.memRoadGraphs.delete(regionId);
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['regions', 'road_graphs'], 'readwrite');
      tx.objectStore('regions').delete(regionId);
      tx.objectStore('road_graphs').delete(regionId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- ROAD GRAPH ---

  async saveRoadGraph(graph: OfflineRoadGraph): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.memRoadGraphs.set(graph.regionId, graph);
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('road_graphs', 'readwrite');
      tx.objectStore('road_graphs').put(graph);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getRoadGraph(regionId: string): Promise<OfflineRoadGraph | null> {
    if (typeof indexedDB === 'undefined') {
      return this.memRoadGraphs.get(regionId) || null;
    }
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('road_graphs', 'readonly');
        const req = tx.objectStore('road_graphs').get(regionId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async findGraphForCoordinate(coord: [number, number]): Promise<OfflineRoadGraph | null> {
    const regions = await this.getAllRegions();
    const [lng, lat] = coord;
    for (const reg of regions) {
      const [[minLng, minLat], [maxLng, maxLat]] = reg.bounds;
      if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
        const graph = await this.getRoadGraph(reg.id);
        if (graph) return graph;
      }
    }
    return null;
  }

  // --- LOCAL POIS ---

  async savePois(pois: OfflineLocalPoi[]): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      for (const poi of pois) {
        this.memPois.set(poi.id, poi);
      }
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('local_pois', 'readwrite');
      const store = tx.objectStore('local_pois');
      for (const poi of pois) {
        store.put(poi);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async searchLocalPois(query: string, limit = 10): Promise<OfflineLocalPoi[]> {
    if (typeof indexedDB === 'undefined') {
      const all = Array.from(this.memPois.values());
      const lower = query.toLowerCase();
      return all
        .filter((p) => p.name.toLowerCase().includes(lower) || p.address.toLowerCase().includes(lower))
        .slice(0, limit);
    }
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('local_pois', 'readonly');
        const req = tx.objectStore('local_pois').getAll();
        req.onsuccess = () => {
          const all: OfflineLocalPoi[] = req.result || [];
          const lower = query.toLowerCase();
          const matches = all
            .filter((p) => p.name.toLowerCase().includes(lower) || p.address.toLowerCase().includes(lower))
            .slice(0, limit);
          resolve(matches);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  // --- PENDING CITIZEN REPORTS ---

  async savePendingReport(report: OfflinePendingReport): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.memReports.set(report.id, report);
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_reports', 'readwrite');
      tx.objectStore('pending_reports').put(report);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingReports(): Promise<OfflinePendingReport[]> {
    if (typeof indexedDB === 'undefined') {
      return Array.from(this.memReports.values());
    }
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('pending_reports', 'readonly');
        const req = tx.objectStore('pending_reports').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async deletePendingReport(id: string): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.memReports.delete(id);
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_reports', 'readwrite');
      tx.objectStore('pending_reports').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- TILE CACHE (CacheStorage API) ---

  async cacheTile(url: string, response: Response): Promise<void> {
    if (typeof caches === 'undefined') return;
    try {
      const cache = await caches.open(TILE_CACHE_NAME);
      await cache.put(url, response);
    } catch (e) {
      console.warn('Failed to cache tile in CacheStorage:', e);
    }
  }

  async getCachedTile(url: string): Promise<Response | undefined> {
    if (typeof caches === 'undefined') return undefined;
    try {
      const cache = await caches.open(TILE_CACHE_NAME);
      return await cache.match(url);
    } catch {
      return undefined;
    }
  }

  async clearTileCache(): Promise<boolean> {
    if (typeof caches === 'undefined') return false;
    return caches.delete(TILE_CACHE_NAME);
  }
}

export const offlineStorageService = new OfflineStorageService();
export default offlineStorageService;
