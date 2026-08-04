export interface LogEntry {
  environment: 'development' | 'production' | 'staging';
  event: string;
  level: 'DEBUG' | 'ERROR' | 'FATAL' | 'INFO' | 'WARN';
  message: string;
  meta?: {
    [key: string]: boolean | null | number | string | undefined;
    latency_ms?: number;
    method?: string;
    path?: string;
  };
  requestId: string;
  service: string;
  timestamp: string;
  userId?: string;
}
