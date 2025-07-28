import { 
  Server, 
  ClientRequest, 
  LoadBalancerConfig, 
  LoadBalancerStats, 
  RequestLog, 
  HealthCheckResult, 
  FailoverEvent,
  AnalyticsData,
  SimulationConfig
} from './types';
import { LoadBalancingAlgorithms } from './algorithms';

export class EnhancedLoadBalancer {
  private servers: Server[] = [];
  private config: LoadBalancerConfig;
  private algorithms: LoadBalancingAlgorithms;
  private requestCounter: number = 0;
  private stats: LoadBalancerStats;
  private requestLogs: RequestLog[] = [];
  private failoverEvents: FailoverEvent[] = [];
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private simulationConfig: SimulationConfig;

  constructor(config: LoadBalancerConfig) {
    this.config = config;
    this.algorithms = new LoadBalancingAlgorithms();
    this.stats = this.initializeStats();
    this.simulationConfig = this.initializeSimulationConfig();
  }

  private initializeStats(): LoadBalancerStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      algorithm: this.config.algorithm,
      activeServers: 0,
      totalServers: 0,
      failoverEvents: 0,
      lastFailover: 0,
      requestRate: 0,
      throughput: 0
    };
  }

  private initializeSimulationConfig(): SimulationConfig {
    return {
      requestRate: 10,
      requestPattern: 'steady',
      clientDistribution: 'uniform',
      failureSimulation: {
        enabled: false,
        failureRate: 0.01,
        failureTypes: ['server-down', 'timeout', 'overload']
      },
      loadSimulation: {
        enabled: false,
        minRequestSize: 1024,
        maxRequestSize: 10240,
        requestSizeDistribution: 'normal'
      }
    };
  }

  public addServer(serverConfig: Partial<Server>): Server {
    const server: Server = {
      id: serverConfig.id || `server-${Date.now()}`,
      name: serverConfig.name || `Server-${this.servers.length + 1}`,
      weight: serverConfig.weight || 1,
      originalWeight: serverConfig.weight || 1,
      maxConnections: serverConfig.maxConnections || 100,
      processingTime: serverConfig.processingTime || 1000,
      healthCheckInterval: serverConfig.healthCheckInterval || 30000,
      failureThreshold: serverConfig.failureThreshold || 3,
      recoveryThreshold: serverConfig.recoveryThreshold || 2,
      ipAddress: serverConfig.ipAddress || `192.168.1.${this.servers.length + 10}`,
      port: serverConfig.port || 8080,
      active: serverConfig.active !== false,
      healthy: true,
      currentConnections: 0,
      totalRequests: 0,
      totalResponseTime: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      lastHealthCheck: Date.now(),
      currentLoad: 0,
      queue: [],
      sessionMap: new Map(),
      responseTimeHistory: [],
      failureHistory: [],
      canAcceptRequest: function() {
        return this.active && this.healthy && this.currentConnections < this.maxConnections;
      }
    };

    this.servers.push(server);
    this.algorithms.updateServerWeights(this.servers);
    this.startHealthCheck(server);
    this.updateStats();
    return server;
  }

  public removeServer(serverId: string): boolean {
    const index = this.servers.findIndex(s => s.id === serverId);
    if (index === -1) return false;

    // Stop health check
    const interval = this.healthCheckIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serverId);
    }

    this.servers.splice(index, 1);
    this.algorithms.updateServerWeights(this.servers);
    this.updateStats();
    return true;
  }

  public updateServer(serverId: string, updates: Partial<Server>): boolean {
    const server = this.servers.find(s => s.id === serverId);
    if (!server) return false;

    Object.assign(server, updates);
    
    // Update weight in algorithm
    if (updates.weight !== undefined) {
      server.originalWeight = updates.weight;
      this.algorithms.updateServerWeights(this.servers);
    }

    // Restart health check if interval changed
    if (updates.healthCheckInterval !== undefined) {
      const interval = this.healthCheckIntervals.get(serverId);
      if (interval) {
        clearInterval(interval);
      }
      this.startHealthCheck(server);
    }

    this.updateStats();
    return true;
  }

  public distributeRequest(request: Partial<ClientRequest>): { request: ClientRequest; server: Server | null; success: boolean } {
    const clientRequest: ClientRequest = {
      id: request.id || `req-${++this.requestCounter}`,
      timestamp: Date.now(),
      clientIp: request.clientIp || this.generateClientIp(),
      sessionId: request.sessionId || this.generateSessionId(),
      requestSize: request.requestSize || this.generateRequestSize(),
      priority: request.priority || 'medium',
      timeout: request.timeout || this.config.requestTimeout,
      processed: false,
      processingTime: 0,
      responseTime: 0,
      status: 'pending'
    };

    const selectedServer = this.algorithms.selectServer(this.servers, clientRequest, this.config.algorithm);
    
    if (!selectedServer) {
      clientRequest.status = 'failed';
      clientRequest.error = 'No available servers';
      this.logRequest(clientRequest, null, false);
      this.updateStats();
      return { request: clientRequest, server: null, success: false };
    }

    const success = this.processRequestOnServer(clientRequest, selectedServer);
    this.logRequest(clientRequest, selectedServer, success);
    this.updateStats();
    
    return { request: clientRequest, server: selectedServer, success };
  }

  private processRequestOnServer(request: ClientRequest, server: Server): boolean {
    if (!server.canAcceptRequest()) {
      request.status = 'failed';
      request.error = 'Server at capacity';
      return false;
    }

    server.currentConnections++;
    server.totalRequests++;
    request.serverId = server.id;
    request.status = 'processing';

    // Simulate processing
    const processingTime = this.calculateProcessingTime(server, request);
    request.processingTime = processingTime;

    setTimeout(() => {
      this.completeRequest(request, server, processingTime);
    }, processingTime);

    return true;
  }

  private completeRequest(request: ClientRequest, server: Server, processingTime: number) {
    server.currentConnections = Math.max(0, server.currentConnections - 1);
    
    // Simulate potential failure
    if (this.simulationConfig.failureSimulation.enabled && 
        Math.random() < this.simulationConfig.failureSimulation.failureRate) {
      request.status = 'failed';
      request.error = 'Simulated failure';
      server.failedRequests++;
      server.consecutiveFailures++;
      server.failureHistory.push({
        timestamp: Date.now(),
        reason: 'Simulated failure'
      });
    } else {
      request.status = 'completed';
      request.responseTime = processingTime;
      server.totalResponseTime += processingTime;
      server.responseTimeHistory.push(processingTime);
      server.consecutiveFailures = 0;
    }

    // Keep only last 100 response times
    if (server.responseTimeHistory.length > 100) {
      server.responseTimeHistory = server.responseTimeHistory.slice(-100);
    }

    this.updateStats();
  }

  private calculateProcessingTime(server: Server, request: ClientRequest): number {
    let baseTime = server.processingTime;
    
    // Adjust based on current load
    const loadFactor = server.currentConnections / server.maxConnections;
    baseTime *= (1 + loadFactor * 0.5);

    // Adjust based on request size
    const sizeFactor = request.requestSize / 10240; // Normalize to 10KB
    baseTime *= (1 + sizeFactor * 0.3);

    // Add some randomness
    baseTime *= (0.8 + Math.random() * 0.4);

    return Math.round(baseTime);
  }

  private processRequestOnServer(request: ClientRequest, server: Server): boolean {
    if (!server.canAcceptRequest()) {
      request.status = 'failed';
      request.error = 'Server at capacity';
      return false;
    }

    server.currentConnections++;
    server.totalRequests++;
    request.serverId = server.id;
    request.status = 'processing';

    // Simulate processing
    const processingTime = this.calculateProcessingTime(server, request);
    request.processingTime = processingTime;

    setTimeout(() => {
      this.completeRequest(request, server, processingTime);
    }, processingTime);

    return true;
  }

  private startHealthCheck(server: Server) {
    const interval = setInterval(() => {
      this.performHealthCheck(server);
    }, server.healthCheckInterval);
    
    this.healthCheckIntervals.set(server.id, interval);
  }

  private performHealthCheck(server: Server) {
    const startTime = Date.now();
    const healthy = Math.random() > 0.05; // 95% success rate for health checks
    const responseTime = healthy ? 50 + Math.random() * 100 : 500 + Math.random() * 1000;

    setTimeout(() => {
      const wasHealthy = server.healthy;
      server.lastHealthCheck = Date.now();

      if (healthy) {
        server.consecutiveFailures = Math.max(0, server.consecutiveFailures - 1);
        if (server.consecutiveFailures < server.recoveryThreshold) {
          server.healthy = true;
        }
      } else {
        server.consecutiveFailures++;
        if (server.consecutiveFailures >= server.failureThreshold) {
          server.healthy = false;
          this.triggerFailover(server, 'health-check-failed');
        }
      }

      if (wasHealthy !== server.healthy) {
        this.updateStats();
      }
    }, responseTime);
  }

  private triggerFailover(failedServer: Server, reason: string) {
    const failoverEvent: FailoverEvent = {
      timestamp: Date.now(),
      serverId: failedServer.id,
      reason: reason as any,
      requestsAffected: failedServer.currentConnections
    };

    this.failoverEvents.push(failoverEvent);
    this.stats.failoverEvents++;
    this.stats.lastFailover = Date.now();
  }

  private logRequest(request: ClientRequest, server: Server | null, success: boolean) {
    const log: RequestLog = {
      id: request.id,
      timestamp: request.timestamp,
      clientIp: request.clientIp,
      sessionId: request.sessionId,
      algorithm: this.config.algorithm,
      selectedServer: server?.id || 'none',
      requestSize: request.requestSize,
      responseTime: request.responseTime,
      status: success ? 'success' : 'failure',
      error: request.error,
      failover: false
    };

    this.requestLogs.push(log);
    
    // Keep only last 1000 logs
    if (this.requestLogs.length > 1000) {
      this.requestLogs = this.requestLogs.slice(-1000);
    }
  }

  private updateStats() {
    const activeServers = this.servers.filter(s => s.active && s.healthy);
    const totalResponseTime = this.servers.reduce((sum, s) => sum + s.totalResponseTime, 0);
    const totalRequests = this.servers.reduce((sum, s) => sum + s.totalRequests, 0);

    this.stats = {
      ...this.stats,
      activeServers: activeServers.length,
      totalServers: this.servers.length,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      algorithm: this.config.algorithm
    };
  }

  private generateClientIp(): string {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(Math.floor(Math.random() * 256));
    }
    return segments.join('.');
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private generateRequestSize(): number {
    if (!this.simulationConfig.loadSimulation.enabled) {
      return 1024; // Default 1KB
    }

    const { minRequestSize, maxRequestSize, requestSizeDistribution } = this.simulationConfig.loadSimulation;
    
    switch (requestSizeDistribution) {
      case 'uniform':
        return Math.floor(Math.random() * (maxRequestSize - minRequestSize) + minRequestSize);
      case 'normal':
        // Simplified normal distribution
        const mean = (minRequestSize + maxRequestSize) / 2;
        const stdDev = (maxRequestSize - minRequestSize) / 6;
        const normalValue = mean + (Math.random() + Math.random() + Math.random() - 1.5) * stdDev;
        return Math.max(minRequestSize, Math.min(maxRequestSize, Math.round(normalValue)));
      case 'exponential':
        const expMean = (minRequestSize + maxRequestSize) / 2;
        const lambda = 1 / expMean;
        const expValue = -Math.log(1 - Math.random()) / lambda;
        return Math.max(minRequestSize, Math.min(maxRequestSize, Math.round(expValue)));
      default:
        return minRequestSize;
    }
  }

  // Public getters
  public getServers(): Server[] {
    return [...this.servers];
  }

  public getStats(): LoadBalancerStats {
    return { ...this.stats };
  }

  public getRequestLogs(): RequestLog[] {
    return [...this.requestLogs];
  }

  public getFailoverEvents(): FailoverEvent[] {
    return [...this.failoverEvents];
  }

  public getAnalytics(): AnalyticsData {
    const perServer: { [serverId: string]: any } = {};
    
    this.servers.forEach(server => {
      perServer[server.id] = {
        serverId: server.id,
        totalRequests: server.totalRequests,
        successfulRequests: server.totalRequests - server.failedRequests,
        failedRequests: server.failedRequests,
        averageResponseTime: server.totalRequests > 0 ? server.totalResponseTime / server.totalRequests : 0,
        currentLoad: server.currentConnections,
        healthStatus: server.healthy ? 'healthy' : 'unhealthy',
        uptime: Date.now() - server.lastHealthCheck,
        lastRequest: server.totalRequests > 0 ? Date.now() : 0,
        connectionDistribution: {}
      };
    });

    return {
      overall: this.stats,
      perServer,
      requestLogs: this.requestLogs,
      algorithmPerformance: this.calculateAlgorithmPerformance(),
      timeSeriesData: this.generateTimeSeriesData()
    };
  }

  private calculateAlgorithmPerformance() {
    // This would be implemented to track performance per algorithm
    return {} as any;
  }

  private generateTimeSeriesData() {
    // This would generate time series data for charts
    return [];
  }

  public updateConfig(newConfig: Partial<LoadBalancerConfig>) {
    Object.assign(this.config, newConfig);
    if (newConfig.algorithm) {
      this.algorithms.resetAlgorithm();
    }
  }

  public updateSimulationConfig(newConfig: Partial<SimulationConfig>) {
    Object.assign(this.simulationConfig, newConfig);
  }

  public reset() {
    this.servers.forEach(server => {
      server.currentConnections = 0;
      server.totalRequests = 0;
      server.totalResponseTime = 0;
      server.failedRequests = 0;
      server.consecutiveFailures = 0;
      server.responseTimeHistory = [];
      server.failureHistory = [];
    });
    
    this.requestLogs = [];
    this.failoverEvents = [];
    this.algorithms.resetAlgorithm();
    this.stats = this.initializeStats();
  }
} 