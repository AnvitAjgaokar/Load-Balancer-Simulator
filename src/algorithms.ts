import { Server, ClientRequest, LoadBalancingAlgorithm } from './types';

export class LoadBalancingAlgorithms {
  private currentIndex: number = 0;
  private weights: Map<string, { current: number; max: number }> = new Map();
  private ipHashCache: Map<string, string> = new Map();
  private sessionMap: Map<string, string> = new Map(); // sessionId -> serverId
  private lastSessionCleanup: number = Date.now();
  private sessionTimeout: number = 300000; // 5 minutes
  private sessionTimestamps: Map<string, number> = new Map(); // sessionId -> timestamp

  constructor() {
    this.initializeWeights();
  }

  private initializeWeights() {
    this.weights.clear();
  }

  public selectServer(
    servers: Server[],
    request: ClientRequest,
    algorithm: LoadBalancingAlgorithm
  ): Server | null {
    const activeServers = servers.filter(server => server.active && server.healthy);
    
    if (activeServers.length === 0) {
      return null;
    }

    // Handle edge case: only one server available
    if (activeServers.length === 1) {
      return activeServers[0];
    }

    switch (algorithm) {
      case 'ROUND_ROBIN':
        return this.roundRobin(activeServers);
      case 'WEIGHTED_ROUND_ROBIN':
        return this.weightedRoundRobin(activeServers);
      case 'LEAST_CONNECTIONS':
        return this.leastConnections(activeServers);
      case 'LEAST_RESPONSE_TIME':
        return this.leastResponseTime(activeServers);
      case 'IP_HASH':
        return this.ipHash(activeServers, request);
      case 'STICKY_SESSIONS':
        return this.stickySessions(activeServers, request);
      default:
        return this.roundRobin(activeServers);
    }
  }

  private roundRobin(servers: Server[]): Server {
    // Ensure we have valid servers
    if (servers.length === 0) return null as any;
    
    const server = servers[this.currentIndex % servers.length];
    this.currentIndex = (this.currentIndex + 1) % servers.length;
    return server;
  }

  private weightedRoundRobin(servers: Server[]): Server {
    // Initialize weights if not already done
    servers.forEach(server => {
      if (!this.weights.has(server.id)) {
        this.weights.set(server.id, { current: server.weight, max: server.weight });
      }
    });

    // Handle edge case: all weights are 0
    const totalWeight = servers.reduce((sum, server) => sum + server.weight, 0);
    if (totalWeight === 0) {
      return this.roundRobin(servers);
    }

    // Find server with highest current weight
    let selectedServer: Server | null = null;
    let maxWeight = -1;

    for (const server of servers) {
      const weight = this.weights.get(server.id)!;
      if (weight.current > maxWeight) {
        maxWeight = weight.current;
        selectedServer = server;
      }
    }

    if (selectedServer) {
      // Decrease current weight
      this.weights.get(selectedServer.id)!.current -= 1;

      // Check if all weights are exhausted
      const allWeights = servers.map(s => this.weights.get(s.id)!.current);
      if (allWeights.every(w => w <= 0)) {
        // Reset all weights
        servers.forEach(server => {
          this.weights.get(server.id)!.current = server.weight;
        });
      }
    }

    return selectedServer || servers[0];
  }

  private leastConnections(servers: Server[]): Server {
    // Sort by current connections, then by response time as tiebreaker
    const sortedServers = servers.sort((a, b) => {
      if (a.currentConnections !== b.currentConnections) {
        return a.currentConnections - b.currentConnections;
      }
      // Tiebreaker: least response time
      const avgA = this.getAverageResponseTime(a);
      const avgB = this.getAverageResponseTime(b);
      if (avgA !== avgB) {
        return avgA - avgB;
      }
      // Second tiebreaker: server ID for consistency
      return a.id.localeCompare(b.id);
    });
    
    return sortedServers[0];
  }

  private leastResponseTime(servers: Server[]): Server {
    const sortedServers = servers.sort((a, b) => {
      const avgA = this.getAverageResponseTime(a);
      const avgB = this.getAverageResponseTime(b);
      if (avgA !== avgB) {
        return avgA - avgB;
      }
      // Tiebreaker: least connections
      if (a.currentConnections !== b.currentConnections) {
        return a.currentConnections - b.currentConnections;
      }
      // Second tiebreaker: server ID for consistency
      return a.id.localeCompare(b.id);
    });
    
    return sortedServers[0];
  }

  private ipHash(servers: Server[], request: ClientRequest): Server {
    // Handle edge case: no client IP
    if (!request.clientIp) {
      return this.roundRobin(servers);
    }

    const hash = this.hashString(request.clientIp);
    const index = hash % servers.length;
    return servers[index];
  }

  private stickySessions(servers: Server[], request: ClientRequest): Server {
    // Clean up expired sessions periodically
    this.cleanupExpiredSessions();

    if (request.sessionId) {
      const existingServerId = this.sessionMap.get(request.sessionId);
      if (existingServerId) {
        const existingServer = servers.find(s => s.id === existingServerId);
        if (existingServer && existingServer.active && existingServer.healthy) {
          // Update session timestamp
          this.sessionTimestamps.set(request.sessionId, Date.now());
          return existingServer;
        } else {
          // Remove invalid session mapping
          this.sessionMap.delete(request.sessionId);
          this.sessionTimestamps.delete(request.sessionId);
        }
      }
    }

    // If no existing session or server is unavailable, use least connections
    const selectedServer = this.leastConnections(servers);
    
    // Store session mapping with timestamp
    if (request.sessionId) {
      this.sessionMap.set(request.sessionId, selectedServer.id);
      this.sessionTimestamps.set(request.sessionId, Date.now());
    }

    return selectedServer;
  }

  private getAverageResponseTime(server: Server): number {
    if (server.responseTimeHistory.length === 0) {
      return server.processingTime;
    }
    const recent = server.responseTimeHistory.slice(-10); // Last 10 responses
    return recent.reduce((sum, time) => sum + time, 0) / recent.length;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private cleanupExpiredSessions() {
    const now = Date.now();
    if (now - this.lastSessionCleanup > 60000) { // Cleanup every minute
      for (const [sessionId, timestamp] of this.sessionTimestamps.entries()) {
        if (now - timestamp > this.sessionTimeout) {
          this.sessionMap.delete(sessionId);
          this.sessionTimestamps.delete(sessionId);
        }
      }
      this.lastSessionCleanup = now;
    }
  }

  public updateServerWeights(servers: Server[]) {
    servers.forEach(server => {
      if (!this.weights.has(server.id)) {
        this.weights.set(server.id, { current: server.weight, max: server.weight });
      } else {
        this.weights.get(server.id)!.max = server.weight;
        // Reset current weight if it's higher than the new max
        if (this.weights.get(server.id)!.current > server.weight) {
          this.weights.get(server.id)!.current = server.weight;
        }
      }
    });
  }

  public resetAlgorithm() {
    this.currentIndex = 0;
    this.weights.clear();
    this.sessionMap.clear();
    this.sessionTimestamps.clear();
  }

  // Public method to get algorithm statistics
  public getAlgorithmStats() {
    return {
      sessionCount: this.sessionMap.size,
      weightMap: Object.fromEntries(this.weights),
      currentIndex: this.currentIndex
    };
  }

  // Method to validate algorithm state
  public validateState(servers: Server[]): boolean {
    // Check if all server weights are properly initialized
    const allServersHaveWeights = servers.every(server => this.weights.has(server.id));
    
    // Check if session mappings are valid
    const validSessions = Array.from(this.sessionMap.values()).every(serverId => 
      servers.some(server => server.id === serverId)
    );
    
    return allServersHaveWeights && validSessions;
  }

  // Method to handle server removal
  public handleServerRemoval(serverId: string) {
    // Remove from weights
    this.weights.delete(serverId);
    
    // Remove from session map
    for (const [sessionId, mappedServerId] of this.sessionMap.entries()) {
      if (mappedServerId === serverId) {
        this.sessionMap.delete(sessionId);
        this.sessionTimestamps.delete(sessionId);
      }
    }
  }
} 