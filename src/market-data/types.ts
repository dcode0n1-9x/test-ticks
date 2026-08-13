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
}

export type ConnectionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "ERROR";

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
}

export interface LogEntry {
  id: string;
  time: string;
  type: "info" | "warn" | "error" | "success";
  message: string;
}
