// Enhanced Load Balancer Types and Interfaces

export interface ServerConfig {
  id: string;
  name: string;
  weight: number;
  maxConnections: number;
  processingTime: number;
  healthCheckInterval: number;
  failureThreshold: number;
  recoveryThreshold: number;
  ipAddress: string;
  port: number;
}

export interface ClientRequest {
  id: string;
  timestamp: number;
  clientIp: string;
  sessionId?: string;
  requestSize: number; // in bytes
  priority: 'low' | 'medium' | 'high';
  timeout: number;
  serverId?: string;
  processed: boolean;
  processingTime: number;
  responseTime: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';
  error?: string;
}

export interface Server {
  id: string;
  name: string;
  weight: number;
  originalWeight: number;
  maxConnections: number;
  processingTime: number;
  healthCheckInterval: number;
  failureThreshold: number;
  recoveryThreshold: number;
  ipAddress: string;
  port: number;
  active: boolean;
  healthy: boolean;
  currentConnections: number;
  totalRequests: number;
  totalResponseTime: number;
  failedRequests: number;
  consecutiveFailures: number;
  lastHealthCheck: number;
  currentLoad: number;
  queue: ClientRequest[];
  sessionMap: Map<string, string>; // sessionId -> clientId
  responseTimeHistory: number[];
  failureHistory: { timestamp: number; reason: string }[];
  canAcceptRequest(): boolean;
}

export interface LoadBalancerConfig {
  algorithm: LoadBalancingAlgorithm;
  healthCheckEnabled: boolean;
  stickySessionEnabled: boolean;
  stickySessionTimeout: number;
  failoverEnabled: boolean;
  requestTimeout: number;
  maxRetries: number;
  ipHashSalt: string;
}

export type LoadBalancingAlgorithm = 
  | 'ROUND_ROBIN'
  | 'WEIGHTED_ROUND_ROBIN'
  | 'LEAST_CONNECTIONS'
  | 'LEAST_RESPONSE_TIME'
  | 'IP_HASH'
  | 'STICKY_SESSIONS';

export interface LoadBalancerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  algorithm: LoadBalancingAlgorithm;
  activeServers: number;
  totalServers: number;
  failoverEvents: number;
  lastFailover: number;
  requestRate: number; // requests per second
  throughput: number; // bytes per second
}

export interface ServerStats {
  serverId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  currentLoad: number;
  healthStatus: 'healthy' | 'unhealthy' | 'failed';
  uptime: number;
  lastRequest: number;
  connectionDistribution: { [key: string]: number }; // client IP -> connection count
}

export interface RequestLog {
  id: string;
  timestamp: number;
  clientIp: string;
  sessionId?: string;
  algorithm: LoadBalancingAlgorithm;
  selectedServer: string;
  requestSize: number;
  responseTime: number;
  status: 'success' | 'failure' | 'timeout';
  error?: string;
  failover?: boolean;
}

export interface AnalyticsData {
  overall: LoadBalancerStats;
  perServer: { [serverId: string]: ServerStats };
  requestLogs: RequestLog[];
  algorithmPerformance: {
    [algorithm in LoadBalancingAlgorithm]: {
      totalRequests: number;
      averageResponseTime: number;
      successRate: number;
    };
  };
  timeSeriesData: {
    timestamp: number;
    requestsPerSecond: number;
    averageResponseTime: number;
    activeConnections: number;
  }[];
}

export interface SimulationConfig {
  requestRate: number;
  requestPattern: 'random' | 'burst' | 'steady';
  clientDistribution: 'uniform' | 'geographic' | 'session-based';
  failureSimulation: {
    enabled: boolean;
    failureRate: number;
    failureTypes: ('server-down' | 'timeout' | 'overload')[];
  };
  loadSimulation: {
    enabled: boolean;
    minRequestSize: number;
    maxRequestSize: number;
    requestSizeDistribution: 'uniform' | 'normal' | 'exponential';
  };
}

export interface HealthCheckResult {
  serverId: string;
  timestamp: number;
  healthy: boolean;
  responseTime: number;
  error?: string;
}

export interface FailoverEvent {
  timestamp: number;
  serverId: string;
  reason: 'health-check-failed' | 'timeout' | 'manual' | 'overload';
  newServerId?: string;
  requestsAffected: number;
} 