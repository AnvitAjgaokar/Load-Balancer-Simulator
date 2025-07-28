import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, 
  Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area 
} from 'recharts';
import { Server, LoadBalancerStats, RequestLog, FailoverEvent } from '../types';

interface DashboardProps {
  servers: Server[];
  stats: LoadBalancerStats;
  requestLogs: RequestLog[];
  failoverEvents: FailoverEvent[];
  algorithm: string;
  isSimulationRunning: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BFE', '#FF6B6B', '#4ECDC4', '#45B7D1'];

// Memoized utility functions
const getServerStatusColor = (server: Server): string => {
  if (!server.active) return '#6c757d';
  if (!server.healthy) return '#dc3545';
  const loadPercentage = (server.currentConnections / server.maxConnections) * 100;
  if (loadPercentage > 80) return '#ffc107';
  return '#28a745';
};

const getLoadPercentage = (server: Server): number => {
  return Math.min(100, (server.currentConnections / server.maxConnections) * 100);
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

const getSuccessRate = (server: Server): number => {
  if (server.totalRequests === 0) return 100;
  return ((server.totalRequests - server.failedRequests) / server.totalRequests) * 100;
};

const getAverageResponseTime = (server: Server): string => {
  return server.totalRequests > 0 ? 
    (server.totalResponseTime / server.totalRequests).toFixed(0) : '0';
};

export const Dashboard: React.FC<DashboardProps> = React.memo(({
  servers,
  stats,
  requestLogs,
  failoverEvents,
  algorithm,
  isSimulationRunning
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
  const [selectedView, setSelectedView] = useState<'overview' | 'servers' | 'requests' | 'analytics'>('overview');

  // Memoized routing logs to prevent recalculation on every render
  const routingLogs = useMemo(() => {
    const getRoutingReason = (algorithm: string, serverId: string, servers: Server[]) => {
      const server = servers.find(s => s.id === serverId);
      if (!server) return 'Server not found';
      
      switch (algorithm) {
        case 'ROUND_ROBIN':
          return 'Round Robin distribution';
        case 'WEIGHTED_ROUND_ROBIN':
          return `Weighted Round Robin (weight: ${server.weight})`;
        case 'LEAST_CONNECTIONS':
          return `Least Connections (${server.currentConnections} connections)`;
        case 'LEAST_RESPONSE_TIME':
          const avgResponse = server.totalRequests > 0 ? 
            (server.totalResponseTime / server.totalRequests).toFixed(0) : 'N/A';
          return `Least Response Time (${avgResponse}ms avg)`;
        case 'IP_HASH':
          return 'IP Hash consistent routing';
        case 'STICKY_SESSIONS':
          return 'Sticky Session affinity';
        default:
          return 'Algorithm selection';
      }
    };

    return requestLogs.slice(-50).map(log => ({
      timestamp: log.timestamp,
      clientIp: log.clientIp,
      selectedServer: log.selectedServer,
      algorithm: log.algorithm,
      reason: getRoutingReason(log.algorithm, log.selectedServer, servers)
    }));
  }, [requestLogs, servers]);

  // Memoized time-filtered logs
  const timeFilteredLogs = useMemo(() => {
    const now = Date.now();
    const timeRanges = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000
    };
    const cutoff = now - timeRanges[selectedTimeRange];
    return requestLogs.filter(log => log.timestamp > cutoff);
  }, [requestLogs, selectedTimeRange]);

  // Memoized chart data
  const chartData = useMemo(() => {
    return servers.map(server => ({
      name: server.name,
      avgResponse: server.totalRequests > 0 ? server.totalResponseTime / server.totalRequests : 0,
      requests: server.totalRequests,
      successRate: getSuccessRate(server),
      failedRequests: server.failedRequests
    }));
  }, [servers]);

  // Memoized pie chart data
  const pieChartData = useMemo(() => {
    return servers.map(server => ({
      name: server.name,
      value: server.currentConnections,
      fill: getServerStatusColor(server)
    }));
  }, [servers]);

  // Memoized area chart data
  const areaChartData = useMemo(() => {
    return timeFilteredLogs.slice(-20).map(log => ({
      time: formatTime(log.timestamp),
      requests: 1
    }));
  }, [timeFilteredLogs]);

  // Memoized request table data
  const requestTableData = useMemo(() => {
    return timeFilteredLogs.slice(-50).reverse();
  }, [timeFilteredLogs]);

  // Memoized routing logs for display
  const displayRoutingLogs = useMemo(() => {
    return routingLogs.slice(-20).reverse();
  }, [routingLogs]);

  // Memoized event handlers
  const handleTimeRangeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTimeRange(e.target.value as any);
  }, []);

  const handleViewChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedView(e.target.value as any);
  }, []);

  return (
    <div style={{ 
      padding: '24px', 
      backgroundColor: '#f8f9fa', 
      minHeight: '100vh',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header with improved styling */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px',
        backgroundColor: 'white',
        padding: '20px 24px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid #e9ecef',
        flexShrink: 0
      }}>
        <div>
          <h2 style={{ 
            margin: 0, 
            color: '#1a1a1a', 
            fontSize: '24px',
            fontWeight: '600',
            letterSpacing: '-0.025em'
          }}>
            Load Balancer Dashboard
          </h2>
          <p style={{ 
            margin: '8px 0 0 0', 
            color: '#6c757d',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Algorithm: <span style={{ color: '#007bff', fontWeight: '600' }}>{algorithm}</span> | 
            Status: <span style={{ 
              color: isSimulationRunning ? '#28a745' : '#dc3545',
              fontWeight: '600'
            }}>
              {isSimulationRunning ? 'Running' : 'Stopped'}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            value={selectedTimeRange} 
            onChange={handleTimeRangeChange}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: '1px solid #dee2e6',
              backgroundColor: 'white',
              fontSize: '14px',
              fontWeight: '500',
              color: '#495057'
            }}
          >
            <option value="1m">Last 1 minute</option>
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
          </select>
          <select 
            value={selectedView} 
            onChange={handleViewChange}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: '1px solid #dee2e6',
              backgroundColor: 'white',
              fontSize: '14px',
              fontWeight: '500',
              color: '#495057'
            }}
          >
            <option value="overview">Overview</option>
            <option value="servers">Servers</option>
            <option value="requests">Requests</option>
            <option value="analytics">Analytics</option>
          </select>
        </div>
      </div>

      {/* Content Area with proper scrolling */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
        {/* Overview Dashboard */}
        {selectedView === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Key Metrics Card */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '24px', 
              borderRadius: '12px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #e9ecef'
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                color: '#1a1a1a',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Key Metrics
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#007bff', marginBottom: '4px' }}>
                    {stats.totalRequests.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500' }}>Total Requests</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#28a745', marginBottom: '4px' }}>
                    {stats.activeServers}/{stats.totalServers}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500' }}>Active Servers</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#ffc107', marginBottom: '4px' }}>
                    {stats.averageResponseTime.toFixed(0)}ms
                  </div>
                  <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500' }}>Avg Response Time</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#dc3545', marginBottom: '4px' }}>
                    {stats.failoverEvents}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500' }}>Failover Events</div>
                </div>
              </div>
            </div>

            {/* Server Status Card */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '24px', 
              borderRadius: '12px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #e9ecef'
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                color: '#1a1a1a',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Server Status
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Request Rate Card */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '24px', 
              borderRadius: '12px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #e9ecef'
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                color: '#1a1a1a',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Request Rate
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={areaChartData}>
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="requests" stroke="#007bff" fill="#007bff" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Servers View */}
        {selectedView === 'servers' && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '12px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ 
              margin: '0 0 24px 0', 
              color: '#1a1a1a',
              fontSize: '20px',
              fontWeight: '600'
            }}>
              Server Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
              {servers.map(server => (
                <div key={server.id} style={{ 
                  border: '1px solid #dee2e6', 
                  borderRadius: '12px', 
                  padding: '20px',
                  backgroundColor: getServerStatusColor(server) === '#28a745' ? '#f8fff8' : 
                                 getServerStatusColor(server) === '#ffc107' ? '#fffbf0' : '#fff5f5',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, color: '#1a1a1a', fontSize: '16px', fontWeight: '600' }}>{server.name}</h4>
                    <span style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: getServerStatusColor(server),
                      color: 'white'
                    }}>
                      {server.active && server.healthy ? 'Healthy' : 
                       !server.active ? 'Inactive' : 'Unhealthy'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500', marginBottom: '4px' }}>IP Address</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{server.ipAddress}:{server.port}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500', marginBottom: '4px' }}>Weight</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{server.weight}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500', marginBottom: '4px' }}>Connections</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>
                        {server.currentConnections}/{server.maxConnections}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500', marginBottom: '4px' }}>Success Rate</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>
                        {getSuccessRate(server).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Load Bar */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6c757d', fontWeight: '500', marginBottom: '6px' }}>
                      <span>Load</span>
                      <span>{getLoadPercentage(server).toFixed(1)}%</span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '8px', 
                      backgroundColor: '#e9ecef', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${getLoadPercentage(server)}%`,
                        height: '100%',
                        backgroundColor: getServerStatusColor(server),
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#6c757d' }}>
                    <div>Avg Response: {getAverageResponseTime(server)}ms</div>
                    <div>Total Requests: {server.totalRequests.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Requests View */}
        {selectedView === 'requests' && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '12px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#1a1a1a',
              fontSize: '20px',
              fontWeight: '600'
            }}>
              Recent Requests
            </h3>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: '14px', fontWeight: '600', color: '#495057' }}>Time</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: '14px', fontWeight: '600', color: '#495057' }}>Client IP</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: '14px', fontWeight: '600', color: '#495057' }}>Server</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: '14px', fontWeight: '600', color: '#495057' }}>Size</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: '14px', fontWeight: '600', color: '#495057' }}>Response Time</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: '14px', fontWeight: '600', color: '#495057' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requestTableData.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#6c757d' }}>{formatTime(log.timestamp)}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#1a1a1a', fontWeight: '500' }}>{log.clientIp}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#1a1a1a', fontWeight: '500' }}>{log.selectedServer}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#6c757d' }}>{formatBytes(log.requestSize)}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#6c757d' }}>{log.responseTime}ms</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: log.status === 'success' ? '#d4edda' : '#f8d7da',
                          color: log.status === 'success' ? '#155724' : '#721c24'
                        }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Enhanced Analytics View with proper scrolling */}
        {selectedView === 'analytics' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', 
            gap: '24px',
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            paddingBottom: '24px'
          }}>
            {/* Response Time Distribution */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '24px', 
              borderRadius: '12px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #e9ecef',
              minHeight: '400px'
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                color: '#1a1a1a',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Response Time Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgResponse" fill="#007bff" name="Avg Response (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Request Distribution */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '24px', 
              borderRadius: '12px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #e9ecef',
              minHeight: '400px'
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                color: '#1a1a1a',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Request Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={servers.map(server => ({
                      name: server.name,
                      value: server.totalRequests
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {servers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Success Rate Comparison */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '24px', 
              borderRadius: '12px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #e9ecef',
              minHeight: '400px'
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                color: '#1a1a1a',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Success Rate Comparison
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="successRate" fill="#28a745" name="Success Rate (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Routing Decision Logs */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '24px', 
              borderRadius: '12px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #e9ecef',
              minHeight: '400px'
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                color: '#1a1a1a',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Routing Decision Logs
              </h3>
              <div style={{ 
                maxHeight: '300px', 
                overflowY: 'auto',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '12px'
              }}>
                {displayRoutingLogs.map((log, index) => (
                  <div key={index} style={{ 
                    padding: '12px', 
                    borderBottom: index < displayRoutingLogs.length - 1 ? '1px solid #f1f3f4' : 'none',
                    backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'transparent'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>{formatTime(log.timestamp)}</span>
                      <span style={{ fontSize: '12px', color: '#007bff', fontWeight: '600' }}>{log.selectedServer}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#1a1a1a', marginBottom: '2px' }}>
                      Client: {log.clientIp}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>
                      {log.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

Dashboard.displayName = 'Dashboard'; 