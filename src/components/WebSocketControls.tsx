"use client";

import React, { useState, useEffect } from "react";
import { ConnectionStatus } from "../market-data/types";
import { Play, Square, Wifi, RefreshCw, Zap, Trash2, AlertTriangle, ShieldAlert, ArrowRight } from "lucide-react";

interface WebSocketControlsProps {
  url: string;
  setUrl: (url: string) => void;
  status: ConnectionStatus;
  autoReconnect: boolean;
  setAutoReconnect: (val: boolean) => void;
  flushIntervalMs: number;
  setFlushIntervalMs: (val: number) => void;
  connect: (url?: string) => void;
  disconnect: () => void;
  clearData: () => void;
  isMockRunning: boolean;
  toggleMockGenerator: (enable?: boolean) => void;
}

export const WebSocketControls: React.FC<WebSocketControlsProps> = ({
  url,
  setUrl,
  status,
  autoReconnect,
  setAutoReconnect,
  flushIntervalMs,
  setFlushIntervalMs,
  connect,
  disconnect,
  clearData,
  isMockRunning,
  toggleMockGenerator,
}) => {
  const [isHttps, setIsHttps] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsHttps(window.location.protocol === "https:");
    }
  }, []);

  const isMixedContentRisk = isHttps && url.trim().toLowerCase().startsWith("ws://");

  const handleUpgradeToWss = () => {
    const upgraded = url.replace(/^ws:\/\//i, "wss://");
    setUrl(upgraded);
  };

  const getStatusBadge = () => {
    switch (status) {
      case "CONNECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Connected
          </span>
        );
      case "CONNECTING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20">
            <RefreshCw className="h-3 w-3 animate-spin text-amber-500" />
            Connecting
          </span>
        );
      case "ERROR":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Error
          </span>
        );
      case "DISCONNECTED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400 border border-zinc-500/20">
            <span className="h-2 w-2 rounded-full bg-zinc-400" />
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            WebSocket Controller
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <button
            onClick={clearData}
            title="Clear all market tick data and metrics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Endpoint Input & Connection controls */}
        <div className="lg:col-span-8 flex flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="wss://your-domain.com/ws or ws://localhost:3000/ws"
              className={`w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border rounded-lg focus:outline-none focus:ring-2 font-mono text-zinc-800 dark:text-zinc-200 ${
                isMixedContentRisk
                  ? "border-amber-400 dark:border-amber-600 focus:ring-amber-500"
                  : "border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
              }`}
              disabled={status === "CONNECTED" || status === "CONNECTING"}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {status !== "CONNECTED" && status !== "CONNECTING" ? (
              <button
                onClick={() => connect()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                Connect
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Square className="h-3.5 w-3.5" />
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Quick Mock Stream Simulator Toggle */}
        <div className="lg:col-span-4 flex items-center justify-end">
          <button
            onClick={() => toggleMockGenerator()}
            className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all border ${
              isMockRunning
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
            }`}
          >
            <Zap className={`h-3.5 w-3.5 ${isMockRunning ? "text-amber-500 animate-bounce" : "text-indigo-500"}`} />
            {isMockRunning ? "Stop Local Mock Stream" : "Start Local Mock Stream"}
          </button>
        </div>
      </div>

      {/* Mixed Content HTTPS Warning Banner */}
      {isMixedContentRisk && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-800 dark:text-amber-200 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Browser Mixed Content Security Block: </span>
              This page is loaded over secure HTTPS (<code className="font-mono bg-amber-200/50 dark:bg-amber-900/50 px-1 rounded">https://test-tic-mu.vercel.app/</code>), so modern browsers block unencrypted <code className="font-mono bg-amber-200/50 dark:bg-amber-900/50 px-1 rounded">ws://</code> socket endpoints like <code className="font-mono font-semibold">{url}</code>.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 pl-6">
            <button
              onClick={handleUpgradeToWss}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded shadow-sm transition-colors cursor-pointer"
            >
              <span>Upgrade to wss://</span>
              <ArrowRight className="h-3 w-3" />
            </button>
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              Or click "Start Local Mock Stream" above to test live market data without network restrictions!
            </span>
          </div>
        </div>
      )}

      {/* Advanced Socket Settings */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-zinc-600 dark:text-zinc-400">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoReconnect}
            onChange={(e) => setAutoReconnect(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
          />
          Auto-reconnect on unexpected drop (exponential backoff 1s–10s)
        </label>

        <div className="flex items-center gap-2">
          <span>Batch Flush Interval:</span>
          <select
            value={flushIntervalMs}
            onChange={(e) => setFlushIntervalMs(Number(e.target.value))}
            className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value={16}>16ms (~60fps)</option>
            <option value={50}>50ms (Recommended)</option>
            <option value={100}>100ms</option>
            <option value={250}>250ms</option>
          </select>
        </div>
      </div>
    </div>
  );
};
