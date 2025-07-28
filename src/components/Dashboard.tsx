import React, { useState, useEffect, useRef } from 'react';
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

export const Dashboard: React.FC<DashboardProps> = ({
  servers,
  stats,
  requestLogs,
  failoverEvents,
  algorithm,
  isSimulationRunning
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
  const [selectedView, setSelectedView] = useState<'overview' | 'servers' | 'requests' | 'analytics'>('overview');

  const getTimeFilteredLogs = () => {
    const now = Date.now();
    const timeRanges = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000
    };
    const cutoff = now - timeRanges[selectedTimeRange];
    return requestLogs.filter(log => log.timestamp > cutoff);
  };

  const getServerStatusColor = (server: Server) => {
    if (!server.active) return '#6c757d';
    if (!server.healthy) return '#dc3545';
    const loadPercentage = (server.currentConnections / server.maxConnections) * 100;
    if (loadPercentage > 80) return '#ffc107';
    return '#28a745';
  };

  const getLoadPercentage = (server: Server) => {
    return Math.min(100, (server.currentConnections / server.maxConnections) * 100);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#333' }}>Load Balancer Dashboard</h2>
          <p style={{ margin: '5px 0 0 0', color: '#666' }}>
            Algorithm: {algorithm} | Status: {isSimulationRunning ? 'Running' : 'Stopped'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select 
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="1m">Last 1 minute</option>
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
          </select>
          <select 
            value={selectedView} 
            onChange={(e) => setSelectedView(e.target.value as any)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="overview">Overview</option>
            <option value="servers">Servers</option>
            <option value="requests">Requests</option>
            <option value="analytics">Analytics</option>
          </select>
        </div>
      </div>

      {/* Overview Dashboard */}
      {selectedView === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {/* Key Metrics */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Key Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                  {stats.totalRequests}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Total Requests</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                  {stats.activeServers}/{stats.totalServers}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Active Servers</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                  {stats.averageResponseTime.toFixed(0)}ms
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Avg Response Time</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                  {stats.failoverEvents}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Failover Events</div>
              </div>
            </div>
          </div>

          {/* Server Status */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Server Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={servers.map(server => ({
                    name: server.name,
                    value: server.currentConnections,
                    fill: getServerStatusColor(server)
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {servers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getServerStatusColor(entry)} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Request Rate */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Request Rate</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={getTimeFilteredLogs().slice(-20).map(log => ({
                time: formatTime(log.timestamp),
                requests: 1
              }))}>
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
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Server Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
            {servers.map(server => (
              <div key={server.id} style={{ 
                border: '1px solid #ddd', 
                borderRadius: '8px', 
                padding: '15px',
                backgroundColor: getServerStatusColor(server) === '#28a745' ? '#f8fff8' : 
                               getServerStatusColor(server) === '#ffc107' ? '#fffbf0' : '#fff5f5'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, color: '#333' }}>{server.name}</h4>
                  <div style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '12px',
                    backgroundColor: getServerStatusColor(server),
                    color: 'white'
                  }}>
                    {server.active && server.healthy ? 'Healthy' : 
                     !server.active ? 'Inactive' : 'Unhealthy'}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>IP Address</div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{server.ipAddress}:{server.port}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Weight</div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{server.weight}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Connections</div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>
                      {server.currentConnections}/{server.maxConnections}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Total Requests</div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{server.totalRequests}</div>
                  </div>
                </div>

                {/* Load Bar */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
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

                {/* Response Time */}
                <div style={{ fontSize: '12px', color: '#666' }}>
                  Avg Response: {server.totalRequests > 0 ? 
                    (server.totalResponseTime / server.totalRequests).toFixed(0) : 0}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requests View */}
      {selectedView === 'requests' && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Recent Requests</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Time</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Client IP</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Server</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Size</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Response Time</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {getTimeFilteredLogs().slice(-50).reverse().map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{formatTime(log.timestamp)}</td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{log.clientIp}</td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{log.selectedServer}</td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{formatBytes(log.requestSize)}</td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{log.responseTime}ms</td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
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

      {/* Analytics View */}
      {selectedView === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          {/* Response Time Distribution */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Response Time Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={servers.map(server => ({
                name: server.name,
                avgResponse: server.totalRequests > 0 ? server.totalResponseTime / server.totalRequests : 0,
                requests: server.totalRequests
              }))}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgResponse" fill="#007bff" name="Avg Response (ms)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Request Distribution */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Request Distribution</h3>
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
        </div>
      )}
    </div>
  );
}; 