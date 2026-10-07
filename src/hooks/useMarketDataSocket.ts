"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { TickStore } from "../market-data/tickStore";
import { GridUpdateQueue } from "../market-data/gridUpdateQueue";
import { mapRowToTick } from "../market-data/mapRowToTick";
import { ConnectionStatus, SocketMetrics, LogEntry, Tick, WebSocketInstance } from "../market-data/types";

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000];

interface SocketRuntime {
  id: string;
  socket: WebSocket | null;
  eventSource: EventSource | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempt: number;
  isManualDisconnect: boolean;
  messagesReceived: number;
  ticksReceived: number;
  lastMessageAt: number | null;
  msgWindow: number;
  tickWindow: number;
  status: ConnectionStatus;
  errorMessage?: string;
}

export function useMarketDataSocket(initialUrl: string = "ws://trade.indianifty.com:9001?format=compact") {
  const [sockets, setSockets] = useState<WebSocketInstance[]>(() => {
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    const cleanInitial = initialUrl.trim();
    const normalized = cleanInitial && !/^wss?:\/\//i.test(cleanInitial) ? `ws://${cleanInitial}` : cleanInitial;
    const shouldProxy = isHttps && normalized.toLowerCase().startsWith("ws://");
    return [
      {
        id: "ws-1",
        name: "IndiaNifty Trade Feed",
        url: normalized,
        status: "DISCONNECTED",
        useProxy: shouldProxy,
        autoReconnect: true,
        messagesReceived: 0,
        ticksReceived: 0,
        messagesPerSec: 0,
        lastMessageAt: null,
      },
    ];
  });

  const [flushIntervalMs, setFlushIntervalMs] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMockRunning, setIsMockRunning] = useState<boolean>(false);

  // Core market data store & queue instances with stable references (defaults to 0ms Zero Delay)
  const tickStore = useMemo(() => new TickStore(), []);
  const gridQueue = useMemo(() => new GridUpdateQueue(0), []);

  // Sockets ref kept in sync for async callbacks
  const socketsRef = useRef<WebSocketInstance[]>(sockets);
  useEffect(() => {
    socketsRef.current = sockets;
  }, [sockets]);

  // Per-socket runtime instances (WebSockets, EventSources, reconnect timers, counters)
  const runtimesRef = useRef<Map<string, SocketRuntime>>(new Map());

  // Global metric accumulators
  const globalMetricsRef = useRef({
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
    connectedSockets: 0,
    totalSockets: 1,
  });

  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectSocketRef = useRef<(id: string) => void>(() => {});

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

  // Helper to retrieve or initialize runtime object for a socket
  const getOrCreateRuntime = useCallback((id: string): SocketRuntime => {
    let runtime = runtimesRef.current.get(id);
    if (!runtime) {
      runtime = {
        id,
        socket: null,
        eventSource: null,
        reconnectTimer: null,
        reconnectAttempt: 0,
        isManualDisconnect: false,
        messagesReceived: 0,
        ticksReceived: 0,
        lastMessageAt: null,
        msgWindow: 0,
        tickWindow: 0,
        status: "DISCONNECTED",
      };
      runtimesRef.current.set(id, runtime);
    }
    return runtime;
  }, []);

  // Update Grid update queue flush interval when state changes
  useEffect(() => {
    gridQueue.setFlushInterval(flushIntervalMs);
  }, [gridQueue, flushIntervalMs]);

  // Start grid queue loop on mount
  useEffect(() => {
    gridQueue.start();
    return () => {
      gridQueue.stop();
    };
  }, [gridQueue]);

  // Periodic metrics sync (1s interval for overall and per-socket rates)
  useEffect(() => {
    const interval = setInterval(() => {
      const pending = gridQueue.getPendingCounts();
      const currentSockets = socketsRef.current;
      const connectedCount = currentSockets.filter((s) => s.status === "CONNECTED").length;

      setMetrics({
        messagesReceived: globalMetricsRef.current.messagesReceived,
        ticksReceived: globalMetricsRef.current.ticksReceived,
        invalidMessages: globalMetricsRef.current.invalidMessages,
        lastMessageAt: globalMetricsRef.current.lastMessageAt,
        messagesPerSec: globalMetricsRef.current.msgWindow,
        ticksPerSec: globalMetricsRef.current.tickWindow,
        uniqueSymbols: tickStore.size(),
        queuePendingAdds: pending.adds,
        queuePendingUpdates: pending.updates,
        connectedSockets: connectedCount,
        totalSockets: currentSockets.length,
      });

      // Reset rolling window counters for global
      globalMetricsRef.current.msgWindow = 0;
      globalMetricsRef.current.tickWindow = 0;

      // Update per-socket throughput rates in state
      setSockets((prev) =>
        prev.map((s) => {
          const runtime = runtimesRef.current.get(s.id);
          if (!runtime) return s;
          const rate = runtime.msgWindow;
          runtime.msgWindow = 0;
          runtime.tickWindow = 0;
          return {
            ...s,
            messagesReceived: runtime.messagesReceived,
            ticksReceived: runtime.ticksReceived,
            messagesPerSec: rate,
            lastMessageAt: runtime.lastMessageAt,
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [gridQueue, tickStore]);

  // Collective tick message processing function
  const processMessage = useCallback(
    (raw: string, socketId?: string, socketLabel?: string) => {
      globalMetricsRef.current.messagesReceived += 1;
      globalMetricsRef.current.msgWindow += 1;
      globalMetricsRef.current.lastMessageAt = Date.now();

      if (socketId) {
        const runtime = runtimesRef.current.get(socketId);
        if (runtime) {
          runtime.messagesReceived += 1;
          runtime.msgWindow += 1;
          runtime.lastMessageAt = Date.now();
        }
      }

      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        globalMetricsRef.current.invalidMessages += 1;
        addLog("warn", `Invalid WebSocket JSON received${socketLabel ? ` from [${socketLabel}]` : ""}`);
        return;
      }

      if (!Array.isArray(payload)) {
        globalMetricsRef.current.invalidMessages += 1;
        addLog("warn", `WebSocket payload is not an array${socketLabel ? ` from [${socketLabel}]` : ""}`);
        return;
      }

      // Support single tick array wrapped in an array OR array of tick arrays
      const rows = Array.isArray(payload[0]) ? payload : [payload];

      for (const row of rows) {
        if (!Array.isArray(row)) {
          globalMetricsRef.current.invalidMessages += 1;
          continue;
        }

        const tick: Tick = mapRowToTick(row, socketLabel);
        if (!tick.symbol) {
          globalMetricsRef.current.invalidMessages += 1;
          continue;
        }

        const exists = tickStore.set(tick);
        gridQueue.queueTick(tick, exists);
        globalMetricsRef.current.ticksReceived += 1;
        globalMetricsRef.current.tickWindow += 1;

        if (socketId) {
          const runtime = runtimesRef.current.get(socketId);
          if (runtime) {
            runtime.ticksReceived += 1;
            runtime.tickWindow += 1;
          }
        }
      }

      // If Zero Delay (0ms) mode is active, dispatch immediately to AG Grid without waiting for interval
      if (gridQueue.isZeroDelay()) {
        gridQueue.flushSync();
      }
    },
    [addLog, gridQueue, tickStore]
  );

  // Update status for a specific socket
  const updateSocketStatus = useCallback(
    (id: string, status: ConnectionStatus, errorMessage?: string) => {
      const runtime = getOrCreateRuntime(id);
      runtime.status = status;
      runtime.errorMessage = errorMessage;

      setSockets((prev) =>
        prev.map((s) => {
          if (s.id === id) {
            return { ...s, status, errorMessage };
          }
          return s;
        })
      );
    },
    [getOrCreateRuntime]
  );

  // Connect a specific WebSocket connection
  const connectSocket = useCallback(
    (id: string) => {
      const target = socketsRef.current.find((s) => s.id === id);
      if (!target) return;

      let endpoint = target.url.trim();
      const label = target.name || id;

      if (!endpoint) {
        addLog("error", `[${label}] Cannot connect: WebSocket URL is empty`);
        updateSocketStatus(id, "ERROR", "Empty WebSocket URL");
        return;
      }

      if (!/^wss?:\/\//i.test(endpoint)) {
        endpoint = `ws://${endpoint}`;
      }

      const runtime = getOrCreateRuntime(id);

      // Clear any pending reconnect timers for this socket
      if (runtime.reconnectTimer) {
        clearTimeout(runtime.reconnectTimer);
        runtime.reconnectTimer = null;
      }

      // Close existing socket or EventSource cleanly
      if (runtime.socket) {
        runtime.isManualDisconnect = true;
        try {
          runtime.socket.close();
        } catch {
          // ignore
        }
        runtime.socket = null;
      }
      if (runtime.eventSource) {
        runtime.isManualDisconnect = true;
        try {
          runtime.eventSource.close();
        } catch {
          // ignore
        }
        runtime.eventSource = null;
      }

      runtime.isManualDisconnect = false;
      updateSocketStatus(id, "CONNECTING");

      const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";
      const isUnencryptedWs = endpoint.toLowerCase().startsWith("ws://");
      const shouldProxy = target.useProxy || (isHttpsPage && isUnencryptedWs);

      if (shouldProxy) {
        addLog("info", `[${label}] Connecting via Cloud Server Proxy for '${endpoint}'...`);
        try {
          const proxyApiUrl = `/api/ws-proxy?url=${encodeURIComponent(endpoint)}`;
          const es = new EventSource(proxyApiUrl);
          runtime.eventSource = es;

          es.addEventListener("status", (e: MessageEvent) => {
            try {
              const data = JSON.parse(e.data);
              if (data.status === "CONNECTED") {
                updateSocketStatus(id, "CONNECTED");
                runtime.reconnectAttempt = 0;
                addLog("success", `[${label}] Proxy connected to ${endpoint}`);
              } else if (data.status === "ERROR") {
                updateSocketStatus(id, "ERROR", data.message);
                addLog("error", `[${label}] Proxy connection error: ${data.message}`);
              } else if (data.status === "DISCONNECTED") {
                updateSocketStatus(id, "DISCONNECTED");
                addLog("warn", `[${label}] Proxy connection closed`);
              }
            } catch {
              // ignore
            }
          });

          es.addEventListener("tick", (e: MessageEvent) => {
            processMessage(e.data, id, label);
          });

          es.onerror = () => {
            if (!runtime.isManualDisconnect) {
              updateSocketStatus(id, "ERROR", "Server Proxy stream error");
              addLog("error", `[${label}] Server Proxy stream connection error for ${endpoint}`);
              es.close();
              runtime.eventSource = null;

              const currentSocket = socketsRef.current.find((s) => s.id === id);
              if (currentSocket?.autoReconnect) {
                const delay = RECONNECT_DELAYS[Math.min(runtime.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
                runtime.reconnectAttempt += 1;
                addLog("info", `[${label}] Attempting proxy reconnect #${runtime.reconnectAttempt} in ${delay}ms...`);
                runtime.reconnectTimer = setTimeout(() => {
                  connectSocketRef.current(id);
                }, delay);
              }
            }
          };
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          updateSocketStatus(id, "ERROR", errorMsg);
          addLog("error", `[${label}] Failed to initiate proxy connection: ${errorMsg}`);
        }
        return;
      }

      // Direct Browser WebSocket Connection (ws:// or wss://)
      addLog("info", `[${label}] Connecting directly to WebSocket: ${endpoint}`);

      try {
        const ws = new WebSocket(endpoint);
        runtime.socket = ws;

        ws.onopen = () => {
          updateSocketStatus(id, "CONNECTED");
          runtime.reconnectAttempt = 0;
          addLog("success", `[${label}] Connected directly to ${endpoint}`);
        };

        ws.onmessage = (event: MessageEvent) => {
          processMessage(String(event.data), id, label);
        };

        ws.onerror = () => {
          addLog("error", `[${label}] WebSocket error occurred (check protocol or host reachability)`);
          updateSocketStatus(id, "ERROR", "Connection error");
        };

        ws.onclose = (event) => {
          runtime.socket = null;

          if (runtime.isManualDisconnect) {
            updateSocketStatus(id, "DISCONNECTED");
            addLog("info", `[${label}] WebSocket disconnected manually`);
          } else {
            updateSocketStatus(id, "DISCONNECTED");
            addLog("warn", `[${label}] WebSocket closed (code ${event.code})`);

            const currentSocket = socketsRef.current.find((s) => s.id === id);
            if (currentSocket?.autoReconnect) {
              const delay = RECONNECT_DELAYS[Math.min(runtime.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
              runtime.reconnectAttempt += 1;
              addLog("info", `[${label}] Attempting auto-reconnect #${runtime.reconnectAttempt} in ${delay}ms...`);
              runtime.reconnectTimer = setTimeout(() => {
                connectSocketRef.current(id);
              }, delay);
            }
          }
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        updateSocketStatus(id, "ERROR", errorMsg);
        addLog("error", `[${label}] Failed to initiate WebSocket: ${errorMsg}`);
      }
    },
    [addLog, getOrCreateRuntime, processMessage, updateSocketStatus]
  );

  // Keep connectSocketRef in sync
  useEffect(() => {
    connectSocketRef.current = connectSocket;
  }, [connectSocket]);

  // Disconnect a specific WebSocket connection
  const disconnectSocket = useCallback(
    (id: string) => {
      const runtime = runtimesRef.current.get(id);
      const target = socketsRef.current.find((s) => s.id === id);
      const label = target?.name || id;

      if (runtime) {
        runtime.isManualDisconnect = true;
        if (runtime.reconnectTimer) {
          clearTimeout(runtime.reconnectTimer);
          runtime.reconnectTimer = null;
        }
        if (runtime.socket) {
          try {
            runtime.socket.close();
          } catch {
            // ignore
          }
          runtime.socket = null;
        }
        if (runtime.eventSource) {
          try {
            runtime.eventSource.close();
          } catch {
            // ignore
          }
          runtime.eventSource = null;
        }
      }

      updateSocketStatus(id, "DISCONNECTED");
      addLog("info", `[${label}] Disconnected by user`);
    },
    [addLog, updateSocketStatus]
  );

  // Add a new WebSocket connection to the collective pool
  const addSocket = useCallback(
    (customUrl?: string, customName?: string): string => {
      const count = socketsRef.current.length + 1;
      const newId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let newUrl = customUrl ? customUrl.trim() : "ws://trade.indianifty.com:9001?format=compact";
      if (newUrl && !/^wss?:\/\//i.test(newUrl)) {
        newUrl = `ws://${newUrl}`;
      }
      const newName = customName ? customName.trim() : `Feed #${count}`;

      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      const autoProxy = isHttps && newUrl.toLowerCase().startsWith("ws://");

      const newSocket: WebSocketInstance = {
        id: newId,
        name: newName,
        url: newUrl,
        status: "DISCONNECTED",
        useProxy: autoProxy,
        autoReconnect: true,
        messagesReceived: 0,
        ticksReceived: 0,
        messagesPerSec: 0,
        lastMessageAt: null,
      };

      setSockets((prev) => [...prev, newSocket]);
      addLog("info", `Added new WebSocket stream configuration: '${newName}' (${newUrl})`);
      return newId;
    },
    [addLog]
  );

  // Remove a WebSocket connection
  const removeSocket = useCallback(
    (id: string) => {
      const target = socketsRef.current.find((s) => s.id === id);
      const label = target?.name || id;

      // Clean up connection & timers
      disconnectSocket(id);
      runtimesRef.current.delete(id);

      setSockets((prev) => prev.filter((s) => s.id !== id));
      addLog("info", `Removed WebSocket stream: '${label}'`);
    },
    [disconnectSocket, addLog]
  );

  // Update properties of a specific socket (e.g. url, name, useProxy, autoReconnect)
  const updateSocket = useCallback((id: string, updates: Partial<WebSocketInstance>) => {
    setSockets((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return { ...s, ...updates };
        }
        return s;
      })
    );
  }, []);

  // Connect all configured WebSockets simultaneously
  const connectAll = useCallback(() => {
    addLog("info", `Connecting all ${socketsRef.current.length} configured WebSockets collectively...`);
    for (const socket of socketsRef.current) {
      if (socket.status !== "CONNECTED" && socket.status !== "CONNECTING") {
        connectSocket(socket.id);
      }
    }
  }, [connectSocket, addLog]);

  // Disconnect all WebSockets simultaneously
  const disconnectAll = useCallback(() => {
    addLog("info", "Disconnecting all active WebSockets...");
    for (const socket of socketsRef.current) {
      disconnectSocket(socket.id);
    }
  }, [disconnectSocket, addLog]);

  // Clear data utility
  const clearData = useCallback(() => {
    tickStore.clear();
    gridQueue.clear();
    globalMetricsRef.current = {
      messagesReceived: 0,
      ticksReceived: 0,
      invalidMessages: 0,
      lastMessageAt: null,
      msgWindow: 0,
      tickWindow: 0,
    };

    // Reset per-socket runtime metrics
    runtimesRef.current.forEach((runtime) => {
      runtime.messagesReceived = 0;
      runtime.ticksReceived = 0;
      runtime.lastMessageAt = null;
      runtime.msgWindow = 0;
      runtime.tickWindow = 0;
    });

    setSockets((prev) =>
      prev.map((s) => ({
        ...s,
        messagesReceived: 0,
        ticksReceived: 0,
        messagesPerSec: 0,
        lastMessageAt: null,
      }))
    );

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
      connectedSockets: socketsRef.current.filter((s) => s.status === "CONNECTED").length,
      totalSockets: socketsRef.current.length,
    });

    addLog("info", "Cleared all tick store, queue, and metrics data across all WebSockets");
  }, [addLog, gridQueue, tickStore]);

  // Local Mock Generator Toggle for testing simulated feed alongside real sockets
  const toggleMockGenerator = useCallback(
    (enable?: boolean) => {
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
      addLog("success", "Started high-frequency local mock tick generator into collective pool");

      mockIntervalRef.current = setInterval(() => {
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

        processMessage(JSON.stringify(batch), "mock-stream", "Mock Simulator");
      }, 40);
    },
    [isMockRunning, processMessage, addLog]
  );

  // Clean up all timers and sockets on unmount
  useEffect(() => {
    const runtimes = runtimesRef.current;
    return () => {
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
      runtimes.forEach((runtime) => {
        if (runtime.reconnectTimer) clearTimeout(runtime.reconnectTimer);
        if (runtime.socket) {
          try {
            runtime.socket.close();
          } catch {
            // ignore
          }
        }
        if (runtime.eventSource) {
          try {
            runtime.eventSource.close();
          } catch {
            // ignore
          }
        }
      });
    };
  }, []);

  // Compute overall status across all configured sockets
  const overallStatus: ConnectionStatus = (() => {
    if (sockets.some((s) => s.status === "CONNECTED")) return "CONNECTED";
    if (sockets.some((s) => s.status === "CONNECTING")) return "CONNECTING";
    if (sockets.some((s) => s.status === "ERROR")) return "ERROR";
    return "DISCONNECTED";
  })();

  // Backwards compatible primary socket getters / setters
  const primarySocket = sockets[0] || {
    id: "ws-1",
    name: "Primary Feed",
    url: initialUrl,
    status: "DISCONNECTED",
    useProxy: false,
    autoReconnect: true,
  };

  const setPrimaryUrl = useCallback(
    (newUrl: string) => {
      if (sockets[0]) {
        updateSocket(sockets[0].id, { url: newUrl });
      }
    },
    [sockets, updateSocket]
  );

  const setPrimaryAutoReconnect = useCallback(
    (val: boolean) => {
      if (sockets[0]) {
        updateSocket(sockets[0].id, { autoReconnect: val });
      }
    },
    [sockets, updateSocket]
  );

  const setPrimaryUseProxy = useCallback(
    (val: boolean) => {
      if (sockets[0]) {
        updateSocket(sockets[0].id, { useProxy: val });
      }
    },
    [sockets, updateSocket]
  );

  // Backwards compatible connect / disconnect helpers
  const connectPrimaryOrAll = useCallback(
    (targetUrl?: string) => {
      if (targetUrl && sockets[0]) {
        updateSocket(sockets[0].id, { url: targetUrl });
        connectSocket(sockets[0].id);
      } else {
        connectAll();
      }
    },
    [sockets, updateSocket, connectSocket, connectAll]
  );

  return {
    // Multi-WebSocket state & controllers
    sockets,
    addSocket,
    removeSocket,
    updateSocket,
    connectSocket,
    disconnectSocket,
    connectAll,
    disconnectAll,
    overallStatus,

    // Backward-compatible single-socket aliases
    url: primarySocket.url,
    setUrl: setPrimaryUrl,
    status: overallStatus,
    autoReconnect: primarySocket.autoReconnect,
    setAutoReconnect: setPrimaryAutoReconnect,
    useProxy: primarySocket.useProxy,
    setUseProxy: setPrimaryUseProxy,
    connect: connectPrimaryOrAll,
    disconnect: disconnectAll,

    // Shared streaming configuration and metrics
    flushIntervalMs,
    setFlushIntervalMs,
    metrics,
    logs,
    clearData,
    isMockRunning,
    toggleMockGenerator,
    tickStore,
    gridQueue,
  };
}
