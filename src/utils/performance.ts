// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private timers: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer '${name}' was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);

    // Keep only last 100 measurements
    const measurements = this.metrics.get(name)!;
    if (measurements.length > 100) {
      this.metrics.set(name, measurements.slice(-100));
    }

    return duration;
  }

  getAverageTime(name: string): number {
    const measurements = this.metrics.get(name);
    if (!measurements || measurements.length === 0) return 0;
    
    const sum = measurements.reduce((acc, val) => acc + val, 0);
    return sum / measurements.length;
  }

  getMetrics(): { [key: string]: { average: number; count: number; min: number; max: number } } {
    const result: { [key: string]: { average: number; count: number; min: number; max: number } } = {};
    
    this.metrics.forEach((measurements, name) => {
      if (measurements.length > 0) {
        const sum = measurements.reduce((acc, val) => acc + val, 0);
        const min = Math.min(...measurements);
        const max = Math.max(...measurements);
        
        result[name] = {
          average: sum / measurements.length,
          count: measurements.length,
          min,
          max
        };
      }
    });

    return result;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

// React performance hooks
export const usePerformanceTimer = (name: string) => {
  const monitor = PerformanceMonitor.getInstance();
  
  return {
    start: () => monitor.startTimer(name),
    end: () => monitor.endTimer(name),
    getAverage: () => monitor.getAverageTime(name)
  };
};

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Memory usage monitoring
export function getMemoryUsage(): { used: number; total: number; percentage: number } {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    };
  }
  
  return { used: 0, total: 0, percentage: 0 };
}

// Frame rate monitoring
export class FrameRateMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 0;
  private callback?: (fps: number) => void;

  constructor(callback?: (fps: number) => void) {
    this.callback = callback;
    this.start();
  }

  private start(): void {
    const measureFPS = () => {
      this.frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - this.lastTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastTime = currentTime;
        
        if (this.callback) {
          this.callback(this.fps);
        }
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    requestAnimationFrame(measureFPS);
  }

  getFPS(): number {
    return this.fps;
  }
} 