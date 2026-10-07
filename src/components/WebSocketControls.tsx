"use client";

import React, { useState } from "react";
import { ConnectionStatus, WebSocketInstance } from "../market-data/types";
import {
  Play,
  Square,
  Wifi,
  RefreshCw,
  Zap,
  Trash2,
  ShieldCheck,
  Globe,
  Plus,
  Layers,
  Activity,
  AlertCircle,
} from "lucide-react";

export interface EndpointPreset {
  name: string;
  url: string;
  tag?: string;
}

export const ENDPOINT_PRESETS: EndpointPreset[] = [
  {
    name: "IBKR+GMT",
    url: "ws://trade.indianifty.com:9001?format=compact",
    tag: "compact",
  },
  {
    name: "Bento",
    url: "ws://localhost:8080",
    tag: "port 8080",
  },
  {
    name: "Fxcubic",
    url: "ws://65.0.243.105:9010/",
    tag: "direct",
  },
];

interface WebSocketControlsProps {
  sockets: WebSocketInstance[];
  addSocket: (url?: string, name?: string) => string;
  removeSocket: (id: string) => void;
  updateSocket: (id: string, updates: Partial<WebSocketInstance>) => void;
  connectSocket: (id: string) => void;
  disconnectSocket: (id: string) => void;
  connectAll: () => void;
  disconnectAll: () => void;
  overallStatus: ConnectionStatus;
  flushIntervalMs: number;
  setFlushIntervalMs: (val: number) => void;
  clearData: () => void;
  isMockRunning: boolean;
  toggleMockGenerator: (enable?: boolean) => void;
}

export const WebSocketControls: React.FC<WebSocketControlsProps> = ({
  sockets,
  addSocket,
  removeSocket,
  updateSocket,
  connectSocket,
  disconnectSocket,
  connectAll,
  disconnectAll,
  overallStatus,
  flushIntervalMs,
  setFlushIntervalMs,
  clearData,
  isMockRunning,
  toggleMockGenerator,
}) => {
  const [isHttps] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.location.protocol === "https:";
    }
    return false;
  });

  const connectedCount = sockets.filter((s) => s.status === "CONNECTED").length;
  const connectingCount = sockets.filter((s) => s.status === "CONNECTING").length;

  const getStatusBadge = (status: ConnectionStatus) => {
    switch (status) {
      case "CONNECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Connected
          </span>
        );
      case "CONNECTING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20">
            <RefreshCw className="h-3 w-3 animate-spin text-amber-500" />
            Connecting
          </span>
        );
      case "ERROR":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Error
          </span>
        );
      case "DISCONNECTED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400 border border-zinc-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            Disconnected
          </span>
        );
    }
  };

  const handleSetProtocol = (socket: WebSocketInstance, proto: "ws" | "wss") => {
    const cleanUrl = socket.url.replace(/^(ws|wss):\/\//i, "");
    updateSocket(socket.id, { url: `${proto}://${cleanUrl}` });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4">
      {/* Top Header & Collective Actions Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Multi-WebSocket Collective Stream Manager
              </h2>
              {getStatusBadge(overallStatus)}
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20">
                {connectedCount} of {sockets.length} Active
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Configure multiple WebSockets to collectively stream data into a unified AG Grid order book.
            </p>
          </div>
        </div>

        {/* Collective Batch Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={connectAll}
            disabled={sockets.length === 0 || connectedCount === sockets.length}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors cursor-pointer"
            title="Connect all configured WebSockets simultaneously"
          >
            <Play className="h-3.5 w-3.5" />
            Connect All
          </button>

          <button
            onClick={disconnectAll}
            disabled={connectedCount === 0 && connectingCount === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors cursor-pointer"
            title="Disconnect all currently connected WebSockets"
          >
            <Square className="h-3.5 w-3.5" />
            Disconnect All
          </button>

          <button
            onClick={() => addSocket()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            title="Add another WebSocket connection to the pool"
          >
            <Plus className="h-3.5 w-3.5" />
            Add WebSocket
          </button>

          <button
            onClick={clearData}
            title="Clear all market tick data and metrics across all streams"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Data
          </button>
        </div>
      </div>

      {/* Quick Endpoint Presets */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
          <Globe className="h-3.5 w-3.5 text-indigo-500" /> Add Preset Stream:
        </span>
        {ENDPOINT_PRESETS.map((preset) => (
          <button
            key={preset.url}
            type="button"
            onClick={() => addSocket(preset.url, preset.name)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 transition-colors cursor-pointer"
            title={`Add new stream for ${preset.name} (${preset.url})`}
          >
            <Plus className="h-3 w-3" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{preset.name}:</span>
            <span>{preset.url}</span>
          </button>
        ))}
      </div>

      {/* Sockets Cards List */}
      <div className="space-y-3">
        {sockets.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl space-y-2">
            <Wifi className="h-8 w-8 text-zinc-400 mx-auto" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              No WebSockets configured. Add one or more WebSockets to start streaming.
            </p>
            <button
              onClick={() => addSocket()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add WebSocket
            </button>
          </div>
        ) : (
          sockets.map((socket, index) => {
            const isWs = socket.url.trim().toLowerCase().startsWith("ws://");
            const isWss = socket.url.trim().toLowerCase().startsWith("wss://");
            const isConnected = socket.status === "CONNECTED";
            const isConnecting = socket.status === "CONNECTING";

            return (
              <div
                key={socket.id}
                className={`border rounded-xl p-3.5 transition-all space-y-3 ${
                  isConnected
                    ? "bg-zinc-50/80 dark:bg-zinc-950/60 border-emerald-500/30 dark:border-emerald-500/20 shadow-sm"
                    : socket.status === "ERROR"
                    ? "bg-rose-50/20 dark:bg-rose-950/10 border-rose-500/30 dark:border-rose-500/20"
                    : "bg-zinc-50/40 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {/* Socket Row 1: Header & Quick Status */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={socket.name}
                      onChange={(e) => updateSocket(socket.id, { name: e.target.value })}
                      placeholder={`Feed #${index + 1}`}
                      className="font-semibold text-sm bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 focus:outline-none text-zinc-900 dark:text-zinc-100 px-0.5"
                    />
                    {getStatusBadge(socket.status)}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Live Throughput Metrics Pill */}
                    <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                      <Activity className="h-3 w-3 text-indigo-500" />
                      <span>{socket.messagesReceived.toLocaleString()} msgs</span>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {socket.messagesPerSec}/sec
                      </span>
                    </div>

                    {/* Connect / Disconnect button */}
                    {!isConnected && !isConnecting ? (
                      <button
                        onClick={() => connectSocket(socket.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        <Play className="h-3 w-3" />
                        Connect
                      </button>
                    ) : (
                      <button
                        onClick={() => disconnectSocket(socket.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        <Square className="h-3 w-3" />
                        Disconnect
                      </button>
                    )}

                    {/* Delete socket button */}
                    <button
                      onClick={() => removeSocket(socket.id)}
                      disabled={sockets.length <= 1}
                      title={sockets.length <= 1 ? "At least one WebSocket configuration is kept" : "Remove this WebSocket"}
                      className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30 disabled:hover:text-zinc-400 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Socket Row 2: URL Endpoint Input with Protocol Selector & Quick Preset Dropdown */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1 flex items-center">
                    <div className="absolute left-1 z-10 flex items-center gap-0.5 bg-zinc-200 dark:bg-zinc-800 rounded p-0.5 text-[10px] font-mono">
                      <button
                        type="button"
                        disabled={isConnected || isConnecting}
                        onClick={() => handleSetProtocol(socket, "ws")}
                        className={`px-1.5 py-0.5 rounded transition-colors ${
                          isWs
                            ? "bg-indigo-600 text-white font-bold"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                      >
                        ws://
                      </button>
                      <button
                        type="button"
                        disabled={isConnected || isConnecting}
                        onClick={() => handleSetProtocol(socket, "wss")}
                        className={`px-1.5 py-0.5 rounded transition-colors ${
                          isWss
                            ? "bg-emerald-600 text-white font-bold"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                      >
                        wss://
                      </button>
                    </div>
                    <input
                      type="text"
                      value={socket.url}
                      onChange={(e) => updateSocket(socket.id, { url: e.target.value })}
                      disabled={isConnected || isConnecting}
                      placeholder="ws://trade.indianifty.com:9001?format=compact or ws://localhost:8080"
                      className="w-full pl-28 pr-3 py-1.5 text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100 disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Preset Selector Dropdown for this individual Socket */}
                  <select
                    disabled={isConnected || isConnecting}
                    value={ENDPOINT_PRESETS.some((p) => p.url === socket.url) ? socket.url : ""}
                    onChange={(e) => {
                      const selected = ENDPOINT_PRESETS.find((p) => p.url === e.target.value);
                      if (selected) {
                        updateSocket(socket.id, {
                          url: selected.url,
                          name: socket.name.startsWith("Feed #") ? selected.name : socket.name,
                        });
                      }
                    }}
                    className="sm:w-56 px-2 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <option value="">Select preset URL...</option>
                    {ENDPOINT_PRESETS.map((p) => (
                      <option key={p.url} value={p.url}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Socket Row 3: Options & Diagnostics */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400 pt-1">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={socket.autoReconnect}
                        onChange={(e) => updateSocket(socket.id, { autoReconnect: e.target.checked })}
                        className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Auto-reconnect (1s–10s backoff)</span>
                    </label>

                    <label
                      className="inline-flex items-center gap-1.5 cursor-pointer select-none"
                      title="Proxy WebSocket connections through Next.js server route to bypass browser Mixed Content (HTTPS ws://) restrictions."
                    >
                      <input
                        type="checkbox"
                        checked={socket.useProxy}
                        onChange={(e) => updateSocket(socket.id, { useProxy: e.target.checked })}
                        className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Server Proxy Mode {isHttps && isWs && "(Recommended on HTTPS)"}
                      </span>
                    </label>
                  </div>

                  <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                    {socket.lastMessageAt ? (
                      <span>Last active: {new Date(socket.lastMessageAt).toLocaleTimeString()}</span>
                    ) : (
                      <span>No activity yet</span>
                    )}
                  </div>
                </div>

                {/* Error Banner if connection failed */}
                {socket.status === "ERROR" && socket.errorMessage && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="break-all">{socket.errorMessage}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Controls Bar: Mock Simulator & Batch Flush Speed */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleMockGenerator()}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all border cursor-pointer ${
              isMockRunning
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
            }`}
          >
            <Zap className={`h-3.5 w-3.5 ${isMockRunning ? "text-amber-500 animate-bounce" : "text-indigo-500"}`} />
            {isMockRunning ? "Stop Local Mock Feed" : "Start Local Mock Feed (Collective Simulator)"}
          </button>
          <span className="hidden sm:inline text-zinc-500 text-[11px]">
            Ticks from all active WebSockets stream collectively into the AG Grid.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Streaming Latency:</span>
          <select
            value={flushIntervalMs}
            onChange={(e) => setFlushIntervalMs(Number(e.target.value))}
            className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-2.5 py-1 text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value={0}>0ms (Zero Delay / Instant Live)</option>
            <option value={16}>16ms (~60fps Smooth)</option>
            <option value={50}>50ms (Low CPU Batching)</option>
            <option value={100}>100ms (Heavy Throttle)</option>
            <option value={250}>250ms (Power Saver)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
