"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TickStore } from "../market-data/tickStore";
import { GridUpdateQueue } from "../market-data/gridUpdateQueue";
import { mapRowToTick } from "../market-data/mapRowToTick";
import { ConnectionStatus, SocketMetrics, LogEntry, Tick } from "../market-data/types";

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000];

export function useMarketDataSocket(initialUrl: string = "ws://localhost:3000/ws") {
  const [url, setUrl] = useState<string>(initialUrl);
  const [status, setStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [autoReconnect, setAutoReconnect] = useState<boolean>(true);
  const [flushIntervalMs, setFlushIntervalMs] = useState<number>(50);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMockRunning, setIsMockRunning] = useState<boolean>(false);

  // Core market data state held in ref to avoid React state overhead on tick
  const tickStoreRef = useRef<TickStore>(new TickStore());
  const gridQueueRef = useRef<GridUpdateQueue>(new GridUpdateQueue(50));
  const socketRef = useRef<WebSocket | null>(null);

  // Internal flags and metrics counters
  const isManualDisconnectRef = useRef<boolean>(false);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Metric accumulators
  const metricsCountersRef = useRef({
    messagesReceived: 0,
    ticksReceived: 0,
    invalidMessages: 0,
    lastMessageAt: null as number | null,
    msgWindow: 0,
    tickWindow: 0,
  });

  const [metrics, setMetrics] = useState<SocketMetrics>({
    messagesReceived: 0,
    ticksReceived: 0,
    invalidMessages: 0,
    lastMessageAt: null,
    messagesPerSec: 0,
    ticksPerSec: 0,
    uniqueSymbols: 0,
    queuePendingAdds: 0,
    queuePendingUpdates: 0,
  });

  // Logging helper
  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 99)]);
  }, []);

  // Update Grid update queue flush interval when state changes
  useEffect(() => {
    gridQueueRef.current.setFlushInterval(flushIntervalMs);
  }, [flushIntervalMs]);

  // Start grid queue loop on mount
  useEffect(() => {
    const queue = gridQueueRef.current;
    queue.start();
    return () => {
      queue.stop();
    };
  }, []);

  // Periodic metrics sync (1s interval for rates)
  useEffect(() => {
    const interval = setInterval(() => {
      const pending = gridQueueRef.current.getPendingCounts();
      setMetrics({
        messagesReceived: metricsCountersRef.current.messagesReceived,
        ticksReceived: metricsCountersRef.current.ticksReceived,
        invalidMessages: metricsCountersRef.current.invalidMessages,
        lastMessageAt: metricsCountersRef.current.lastMessageAt,
        messagesPerSec: metricsCountersRef.current.msgWindow,
        ticksPerSec: metricsCountersRef.current.tickWindow,
        uniqueSymbols: tickStoreRef.current.size(),
        queuePendingAdds: pending.adds,
        queuePendingUpdates: pending.updates,
      });

      // Reset rolling window counters
      metricsCountersRef.current.msgWindow = 0;
      metricsCountersRef.current.tickWindow = 0;
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Processing a raw WebSocket message string
  const processMessage = useCallback((raw: string) => {
    metricsCountersRef.current.messagesReceived += 1;
    metricsCountersRef.current.msgWindow += 1;
    metricsCountersRef.current.lastMessageAt = Date.now();

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      metricsCountersRef.current.invalidMessages += 1;
      addLog("warn", "Invalid WebSocket JSON received");
      return;
    }

    if (!Array.isArray(payload)) {
      metricsCountersRef.current.invalidMessages += 1;
      addLog("warn", "WebSocket payload is not an array");
      return;
    }

    // Support single tick array wrapped in an array OR array of tick arrays
    const rows = Array.isArray(payload[0]) ? payload : [payload];

    for (const row of rows) {
      if (!Array.isArray(row)) {
        metricsCountersRef.current.invalidMessages += 1;
        continue;
      }

      const tick: Tick = mapRowToTick(row);
      if (!tick.symbol) {
        metricsCountersRef.current.invalidMessages += 1;
        continue;
      }

      const exists = tickStoreRef.current.set(tick);
      gridQueueRef.current.queueTick(tick, exists);
      metricsCountersRef.current.ticksReceived += 1;
      metricsCountersRef.current.tickWindow += 1;
    }
  }, [addLog]);

  // Connect function
  const connect = useCallback((targetUrl?: string) => {
    const endpoint = targetUrl || url;
    if (!endpoint) {
      addLog("error", "Cannot connect: WebSocket URL is empty");
      return;
    }

    // Check for Mixed Content risk (HTTPS page calling ws://)
    if (typeof window !== "undefined" && window.location.protocol === "https:" && endpoint.startsWith("ws://")) {
      addLog(
        "warn",
        `Mixed Content Blocked: Page loaded over HTTPS (${window.location.host}) cannot connect to unencrypted '${endpoint}'. Endpoint must be 'wss://' on HTTPS sites.`
      );
    }

    // Clear any pending reconnect timers
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Close existing socket cleanly
    if (socketRef.current) {
      isManualDisconnectRef.current = true;
      socketRef.current.close();
    }

    isManualDisconnectRef.current = false;
    setStatus("CONNECTING");
    addLog("info", `Connecting to WebSocket: ${endpoint}`);

    try {
      const ws = new WebSocket(endpoint);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus("CONNECTED");
        reconnectAttemptRef.current = 0;
        addLog("success", `Connected to ${endpoint}`);
      };

      ws.onmessage = (event: MessageEvent) => {
        processMessage(String(event.data));
      };

      ws.onerror = () => {
        addLog("error", "WebSocket error occurred (possible Mixed Content ws:// block or unreachable host)");
        setStatus("ERROR");
      };

      ws.onclose = (event) => {
        socketRef.current = null;

        if (isManualDisconnectRef.current) {
          setStatus("DISCONNECTED");
          addLog("info", "WebSocket disconnected manually");
        } else {
          setStatus("DISCONNECTED");
          addLog("warn", `WebSocket connection closed (code ${event.code})`);

          if (autoReconnect) {
            const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
            reconnectAttemptRef.current += 1;
            addLog("info", `Attempting auto-reconnect #${reconnectAttemptRef.current} in ${delay}ms...`);
            
            reconnectTimerRef.current = setTimeout(() => {
              connect(endpoint);
            }, delay);
          }
        }
      };
    } catch (error: any) {
      setStatus("ERROR");
      addLog("error", `Failed to initiate WebSocket connection: ${error.message || error}`);
    }
  }, [url, autoReconnect, processMessage, addLog]);

  // Manual Disconnect
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus("DISCONNECTED");
    addLog("info", "Disconnected by user");
  }, [addLog]);

  // Clear data utility
  const clearData = useCallback(() => {
    tickStoreRef.current.clear();
    gridQueueRef.current.clear();
    metricsCountersRef.current = {
      messagesReceived: 0,
      ticksReceived: 0,
      invalidMessages: 0,
      lastMessageAt: null,
      msgWindow: 0,
      tickWindow: 0,
    };
    setMetrics({
      messagesReceived: 0,
      ticksReceived: 0,
      invalidMessages: 0,
      lastMessageAt: null,
      messagesPerSec: 0,
      ticksPerSec: 0,
      uniqueSymbols: 0,
      queuePendingAdds: 0,
      queuePendingUpdates: 0,
    });
    addLog("info", "Cleared all tick store, queue, and metrics data");
  }, [addLog]);

  // Local Mock Generator Toggle for testing without external WS server
  const toggleMockGenerator = useCallback((enable?: boolean) => {
    const shouldEnable = enable !== undefined ? enable : !isMockRunning;
    
    if (!shouldEnable) {
      if (mockIntervalRef.current) {
        clearInterval(mockIntervalRef.current);
        mockIntervalRef.current = null;
      }
      setIsMockRunning(false);
      addLog("info", "Mock feed simulator stopped");
      return;
    }

    const mockSymbols = [
      { sym: "PEPUS", desc: "PepsiCo Inc", base: 140.0 },
      { sym: "SI-U26", desc: "Silver Futures Sep 2026", base: 64.9 },
      { sym: "HG-U26", desc: "Copper Futures Sep 2026", base: 661.8 },
      { sym: "CPTUS", desc: "Camden Property Trust", base: 110.4 },
      { sym: "GC-Z26", desc: "Gold Futures Dec 2026", base: 4432.7 },
      { sym: "CL-U26", desc: "Crude Oil Sep 2026", base: 80.2 },
      { sym: "AAPLUS", desc: "Apple Inc", base: 220.5 },
      { sym: "MSFTUS", desc: "Microsoft Corp", base: 415.2 },
      { sym: "NVDAUS", desc: "NVIDIA Corp", base: 125.8 },
      { sym: "TSLAUS", desc: "Tesla Inc", base: 210.4 },
      { sym: "AMZNUS", desc: "Amazon.com Inc", base: 180.1 },
      { sym: "GOOGL", desc: "Alphabet Inc Class A", base: 165.7 },
    ];

    setIsMockRunning(true);
    addLog("success", "Started high-frequency local mock tick generator");

    mockIntervalRef.current = setInterval(() => {
      // Pick 2 to 5 random symbols to mutate
      const count = Math.floor(Math.random() * 4) + 1;
      const batch = [];

      for (let i = 0; i < count; i++) {
        const item = mockSymbols[Math.floor(Math.random() * mockSymbols.length)];
        const delta = (Math.random() - 0.49) * (item.base * 0.005);
        const ltp = Number((item.base + delta).toFixed(3));
        const spread = Number((item.base * 0.0003).toFixed(3));
        const bid = Number((ltp - spread).toFixed(3));
        const ask = Number((ltp + spread).toFixed(3));
        const dateStr = new Date().toISOString().replace("T", " T ").substring(0, 21);

        batch.push([
          item.sym,
          item.desc,
          String(ltp),
          String(bid),
          String(ask),
          String(item.base),
          String(ltp * 1.01),
          String(ltp * 0.99),
          String(item.base),
          dateStr,
          "MOCK_STREAM",
        ]);
      }

      processMessage(JSON.stringify(batch));
    }, 40); // 40ms stream interval (25 msgs/sec)
  }, [isMockRunning, processMessage, addLog]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  return {
    url,
    setUrl,
    status,
    autoReconnect,
    setAutoReconnect,
    flushIntervalMs,
    setFlushIntervalMs,
    metrics,
    logs,
    connect,
    disconnect,
    clearData,
    isMockRunning,
    toggleMockGenerator,
    tickStore: tickStoreRef.current,
    gridQueue: gridQueueRef.current,
  };
}
