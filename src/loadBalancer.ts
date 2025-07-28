import { LoadBalancingAlgorithms } from './algorithms';
import { 
  Server, 
  ClientRequest, 
  LoadBalancerConfig, 
  LoadBalancingAlgorithm, 
  LoadBalancerStats, 
  RequestLog, 
  FailoverEvent, 
  AnalyticsData, 
  SimulationConfig,
  ServerConfig,
  HealthCheckResult
} from './types';

export class EnhancedLoadBalancer {
  private servers: Server[] = [];
  private config: LoadBalancerConfig;
  private algorithms: LoadBalancingAlgorithms;
  private stats: LoadBalancerStats;
  private requestLogs: RequestLog[] = [];
  private failoverEvents: FailoverEvent[] = [];
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private simulationConfig: SimulationConfig;
  private requestCounter: number = 0;
  private lastStatsUpdate: number = Date.now();
  private maxLogs: number = 1000; // Limit logs to prevent memory issues

  constructor(config: LoadBalancerConfig) {
    this.config = { ...config };
    this.algorithms = new LoadBalancingAlgorithms();
    this.stats = this.initializeStats();
    this.simulationConfig = {
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

  private initializeStats(): LoadBalancerStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalServers: 0,
      activeServers: 0,
      failoverEvents: 0,
      lastUpdate: Date.now()
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

    // Handle algorithm cleanup
    this.algorithms.handleServerRemoval(serverId);

    this.servers.splice(index, 1);
    this.algorithms.updateServerWeights(this.servers);
    this.updateStats();
    return true;
  }

  public updateServer(serverId: string, config: Partial<ServerConfig>): boolean {
    const server = this.servers.find(s => s.id === serverId);
    if (!server) return false;

    // Update server properties
    Object.assign(server, config);
    
    // Update algorithm weights if weight changed
    if (config.weight !== undefined) {
      this.algorithms.updateServerWeights(this.servers);
    }

    this.updateStats();
    return true;
  }

  public distributeRequest(request: Partial<ClientRequest> = {}): { success: boolean; server?: Server } {
    try {
      const activeServers = this.servers.filter(s => s.active && s.healthy);
      
      if (activeServers.length === 0) {
        this.logRequest({
          id: `req-${++this.requestCounter}`,
          timestamp: Date.now(),
          clientIp: request.clientIp || this.generateClientIp(),
          sessionId: request.sessionId || this.generateSessionId(),
          requestSize: request.requestSize || this.generateRequestSize(),
          priority: request.priority || 'normal',
          timeout: request.timeout || this.config.requestTimeout,
          status: 'failed',
          selectedServer: 'none',
          algorithm: this.config.algorithm,
          responseTime: 0,
          reason: 'No available servers'
        });
        return { success: false };
      }

      const selectedServer = this.algorithms.selectServer(activeServers, request as ClientRequest, this.config.algorithm);
      
      if (!selectedServer) {
        this.logRequest({
          id: `req-${++this.requestCounter}`,
          timestamp: Date.now(),
          clientIp: request.clientIp || this.generateClientIp(),
          sessionId: request.sessionId || this.generateSessionId(),
          requestSize: request.requestSize || this.generateRequestSize(),
          priority: request.priority || 'normal',
          timeout: request.timeout || this.config.requestTimeout,
          status: 'failed',
          selectedServer: 'none',
          algorithm: this.config.algorithm,
          responseTime: 0,
          reason: 'No server selected by algorithm'
        });
        return { success: false };
      }

      const success = this.processRequestOnServer(selectedServer, request);
      return { success, server: selectedServer };
    } catch (error) {
      console.error('Error distributing request:', error);
      return { success: false };
    }
  }

  private processRequestOnServer(server: Server, request: Partial<ClientRequest>): boolean {
    try {
      if (!server.canAcceptRequest()) {
        return false;
      }

      // Simulate failure based on configuration
      if (this.simulationConfig.failureSimulation?.enabled) {
        if (Math.random() < this.simulationConfig.failureSimulation.failureRate) {
          this.simulateFailure(server, request);
          return false;
        }
      }

      const requestId = `req-${++this.requestCounter}`;
      const startTime = Date.now();
      
      // Update server state
      server.currentConnections++;
      server.totalRequests++;
      server.currentLoad = (server.currentConnections / server.maxConnections) * 100;

      // Simulate processing time
      const processingTime = server.processingTime + Math.random() * 200;
      
      setTimeout(() => {
        const responseTime = Date.now() - startTime;
        server.currentConnections = Math.max(0, server.currentConnections - 1);
        server.totalResponseTime += responseTime;
        server.currentLoad = (server.currentConnections / server.maxConnections) * 100;

        // Update response time history (keep last 50 entries)
        server.responseTimeHistory.push(responseTime);
        if (server.responseTimeHistory.length > 50) {
          server.responseTimeHistory.shift();
        }

        this.logRequest({
          id: requestId,
          timestamp: startTime,
          clientIp: request.clientIp || this.generateClientIp(),
          sessionId: request.sessionId || this.generateSessionId(),
          requestSize: request.requestSize || this.generateRequestSize(),
          priority: request.priority || 'normal',
          timeout: request.timeout || this.config.requestTimeout,
          status: 'success',
          selectedServer: server.id,
          algorithm: this.config.algorithm,
          responseTime,
          reason: 'Request processed successfully'
        });

        this.updateStats();
      }, processingTime);

      return true;
    } catch (error) {
      console.error('Error processing request on server:', error);
      return false;
    }
  }

  private simulateFailure(server: Server, request: Partial<ClientRequest>): void {
    const failureTypes = this.simulationConfig.failureSimulation?.failureTypes || ['timeout'];
    const failureType = failureTypes[Math.floor(Math.random() * failureTypes.length)];
    
    server.consecutiveFailures++;
    server.failedRequests++;
    
    if (server.consecutiveFailures >= server.failureThreshold) {
      server.healthy = false;
      this.triggerFailover(server, failureType);
    }

    this.logRequest({
      id: `req-${++this.requestCounter}`,
      timestamp: Date.now(),
      clientIp: request.clientIp || this.generateClientIp(),
      sessionId: request.sessionId || this.generateSessionId(),
      requestSize: request.requestSize || this.generateRequestSize(),
      priority: request.priority || 'normal',
      timeout: request.timeout || this.config.requestTimeout,
      status: 'failed',
      selectedServer: server.id,
      algorithm: this.config.algorithm,
      responseTime: 0,
      reason: `Simulated failure: ${failureType}`
    });
  }

  private startHealthCheck(server: Server): void {
    if (!this.config.healthCheckEnabled) return;

    const interval = setInterval(() => {
      this.performHealthCheck(server);
    }, server.healthCheckInterval);

    this.healthCheckIntervals.set(server.id, interval);
  }

  private performHealthCheck(server: Server): HealthCheckResult {
    const now = Date.now();
    const result: HealthCheckResult = {
      serverId: server.id,
      timestamp: now,
      healthy: server.healthy,
      responseTime: 0,
      reason: ''
    };

    try {
      // Simulate health check
      const responseTime = Math.random() * 100 + 50;
      result.responseTime = responseTime;

      if (responseTime > 500) {
        server.consecutiveFailures++;
        result.reason = 'High response time';
      } else {
        server.consecutiveFailures = Math.max(0, server.consecutiveFailures - 1);
        result.reason = 'Healthy';
      }

      if (server.consecutiveFailures >= server.failureThreshold) {
        server.healthy = false;
        result.healthy = false;
        result.reason = 'Too many consecutive failures';
        this.triggerFailover(server, 'health-check-failed');
      } else if (server.consecutiveFailures <= server.recoveryThreshold && !server.healthy) {
        server.healthy = true;
        result.healthy = true;
        result.reason = 'Recovered from failures';
      }

      server.lastHealthCheck = now;
      this.updateStats();
    } catch (error) {
      console.error('Health check error:', error);
      result.healthy = false;
      result.reason = 'Health check error';
    }

    return result;
  }

  private triggerFailover(server: Server, reason: string): void {
    if (!this.config.failoverEnabled) return;

    const failoverEvent: FailoverEvent = {
      id: `failover-${Date.now()}`,
      timestamp: Date.now(),
      serverId: server.id,
      serverName: server.name,
      reason,
      previousStatus: 'healthy',
      newStatus: 'unhealthy'
    };

    this.failoverEvents.push(failoverEvent);
    this.stats.failoverEvents++;
    
    // Keep only last 100 failover events
    if (this.failoverEvents.length > 100) {
      this.failoverEvents = this.failoverEvents.slice(-100);
    }
  }

  private logRequest(log: RequestLog): void {
    this.requestLogs.push(log);
    
    // Keep only last N logs to prevent memory issues
    if (this.requestLogs.length > this.maxLogs) {
      this.requestLogs = this.requestLogs.slice(-this.maxLogs);
    }
  }

  private updateStats(): void {
    const now = Date.now();
    if (now - this.lastStatsUpdate < 100) return; // Throttle updates

    this.stats = {
      totalRequests: this.requestLogs.length,
      successfulRequests: this.requestLogs.filter(log => log.status === 'success').length,
      failedRequests: this.requestLogs.filter(log => log.status === 'failed').length,
      averageResponseTime: this.calculateAverageResponseTime(),
      totalServers: this.servers.length,
      activeServers: this.servers.filter(s => s.active && s.healthy).length,
      failoverEvents: this.failoverEvents.length,
      lastUpdate: now
    };

    this.lastStatsUpdate = now;
  }

  private calculateAverageResponseTime(): number {
    const successfulLogs = this.requestLogs.filter(log => log.status === 'success' && log.responseTime > 0);
    if (successfulLogs.length === 0) return 0;
    
    const totalResponseTime = successfulLogs.reduce((sum, log) => sum + log.responseTime, 0);
    return totalResponseTime / successfulLogs.length;
  }

  private generateClientIp(): string {
    const octets = [];
    for (let i = 0; i < 4; i++) {
      octets.push(Math.floor(Math.random() * 256));
    }
    return octets.join('.');
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestSize(): number {
    const { minRequestSize = 1024, maxRequestSize = 10240, requestSizeDistribution = 'normal' } = 
      this.simulationConfig.loadSimulation || {};

    switch (requestSizeDistribution) {
      case 'uniform':
        return Math.floor(Math.random() * (maxRequestSize - minRequestSize + 1)) + minRequestSize;
      case 'normal':
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

  public updateConfig(config: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public updateSimulationConfig(config: Partial<SimulationConfig>): void {
    this.simulationConfig = { ...this.simulationConfig, ...config };
  }

  public reset(): void {
    this.servers.forEach(server => {
      server.currentConnections = 0;
      server.totalRequests = 0;
      server.totalResponseTime = 0;
      server.failedRequests = 0;
      server.consecutiveFailures = 0;
      server.healthy = true;
      server.responseTimeHistory = [];
      server.failureHistory = [];
      server.queue = [];
    });
    
    this.requestLogs = [];
    this.failoverEvents = [];
    this.algorithms.resetAlgorithm();
    this.updateStats();
  }

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
      timeSeriesData: this.generateTimeSeriesData(),
      algorithmStats: this.algorithms.getAlgorithmStats()
    };
  }

  private calculateAlgorithmPerformance(): any {
    const algorithmStats: { [key: string]: any } = {};
    const algorithms = ['ROUND_ROBIN', 'WEIGHTED_ROUND_ROBIN', 'LEAST_CONNECTIONS', 'LEAST_RESPONSE_TIME', 'IP_HASH', 'STICKY_SESSIONS'];
    
    algorithms.forEach(algorithm => {
      const logs = this.requestLogs.filter(log => log.algorithm === algorithm);
      algorithmStats[algorithm] = {
        totalRequests: logs.length,
        successRate: logs.length > 0 ? (logs.filter(log => log.status === 'success').length / logs.length) * 100 : 0,
        averageResponseTime: logs.filter(log => log.status === 'success').length > 0 
          ? logs.filter(log => log.status === 'success').reduce((sum, log) => sum + log.responseTime, 0) / logs.filter(log => log.status === 'success').length 
          : 0
      };
    });

    return algorithmStats;
  }

  private generateTimeSeriesData(): any {
    const now = Date.now();
    const timeRanges = [1, 5, 15, 60]; // minutes
    const data: { [key: string]: any[] } = {};

    timeRanges.forEach(range => {
      const cutoff = now - (range * 60 * 1000);
      const logs = this.requestLogs.filter(log => log.timestamp > cutoff);
      
      data[`${range}m`] = logs.map(log => ({
        timestamp: log.timestamp,
        responseTime: log.responseTime,
        status: log.status,
        serverId: log.selectedServer
      }));
    });

    return data;
  }
} 