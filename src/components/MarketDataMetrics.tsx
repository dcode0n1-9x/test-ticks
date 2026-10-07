"use client";

import React from "react";
import { SocketMetrics, ConnectionStatus } from "../market-data/types";
import { Activity, Layers, Hash, Clock, AlertTriangle, Gauge, Wifi } from "lucide-react";

interface MarketDataMetricsProps {
  metrics: SocketMetrics;
  status: ConnectionStatus;
}

export const MarketDataMetrics: React.FC<MarketDataMetricsProps> = ({ metrics, status }) => {
  const formatTime = (ts: number | null) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      {/* 1. Active Streams */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
          <span className="text-xs font-medium">Active Streams</span>
          <Wifi
            className={`h-3.5 w-3.5 ${
              metrics.connectedSockets > 0 ? "text-emerald-500" : "text-zinc-400"
            }`}
          />
        </div>
        <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
          {metrics.connectedSockets}
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-1">
            / {metrics.totalSockets}
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
          {metrics.connectedSockets === 0
            ? status === "CONNECTING"
              ? "Connecting..."
              : status === "ERROR"
              ? "Error"
              : "Offline"
            : metrics.connectedSockets === metrics.totalSockets
            ? "All connected"
            : "Partially connected"}
        </div>
      </div>

      {/* 2. Messages Received */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
          <span className="text-xs font-medium">Messages</span>
          <Activity className="h-3.5 w-3.5 text-indigo-500" />
        </div>
        <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
          {metrics.messagesReceived.toLocaleString()}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
          {metrics.messagesPerSec}/sec
        </div>
      </div>

      {/* 3. Ticks Processed */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
          <span className="text-xs font-medium">Ticks Processed</span>
          <Gauge className="h-3.5 w-3.5 text-blue-500" />
        </div>
        <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
          {metrics.ticksReceived.toLocaleString()}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
          {metrics.ticksPerSec}/sec
        </div>
      </div>

      {/* 4. Unique Symbols */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
          <span className="text-xs font-medium">Unique Symbols</span>
          <Layers className="h-3.5 w-3.5 text-emerald-500" />
        </div>
        <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
          {metrics.uniqueSymbols.toLocaleString()}
        </div>
        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
          Active Grid Rows
        </div>
      </div>

      {/* 5. Last Message Time */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
          <span className="text-xs font-medium">Last Update</span>
          <Clock className="h-3.5 w-3.5 text-purple-500" />
        </div>
        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono truncate">
          {formatTime(metrics.lastMessageAt)}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
          {metrics.lastMessageAt ? "Collective live stream" : "Waiting for ticks..."}
        </div>
      </div>

      {/* 6. Queue Pending */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
          <span className="text-xs font-medium">Tx Queue</span>
          <Hash className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
          {metrics.queuePendingAdds + metrics.queuePendingUpdates}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
          {metrics.queuePendingAdds} adds / {metrics.queuePendingUpdates} upds
        </div>
      </div>

      {/* 7. Errors / Warnings */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
          <span className="text-xs font-medium">Invalid Ticks</span>
          <AlertTriangle
            className={`h-3.5 w-3.5 ${
              metrics.invalidMessages > 0 ? "text-rose-500 animate-bounce" : "text-zinc-400"
            }`}
          />
        </div>
        <div
          className={`text-lg font-bold font-mono ${
            metrics.invalidMessages > 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {metrics.invalidMessages.toLocaleString()}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
          Dropped or bad JSON
        </div>
      </div>
    </div>
  );
};
