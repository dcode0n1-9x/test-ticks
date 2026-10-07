export interface Tick {
  symbol: string;
  description: string;
  ltp: number;
  bid: number;
  ask: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  timestamp: number;
  extra: string;
  source?: string;
  dailyChange?: number;
  direction?: "up" | "down" | "neutral";
  formattedTime?: string;
}

export type ConnectionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "ERROR";

export interface WebSocketInstance {
  id: string;
  name: string;
  url: string;
  status: ConnectionStatus;
  useProxy: boolean;
  autoReconnect: boolean;
  errorMessage?: string;
  messagesReceived: number;
  ticksReceived: number;
  messagesPerSec: number;
  lastMessageAt: number | null;
}

export interface SocketMetrics {
  messagesReceived: number;
  ticksReceived: number;
  invalidMessages: number;
  lastMessageAt: number | null;
  messagesPerSec: number;
  ticksPerSec: number;
  uniqueSymbols: number;
  queuePendingAdds: number;
  queuePendingUpdates: number;
  connectedSockets: number;
  totalSockets: number;
}

export interface LogEntry {
  id: string;
  time: string;
  type: "info" | "warn" | "error" | "success";
  message: string;
}

