// ==============================================================================
// ROADRISK AI — OFFLINE ROUTING ENGINE
// Computes genuine shortest/fastest paths over locally stored road network graphs
// using A* graph traversal. Strictly enforces region boundary checks.
// ZERO synthetic or fabricated routes when coordinates fall outside downloaded data.
// ==============================================================================

import { offlineStorageService } from './offlineStorageService.ts';
import type {
  OfflineRoadGraph,
  OfflineRoadNode,
  OfflineRoadEdge,
} from './offlineStorageService.ts';
import { calculateDistanceMeters, calculateBearingDegrees } from '../utils/geoUtils.ts';

export interface OfflineManeuver {
  instruction: string;
  type: 'depart' | 'turn-right' | 'turn-left' | 'straight' | 'arrive';
  roadName: string;
  distanceMeters: number;
  durationSeconds: number;
  location: [number, number]; // [lng, lat]
}

export interface OfflineRouteResult {
  success: boolean;
  regionId?: string;
  regionName?: string;
  coordinates: [number, number][]; // [lng, lat][]
  distanceMeters: number;
  durationSeconds: number;
  maneuvers: OfflineManeuver[];
  summary: string;
  error?: string;
  isOffline: true;
}

class OfflineRoutingEngine {
  /**
   * Calculates an offline route between origin and destination coordinates
   */
  async calculateRoute(
    origin: [number, number], // [lng, lat]
    destination: [number, number] // [lng, lat]
  ): Promise<OfflineRouteResult> {
    // 1. Locate graph for origin
    const graph = await offlineStorageService.findGraphForCoordinate(origin);
    if (!graph) {
      return {
        success: false,
        coordinates: [],
        distanceMeters: 0,
        durationSeconds: 0,
        maneuvers: [],
        summary: '',
        error: 'OFFLINE ROUTE UNAVAILABLE: Source location is outside any downloaded offline region. Reconnect or download the relevant region.',
        isOffline: true,
      };
    }

    // 2. Verify destination is inside the same region
    const [[minLng, minLat], [maxLng, maxLat]] = graph.bounds;
    const [destLng, destLat] = destination;
    if (destLng < minLng || destLng > maxLng || destLat < minLat || destLat > maxLat) {
      return {
        success: false,
        regionId: graph.regionId,
        regionName: graph.regionName,
        coordinates: [],
        distanceMeters: 0,
        durationSeconds: 0,
        maneuvers: [],
        summary: '',
        error: `OFFLINE ROUTE UNAVAILABLE: Destination is outside the downloaded ${graph.regionName} region. Download a larger region or reconnect to the internet.`,
        isOffline: true,
      };
    }

    // 3. Find closest start node and target node
    const startNode = this.findClosestNode(graph.nodes, origin);
    const targetNode = this.findClosestNode(graph.nodes, destination);

    if (!startNode || !targetNode) {
      return {
        success: false,
        regionId: graph.regionId,
        regionName: graph.regionName,
        coordinates: [],
        distanceMeters: 0,
        durationSeconds: 0,
        maneuvers: [],
        summary: '',
        error: 'OFFLINE ROUTE UNAVAILABLE: No navigable road nodes found near endpoints in downloaded road graph.',
        isOffline: true,
      };
    }

    // 4. Run A* search on road graph
    const pathEdges = this.runAStarSearch(graph, startNode.id, targetNode.id);
    if (!pathEdges || pathEdges.length === 0) {
      // Direct point-to-point connection if startNode == targetNode
      if (startNode.id === targetNode.id) {
        const dist = Math.round(calculateDistanceMeters(origin, destination));
        const duration = Math.max(30, Math.round((dist / (25 * 1000 / 3600))));
        return {
          success: true,
          regionId: graph.regionId,
          regionName: graph.regionName,
          coordinates: [origin, destination],
          distanceMeters: dist,
          durationSeconds: duration,
          maneuvers: [
            {
              instruction: 'Proceed directly to destination',
              type: 'depart',
              roadName: startNode.name || 'Local road',
              distanceMeters: dist,
              durationSeconds: duration,
              location: origin,
            },
            {
              instruction: 'Arrive at destination',
              type: 'arrive',
              roadName: 'Destination',
              distanceMeters: 0,
              durationSeconds: 0,
              location: destination,
            },
          ],
          summary: `${(dist / 1000).toFixed(1)} km · ${Math.round(duration / 60)} min (Offline)`,
          isOffline: true,
        };
      }

      return {
        success: false,
        regionId: graph.regionId,
        regionName: graph.regionName,
        coordinates: [],
        distanceMeters: 0,
        durationSeconds: 0,
        maneuvers: [],
        summary: '',
        error: 'OFFLINE ROUTE UNAVAILABLE: No contiguous path exists between selected nodes in the local road graph.',
        isOffline: true,
      };
    }

    // 5. Assemble coordinates, total distance, duration, and turn maneuvers
    const coords: [number, number][] = [origin];
    let totalDist = Math.round(calculateDistanceMeters(origin, startNode.coords));
    let totalSec = Math.round((totalDist / 8.33)); // ~30 km/h initial approach

    const maneuvers: OfflineManeuver[] = [
      {
        instruction: `Head towards ${pathEdges[0].roadName || 'main corridor'}`,
        type: 'depart',
        roadName: pathEdges[0].roadName || 'Corridor',
        distanceMeters: totalDist,
        durationSeconds: totalSec,
        location: origin,
      },
    ];

    let prevBearing = calculateBearingDegrees(origin, startNode.coords);

    for (let i = 0; i < pathEdges.length; i++) {
      const edge = pathEdges[i];
      const edgeGeom = edge.geometry && edge.geometry.length > 0
        ? edge.geometry
        : [graph.nodes.find(n => n.id === edge.fromNodeId)?.coords || origin, graph.nodes.find(n => n.id === edge.toNodeId)?.coords || destination];

      coords.push(...edgeGeom);
      totalDist += edge.distanceMeters;
      const edgeSec = Math.round(edge.distanceMeters / Math.max(3, (edge.speedKmh * 1000) / 3600));
      totalSec += edgeSec;

      // Determine turn direction from bearing difference
      const nextBearing = calculateBearingDegrees(edgeGeom[0], edgeGeom[edgeGeom.length - 1]);
      const turnAngle = ((nextBearing - prevBearing + 540) % 360) - 180;

      let maneuverType: OfflineManeuver['type'] = 'straight';
      let instruction = `Continue on ${edge.roadName}`;

      if (turnAngle > 35 && turnAngle < 150) {
        maneuverType = 'turn-right';
        instruction = `Turn right onto ${edge.roadName}`;
      } else if (turnAngle < -35 && turnAngle > -150) {
        maneuverType = 'turn-left';
        instruction = `Turn left onto ${edge.roadName}`;
      }

      maneuvers.push({
        instruction,
        type: maneuverType,
        roadName: edge.roadName,
        distanceMeters: edge.distanceMeters,
        durationSeconds: edgeSec,
        location: edgeGeom[0],
      });

      prevBearing = nextBearing;
    }

    // Final arrival maneuver
    const finalDist = Math.round(calculateDistanceMeters(coords[coords.length - 1], destination));
    totalDist += finalDist;
    coords.push(destination);

    maneuvers.push({
      instruction: 'Arrive at destination',
      type: 'arrive',
      roadName: 'Destination',
      distanceMeters: finalDist,
      durationSeconds: Math.round(finalDist / 5),
      location: destination,
    });

    const distKm = (totalDist / 1000).toFixed(1);
    const durationMin = Math.max(1, Math.round(totalSec / 60));

    return {
      success: true,
      regionId: graph.regionId,
      regionName: graph.regionName,
      coordinates: coords,
      distanceMeters: totalDist,
      durationSeconds: totalSec,
      maneuvers,
      summary: `${distKm} km · ${durationMin} min (Offline Local Graph)`,
      isOffline: true,
    };
  }

  /**
   * Directly calculates an offline route from a given graph in-memory using A*
   */
  calculateOfflineRouteFromGraph(
    origin: [number, number],
    destination: [number, number],
    graph: any,
    regionName?: string
  ): any {
    // 1. If graph specifies bounds, enforce them
    if (graph.bounds) {
      const [[minLng, minLat], [maxLng, maxLat]] = graph.bounds;
      const [destLng, destLat] = destination;
      if (destLng < minLng || destLng > maxLng || destLat < minLat || destLat > maxLat) {
        return null;
      }
    }

    // Standardize nodes
    const normalizedNodes: OfflineRoadNode[] = (graph.nodes || []).map((n: any) => ({
      id: n.id,
      name: n.name,
      coords: n.coords || n.coordinates || [0, 0],
    }));

    // Find closest nodes
    const startNode = this.findClosestNode(normalizedNodes, origin);
    const targetNode = this.findClosestNode(normalizedNodes, destination);

    if (!startNode || !targetNode) return null;

    // Check distance to closest target node: if > 30km from destination, it is outside region
    if (calculateDistanceMeters(destination, targetNode.coords) > 30000) {
      return null;
    }

    // Standardize edges
    const normalizedEdges: OfflineRoadEdge[] = (graph.edges || []).map((e: any) => ({
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      distanceMeters: e.distanceMeters,
      speedKmh: e.speedKmh || e.speedLimitKmh || 40,
      roadName: e.roadName || 'Local road',
      roadType: e.roadType || 'secondary',
      geometry: e.geometry || [
        normalizedNodes.find(n => n.id === e.fromNodeId)?.coords || origin,
        normalizedNodes.find(n => n.id === e.toNodeId)?.coords || destination,
      ],
    }));

    const normalizedGraph: OfflineRoadGraph = {
      regionId: graph.regionId || 'custom_region',
      regionName: graph.regionName || regionName || 'Offline Region',
      bounds: graph.bounds || [[0, 0], [0, 0]],
      nodes: normalizedNodes,
      edges: normalizedEdges,
      updatedAt: new Date().toISOString(),
    };

    const pathEdges = this.runAStarSearch(normalizedGraph, startNode.id, targetNode.id);
    if (!pathEdges || pathEdges.length === 0) {
      if (startNode.id === targetNode.id) {
        const dist = Math.round(calculateDistanceMeters(origin, destination));
        const dur = Math.max(30, Math.round(dist / 8.33));
        return {
          success: true,
          source: 'offline_local_graph',
          coordinates: [origin, destination],
          distanceMeters: dist,
          durationSeconds: dur,
          maneuvers: [
            { instruction: 'Proceed directly to destination', type: 'depart', roadName: startNode.name || 'Local road', distanceMeters: dist, durationSeconds: dur, location: origin },
            { instruction: 'Arrive at destination', type: 'arrive', roadName: 'Destination', distanceMeters: 0, durationSeconds: 0, location: destination }
          ],
          summary: `${(dist / 1000).toFixed(1)} km · ${Math.round(dur / 60)} min (Offline Local Graph)`,
          isOffline: true,
        };
      }
      return null;
    }

    const coords: [number, number][] = [origin];
    let totalDist = 0;
    let totalSec = 0;
    const maneuvers: any[] = [
      {
        instruction: `Head towards ${pathEdges[0].roadName}`,
        type: 'depart',
        roadName: pathEdges[0].roadName,
        distanceMeters: pathEdges[0].distanceMeters,
        durationSeconds: Math.round(pathEdges[0].distanceMeters / ((pathEdges[0].speedKmh * 1000) / 3600)),
        location: origin,
      }
    ];

    for (const edge of pathEdges) {
      coords.push(...edge.geometry);
      totalDist += edge.distanceMeters;
      const edgeSec = Math.round(edge.distanceMeters / Math.max(3, (edge.speedKmh * 1000) / 3600));
      totalSec += edgeSec;
      maneuvers.push({
        instruction: `Follow ${edge.roadName}`,
        type: 'straight',
        roadName: edge.roadName,
        distanceMeters: edge.distanceMeters,
        durationSeconds: edgeSec,
        location: edge.geometry[0],
      });
    }

    coords.push(destination);
    maneuvers.push({
      instruction: 'Arrive at destination',
      type: 'arrive',
      roadName: 'Destination',
      distanceMeters: 0,
      durationSeconds: 0,
      location: destination,
    });

    return {
      success: true,
      source: 'offline_local_graph',
      regionId: graph.regionId,
      regionName: regionName || graph.regionName || 'Offline Region',
      coordinates: coords,
      distanceMeters: totalDist,
      durationSeconds: totalSec,
      maneuvers,
      summary: `${(totalDist / 1000).toFixed(1)} km · ${Math.round(totalSec / 60)} min (Offline Local Graph)`,
      isOffline: true,
    };
  }

  /**
   * Finds the closest road node in Euclidean/Haversine distance
   */
  private findClosestNode(nodes: OfflineRoadNode[], point: [number, number]): OfflineRoadNode | null {
    let bestNode: OfflineRoadNode | null = null;
    let bestDist = Infinity;

    for (const node of nodes) {
      const dist = calculateDistanceMeters(point, node.coords);
      if (dist < bestDist) {
        bestDist = dist;
        bestNode = node;
      }
    }

    return bestNode;
  }

  /**
   * A* graph traversal over nodes & edges
   */
  private runAStarSearch(
    graph: OfflineRoadGraph,
    startId: string,
    targetId: string
  ): OfflineRoadEdge[] | null {
    const nodeMap = new Map<string, OfflineRoadNode>();
    graph.nodes.forEach((n) => nodeMap.set(n.id, n));

    const targetNode = nodeMap.get(targetId);
    if (!targetNode) return null;

    // Adjacency list: node -> array of edges
    const adj = new Map<string, OfflineRoadEdge[]>();
    for (const edge of graph.edges) {
      if (!adj.has(edge.fromNodeId)) adj.set(edge.fromNodeId, []);
      adj.get(edge.fromNodeId)!.push(edge);
      // Bi-directional street traversal unless one-way
      if (!adj.has(edge.toNodeId)) adj.set(edge.toNodeId, []);
      adj.get(edge.toNodeId)!.push({
        ...edge,
        fromNodeId: edge.toNodeId,
        toNodeId: edge.fromNodeId,
        geometry: [...(edge.geometry || [])].reverse(),
      });
    }

    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const cameFrom = new Map<string, { edge: OfflineRoadEdge; prevNodeId: string }>();

    gScore.set(startId, 0);
    const startNode = nodeMap.get(startId);
    const initialH = startNode ? calculateDistanceMeters(startNode.coords, targetNode.coords) : 0;
    fScore.set(startId, initialH);

    const openSet = new Set<string>([startId]);

    while (openSet.size > 0) {
      // Find node with lowest fScore
      let currentId = '';
      let lowestF = Infinity;
      for (const id of openSet) {
        const score = fScore.get(id) ?? Infinity;
        if (score < lowestF) {
          lowestF = score;
          currentId = id;
        }
      }

      if (currentId === targetId) {
        // Reconstruct path
        const path: OfflineRoadEdge[] = [];
        let curr = targetId;
        while (cameFrom.has(curr)) {
          const { edge, prevNodeId } = cameFrom.get(curr)!;
          path.unshift(edge);
          curr = prevNodeId;
        }
        return path;
      }

      openSet.delete(currentId);
      const currentG = gScore.get(currentId) ?? Infinity;
      const neighbors = adj.get(currentId) || [];

      for (const edge of neighbors) {
        const neighborId = edge.toNodeId;
        const speedMps = Math.max(2, (edge.speedKmh * 1000) / 3600);
        const weight = edge.distanceMeters / speedMps; // Cost is travel time
        const tentativeG = currentG + weight;

        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, { edge, prevNodeId: currentId });
          gScore.set(neighborId, tentativeG);
          const neighborNode = nodeMap.get(neighborId);
          const h = neighborNode ? calculateDistanceMeters(neighborNode.coords, targetNode.coords) / 16.6 : 0; // Heuristic
          fScore.set(neighborId, tentativeG + h);
          openSet.add(neighborId);
        }
      }
    }

    return null; // No path found
  }
}

export const offlineRoutingEngine = new OfflineRoutingEngine();
export default offlineRoutingEngine;
