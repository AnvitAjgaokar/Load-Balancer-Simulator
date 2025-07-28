# Enhanced Load Balancer Simulator

A production-level load balancer simulator that closely mirrors how modern load balancers operate in real-world environments. This simulator provides comprehensive testing and visualization of various load balancing algorithms with realistic network conditions and failure scenarios.

## 🚀 Features

### Load Balancing Algorithms

- **Round Robin**: Sequential distribution of requests
- **Weighted Round Robin**: Distribution based on server weights
- **Least Connections**: Routes to server with fewest active connections
- **Least Response Time**: Routes to server with lowest average response time
- **IP Hash**: Consistent routing based on client IP address
- **Sticky Sessions**: Maintains session affinity for consistent routing

### Server Management

- **Dynamic Server Configuration**: Add/remove servers during runtime
- **Health Monitoring**: Real-time health checks with configurable intervals
- **Failure Simulation**: Simulate server failures and recovery
- **Load Balancing**: Automatic failover and recovery mechanisms
- **Customizable Parameters**:
  - Server weights
  - Maximum connections
  - Processing times
  - Health check intervals
  - Failure/recovery thresholds

### Request Simulation

- **Multiple Request Types**: Static/dynamic IPs, session-based requests
- **Variable Load Sizes**: Configurable request sizes and distributions
- **Realistic Network Conditions**: Simulated latency, timeouts, and failures
- **Request Patterns**: Steady, burst, and random traffic patterns
- **Client Distribution**: Uniform, geographic, and session-based distributions

### Real-time Dashboard

- **Live Server Status**: Visual representation of all backend servers
- **Request Routing Visualization**: Real-time request flow animation
- **Comprehensive Analytics**:
  - Request logs and routing history
  - Response time trends
  - Connection distribution metrics
  - Failover event tracking
- **Multiple Views**:
  - Overview dashboard
  - Detailed server status
  - Request logs
  - Analytics and charts

### Advanced Configuration

- **Algorithm Switching**: Change algorithms during runtime
- **Health Check Configuration**: Enable/disable and configure health checks
- **Session Management**: Sticky session configuration
- **Failure Tolerance**: Configurable retry mechanisms and timeouts
- **Performance Tuning**: Adjustable request rates and processing parameters

## 🛠️ Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd load-balancer-simulator
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## 📊 Usage

### Getting Started

1. **Configure Servers**: Add servers with custom configurations including weights, processing times, and health check settings.

2. **Select Algorithm**: Choose from the available load balancing algorithms based on your requirements.

3. **Start Simulation**: Configure request rates and patterns, then start the simulation to see real-time load balancing in action.

4. **Monitor Performance**: Use the dashboard to monitor server health, request distribution, and performance metrics.

### Dashboard Features

#### Overview Tab

- Key metrics display (total requests, active servers, average response time)
- Server status visualization
- Real-time request rate monitoring

#### Servers Tab

- Detailed server information
- Health status indicators
- Load percentage visualization
- Performance metrics per server

#### Requests Tab

- Real-time request logs
- Request routing history
- Status tracking (success/failure/timeout)
- Client IP and session information

#### Analytics Tab

- Response time distribution charts
- Request distribution visualization
- Performance comparison across algorithms
- Historical data analysis

### Advanced Configuration

#### Algorithm Parameters

- **Round Robin**: No additional parameters
- **Weighted Round Robin**: Configure server weights
- **Least Connections**: Automatic based on connection count
- **Least Response Time**: Automatic based on response time history
- **IP Hash**: Consistent routing based on client IP
- **Sticky Sessions**: Session timeout configuration

#### Simulation Settings

- **Request Rate**: 1-100 requests per second
- **Request Pattern**: Steady, burst, or random
- **Client Distribution**: Uniform, geographic, or session-based
- **Failure Simulation**: Enable/disable with configurable failure rates
- **Load Simulation**: Variable request sizes with different distributions

#### Health Check Configuration

- **Health Check Interval**: 5-60 seconds
- **Failure Threshold**: Number of consecutive failures before marking unhealthy
- **Recovery Threshold**: Number of successful checks before recovery
- **Timeout Settings**: Configurable health check timeouts

## 🔧 Architecture

### Core Components

1. **EnhancedLoadBalancer**: Main load balancer engine with all algorithms
2. **LoadBalancingAlgorithms**: Implementation of all load balancing strategies
3. **Dashboard**: Real-time visualization and monitoring interface
4. **ControlPanel**: Configuration and management interface

### Data Flow

1. **Request Generation**: Simulated client requests with configurable parameters
2. **Algorithm Selection**: Load balancer selects server based on chosen algorithm
3. **Request Processing**: Server processes request with realistic timing
4. **Health Monitoring**: Continuous health checks and failover management
5. **Analytics Collection**: Comprehensive metrics and logging
6. **Visualization**: Real-time dashboard updates

### Key Features

- **Type Safety**: Full TypeScript implementation
- **Modular Design**: Clean separation of concerns
- **Real-time Updates**: Live dashboard with smooth animations
- **Comprehensive Logging**: Detailed request and event tracking
- **Failure Simulation**: Realistic network condition simulation
- **Performance Monitoring**: Extensive metrics and analytics

## 📈 Performance Metrics

The simulator tracks comprehensive performance metrics including:

- **Request Metrics**: Total requests, success/failure rates, response times
- **Server Metrics**: Connection counts, health status, processing times
- **Algorithm Performance**: Comparison across different algorithms
- **Network Metrics**: Failover events, recovery times, availability
- **Load Distribution**: How requests are distributed across servers

## 🎯 Use Cases

### Educational

- Learn about different load balancing algorithms
- Understand how health checks and failover work
- Visualize request distribution patterns

### Testing & Development

- Test load balancing configurations
- Simulate failure scenarios
- Validate performance under different conditions

### Demonstration

- Show load balancer behavior to stakeholders
- Demonstrate failover and recovery mechanisms
- Present performance comparisons

## 🔮 Future Enhancements

- **WebSocket Integration**: Real-time communication with actual servers
- **Database Integration**: Persistent configuration and analytics storage
- **API Endpoints**: RESTful API for external integrations
- **Multi-tenant Support**: Multiple load balancer instances
- **Advanced Analytics**: Machine learning-based performance optimization
- **Mobile Support**: Responsive design for mobile devices

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Note**: This is a simulation tool designed for educational and testing purposes. For production load balancing, consider using established solutions like HAProxy, Nginx, or cloud-based load balancers.
